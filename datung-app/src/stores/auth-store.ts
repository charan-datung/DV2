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
   * Step 1 of login: sends OTP to the phone.
   * Returns the normalised +63XXXXXXXXXX so the OTP screen can pass it back.
   */
  sendOtp: (phone: string) => Promise<string>;

  /**
   * Step 2 of login: verifies the OTP.
   * Returns { needsRegistration: true } when the user has no store or customer
   * profile yet — the caller should navigate to RoleSelect.
   */
  verifyOtp: (
    phone: string,
    token: string,
  ) => Promise<{ needsRegistration: boolean }>;

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

  if (adminResult.data) return 'admin';
  if (storeResult.data) return 'store';
  if (customerResult.data) return 'customer';
  return null;
}

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
  setRole: (role) => set({ role }),

  // ------------------------------------------------------------------
  logout: async () => {
    await authService.signOut();
    set({ user: null, role: null, isAuthenticated: false });
  },

  // ------------------------------------------------------------------
  initialize: async () => {
    set({ isLoading: true });

    try {
      const user = await authService.getCurrentUser();
      if (user) {
        const role = await detectRole(user.id);
        set({ user, role, isAuthenticated: true });
      }
    } catch {
      // Session restore failure is non-fatal — treat as logged out
    } finally {
      set({ isLoading: false });
    }

    // Subscribe to auth events for the lifetime of the app.
    // Token refresh, sign-in from another tab (web), or server-side sign-out
    // are all handled here automatically.
    authService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        set({ user: null, role: null, isAuthenticated: false });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const role = await detectRole(session.user.id);
        set({ user: session.user, role, isAuthenticated: true });
      }
    });
  },
}));
