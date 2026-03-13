import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuthStore } from '../stores/auth-store';
import AuthNavigator from './auth-navigator';
import StoreNavigator from './store-navigator';
import CustomerNavigator from './customer-navigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, role } = useAuthStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!isAuthenticated || !role ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : role === 'store' ? (
        <Stack.Screen name="Store" component={StoreNavigator} />
      ) : (
        <Stack.Screen name="Customer" component={CustomerNavigator} />
      )}
    </Stack.Navigator>
  );
}
