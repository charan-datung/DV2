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

/**
 * True when the app was built without Supabase credentials baked in.
 * On Vercel this happens when EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
 * are not set in the project's Environment Variables before the build runs.
 */
export const isMisconfigured = !supabaseUrl || !supabaseAnonKey;

if (isMisconfigured) {
  console.warn(
    '[Datung] Missing Supabase credentials.\n' +
      'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
      'in Vercel → Project Settings → Environment Variables, then redeploy.',
  );
}

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',   // avoid createClient crash on empty string
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

