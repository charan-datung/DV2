import React from 'react';
import { Platform, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import type { CustomerStackParamList } from '../types/navigation';
import CustomerHomeScreen from '../screens/customer/customer-home-screen';
import CustomerScanScreen from '../screens/customer/customer-scan-screen';
import CustomerTransactionDetailScreen from '../screens/customer/customer-transaction-detail-screen';
import CustomerRepayScreen from '../screens/customer/customer-repay-screen';

type CustomerTabParamList = {
  HomeTab: undefined;
  ScanTab: undefined;
};

const Tab = createBottomTabNavigator<CustomerTabParamList>();
const Stack = createStackNavigator<CustomerStackParamList>();

function CustomerHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: Platform.OS !== 'web' }}>
      <Stack.Screen name="CustomerHome" component={CustomerHomeScreen} />
      <Stack.Screen name="CustomerTransactionDetail" component={CustomerTransactionDetailScreen} />
      <Stack.Screen name="CustomerRepay" component={CustomerRepayScreen} />
    </Stack.Navigator>
  );
}

function CustomerScanStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: Platform.OS !== 'web' }}>
      <Stack.Screen name="CustomerScan" component={CustomerScanScreen} />
    </Stack.Navigator>
  );
}

export default function CustomerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0D5C37',
        tabBarInactiveTintColor: '#A8B4C0',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E8ECF0',
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={CustomerHomeStack}
        options={{
          tabBarLabel: 'Tahanan',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>H</Text>,
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={CustomerScanStack}
        options={{
          tabBarLabel: 'I-scan',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⎕</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
