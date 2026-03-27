import React from 'react';
import { Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuthStore } from '../stores/auth-store';
import AuthNavigator from './auth-navigator';
import StoreNavigator from './store-navigator';
import CustomerNavigator from './customer-navigator';
import AdminNavigator from './admin-navigator';

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, role } = useAuthStore();

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        animationEnabled: Platform.OS !== 'web',
        cardStyle: { backgroundColor: '#F5F7FA' },
      }}
    >
      {!isAuthenticated || !role ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : role === 'admin' ? (
        <Stack.Screen name="Admin" component={AdminNavigator} />
      ) : role === 'store' ? (
        <Stack.Screen name="Store" component={StoreNavigator} />
      ) : (
        <Stack.Screen name="Customer" component={CustomerNavigator} />
      )}
    </Stack.Navigator>
  );
}
