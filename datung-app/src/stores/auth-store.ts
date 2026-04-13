import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../config/supabase';
import { authService } from '../services/auth-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = 'store' | 'customer' | 'admin';

interface AuthState {
  // ---- State ----
  user: User | null;
  /** 'store' | 'customer' | null (null = authenticated but not yet registered) */
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // ---- Actions ----
  /**
   * Step 1 of phone login: sends OTP to the phone.
   * Returns the normalised +63XXXXXXXXXX so the OTP screen can pass it back.
   */
  sendOtp: (phone: string) => Promise<string>;

  /**
   * Step 2 of phone login: verifies the OTP.
   * Returns { needsRegistration: true } when the user has no store or customer
   * profile yet — the caller should navigate to RoleSelect.
   */
  verifyOtp: (
    phone: string,
    token: string,
  ) => Promise<{ needsRegistration: boolean }>;

  /**
   * Email/password login.
   * Returns { needsRegistration: true } if authenticated but no profile exists.
   */
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ needsRegistration: boolean }>;

  /**
   * Create account with email/password.
   * Returns { confirmationRequired } if email verification is needed,
   * otherwise { needsRegistration } like other auth flows.
   */
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ needsRegistration: boolean; confirmationRequired: boolean }>;

  /** Manually set the role (used after the user picks a role on RoleSelect) */
  setRole: (role: UserRole) => void;

  /** Signs out and resets all auth state */
  logout: () => Promise<void>;

  /**
   * Called once at app startup.
   * Restores any existing session from AsyncStorage and subscribes to future
   * auth state changes for the lifetime of the app.
   */
  initialize: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Role detection helper
// Queries both tables in parallel; returns the role or null if unregistered.
// ---------------------------------------------------------------------------
async function detectRole(userId: string): Promise<UserRole | null> {
  const [adminResult, storeResult, customerResult] = await Promise.all([
    supabase.from('admins').select('id').eq('user_id', userId).maybeSingle(),
    supabase.from('stores').select('id').eq('owner_id', userId).maybeSingle(),
    supabase.from('customers').select('id').eq('user_id', userId).maybeSingle(),
  ]);

  // Ignore individual query errors — treat as "not found" for that role
  if (adminResult.data) return 'admin';
  if (storeResult.data) return 'store';
  if (customerResult.data) return 'customer';
  return null;
}

// ---------------------------------------------------------------------------
// Module-level subscription reference — prevents duplicate listeners when
// initialize() is called more than once (e.g. on error retry).
// ---------------------------------------------------------------------------
let _authSub: { unsubscribe: () => void } | null = null;

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,

  // ------------------------------------------------------------------
  sendOtp: async (phone) => {
    // Delegates to authService; throws on error so the screen can catch
    return authService.signInWithOtp(phone);
  },

  // ------------------------------------------------------------------
  verifyOtp: async (phone, token) => {
    const { user } = await authService.verifyOtp(phone, token);
    const role = await detectRole(user.id);
    set({ user, role, isAuthenticated: true });
    return { needsRegistration: role === null };
  },

  // ------------------------------------------------------------------
  signInWithEmail: async (email, password) => {
    const { user } = await authService.signInWithPassword(email, password);
    const role = await detectRole(user.id);
    set({ user, role, isAuthenticated: true });
    return { needsRegistration: role === null };
  },

  // ------------------------------------------------------------------
  signUpWithEmail: async (email, password) => {
    const result = await authService.signUpWithEmail(email, password);
    if (result.confirmationRequired) {
      return { needsRegistration: false, confirmationRequired: true };
    }
    if (result.user) {
      const role = await detectRole(result.user.id);
      set({ user: result.user, role, isAuthenticated: true });
      return { needsRegistration: role === null, confirmationRequired: false };
    }
    throw new Error('Hindi na-create ang account. Subukan muli.');
  },

  // ------------------------------------------------------------------
  setRole: (role) => set({ role }),

  // ------------------------------------------------------------------
  logout: async () => {
    await authService.signOut();
    set({ user: null, role: null, isAuthenticated: false });
  },

  // ------------------------------------------------------------------
  initialize: async () => {
    set({ isLoading: true });

    // Clean up any previous subscription before creating a new one.
    // This prevents duplicate listeners when initialize() is retried.
    if (_authSub) {
      _authSub.unsubscribe();
      _authSub = null;
    }

    try {
      // Session restore — non-fatal if it fails (network error, paused project, etc.)
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          const role = await detectRole(user.id);
          set({ user, role, isAuthenticated: true });
        }
      } catch (sessionErr) {
        // Treat as "no existing session" — user will see login screen
        console.warn('[Datung] Session restore failed (non-fatal):', sessionErr);
      }

      // Subscribe to auth events for the lifetime of the app.
      // onAuthStateChange() must also be inside the outer try — in some
      // environments (paused Supabase project, AsyncStorage errors on web)
      // the Supabase client's internal initialization can throw here.
      const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          set({ user: null, role: null, isAuthenticated: false });
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const role = await detectRole(session.user.id);
          // role === null means newly confirmed user with no profile yet —
          // RootNavigator will show Auth stack, LoginScreen will push to RoleSelect.
          set({ user: session.user, role, isAuthenticated: true });
        }
      });
      _authSub = subscription;
    } catch (err) {
      // Auth listener setup failed — treat as "no session", let user log in.
      // We deliberately do NOT re-throw: propagating this error causes App.tsx
      // to show the "Walang koneksyon" dead-end screen even when the device
      // has internet (e.g. project paused, wrong key, storage error on web).
      console.error('[Datung] Auth init failed, proceeding as logged out:', err);
    } finally {
      set({ isLoading: false });
    }
  },
}));
