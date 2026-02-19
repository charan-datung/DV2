// react-native-url-polyfill must load before any URL parsing (including supabase-js)
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Read credentials injected by app.config.js extra → accessible via
// expo-constants at runtime (works in Expo Go, dev builds, and production).
// ---------------------------------------------------------------------------
const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseAnonKey?: string }
  | undefined;

const supabaseUrl = extra?.supabaseUrl ?? '';
const supabaseAnonKey = extra?.supabaseAnonKey ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Soft warning in dev so the app still boots; hard failure would prevent
  // seeing the error screen on first setup.
  console.warn(
    '[Datung] Missing Supabase credentials.\n' +
      'Copy .env.example → .env and fill in EXPO_PUBLIC_SUPABASE_URL ' +
      'and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.',
  );
}

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in AsyncStorage so users stay logged in across
    // app restarts.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Must be false for React Native — there is no URL to detect a session in.
    detectSessionInUrl: false,
  },
});
