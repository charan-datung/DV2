// Gesture handler must be the very first import for web compatibility
import 'react-native-gesture-handler';

// URL polyfill must load before any URL parsing (including supabase-js)
import 'react-native-url-polyfill/auto';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
