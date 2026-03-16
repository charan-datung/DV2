import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../types/navigation';
import LoginScreen from '../screens/auth/login-screen';
import RoleSelectScreen from '../screens/auth/role-select-screen';
import StoreRegistrationScreen from '../screens/auth/store-registration-screen';
import CustomerRegistrationScreen from '../screens/auth/customer-registration-screen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="StoreRegistration" component={StoreRegistrationScreen} />
      <Stack.Screen name="CustomerRegistration" component={CustomerRegistrationScreen} />
    </Stack.Navigator>
  );
}
