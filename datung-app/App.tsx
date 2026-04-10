import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from './src/stores/auth-store';
import RootNavigator from './src/navigation/root-navigator';
import LoadingSpinner from './src/components/loading-spinner';

// ---------------------------------------------------------------------------
// Error Boundary — prevents total white-screen crashes
// ---------------------------------------------------------------------------
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in dev; wire to Sentry/Crashlytics in production
    console.error('[Datung] Unhandled error:', error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <SafeAreaView style={crashStyles.safe}>
            <Text style={crashStyles.icon}>⚠️</Text>
            <Text style={crashStyles.heading}>May nangyaring mali</Text>
            <Text style={crashStyles.body}>
              Paumanhin sa abala. I-restart ang app at subukan muli.{'\n'}
              Kung patuloy ang problema, makipag-ugnayan sa support.
            </Text>
            <Pressable
              style={({ pressed }) => [crashStyles.btn, pressed && crashStyles.btnPressed]}
              onPress={this.handleRetry}
            >
              <Text style={crashStyles.btnText}>Subukan Muli</Text>
            </Pressable>
          </SafeAreaView>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

const crashStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#5E6A7A',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  btn: {
    backgroundColor: '#0D5C37',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  btnPressed: { backgroundColor: '#09402A' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

// ---------------------------------------------------------------------------
// Inner app — handles auth initialization with error recovery
// ---------------------------------------------------------------------------
function AppInner() {
  const { isLoading, initialize } = useAuthStore();
  const [initError, setInitError] = useState<string | null>(null);

  const runInit = React.useCallback(async () => {
    setInitError(null);
    try {
      await initialize();
    } catch (err) {
      console.error('[Datung] Auth init failed:', err);
      setInitError('Hindi ma-connect sa server. Suriin ang internet at subukan muli.');
    }
  }, [initialize]);

  useEffect(() => {
    runInit();
  }, [runInit]);

  if (initError) {
    return (
      <SafeAreaView style={crashStyles.safe}>
        <Text style={crashStyles.icon}>📶</Text>
        <Text style={crashStyles.heading}>Walang koneksyon</Text>
        <Text style={crashStyles.body}>{initError}</Text>
        <Pressable
          style={({ pressed }) => [crashStyles.btn, pressed && crashStyles.btnPressed]}
          onPress={runInit}
        >
          <Text style={crashStyles.btnText}>Subukan Muli</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return <LoadingSpinner message="Nilo-load ang Datung..." />;
  }

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppInner />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
