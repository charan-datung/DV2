// app.config.js replaces app.json so we can inject env vars into Constants.expoConfig.extra
// Access via: import Constants from 'expo-constants'; Constants.expoConfig.extra.supabaseUrl

export default {
  expo: {
    name: 'datung-app',
    slug: 'datung-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.datung.app',
    },
    android: {
      package: 'com.datung.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    // Injected from .env via EXPO_PUBLIC_ prefix — readable at runtime via expo-constants
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
