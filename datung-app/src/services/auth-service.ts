import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

// ---------------------------------------------------------------------------
// Phone helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a Philippine phone number to E.164 format: +63XXXXXXXXXX
 *
 * Accepts:
 *   09XXXXXXXXX   → +639XXXXXXXXX
 *   9XXXXXXXXX    → +639XXXXXXXXX  (10-digit without leading 0)
 *   639XXXXXXXXX  → +639XXXXXXXXX
 *   +639XXXXXXXXX → +639XXXXXXXXX  (already correct)
 */
export function formatPhilippinePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('63') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `+63${digits}`;
  }

  // Return as-is with + prefix if we can't parse — Supabase will validate it
  return digits.startsWith('+') ? phone.trim() : `+${digits}`;
}

/** Returns true if the string looks like a valid PH mobile number after formatting */
export function isValidPhilippinePhone(phone: string): boolean {
  const formatted = formatPhilippinePhone(phone);
  // +63 followed by 9 (mobile prefix) and 9 more digits = 13 chars total
  return /^\+639\d{9}$/.test(formatted);
}

// ---------------------------------------------------------------------------
// Auth service
// ---------------------------------------------------------------------------

export const authService = {
  /**
   * Sends an OTP SMS to the given phone number.
   * Returns the normalised +63XXXXXXXXXX string so the caller can pass it
   * back to verifyOtp without reformatting.
   */
  async signInWithOtp(phone: string): Promise<string> {
    const formatted = formatPhilippinePhone(phone);
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) throw error;
    return formatted;
  },

  /**
   * Verifies the 6-digit OTP for the given phone.
   * Returns the Supabase session + user on success.
   */
  async verifyOtp(
    phone: string,
    token: string,
  ): Promise<{ user: User; session: Session }> {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: token.trim(),
      type: 'sms',
    });

    if (error) throw error;
    if (!data.user || !data.session) {
      throw new Error('Hindi na-verify ang OTP. Subukan muli.');
    }

    return { user: data.user, session: data.session };
  },

  /**
   * Signs out the current user and clears the stored session.
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Returns the currently authenticated Supabase user, or null if none.
   */
  async getCurrentUser(): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  },

  /**
   * Subscribes to auth state changes.
   * Returns the subscription object; call `.subscription.unsubscribe()` to clean up.
   */
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
