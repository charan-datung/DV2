import React from 'react';
import { Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import type { AuthStackParamList } from '../types/navigation';
import LoginScreen from '../screens/auth/login-screen';
import RoleSelectScreen from '../screens/auth/role-select-screen';
import StoreRegistrationScreen from '../screens/auth/store-registration-screen';
import CustomerRegistrationScreen from '../screens/auth/customer-registration-screen';

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: Platform.OS !== 'web',
        cardStyle: { backgroundColor: '#F5F7FA' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="StoreRegistration" component={StoreRegistrationScreen} />
      <Stack.Screen name="CustomerRegistration" component={CustomerRegistrationScreen} />
    </Stack.Navigator>
  );
}
