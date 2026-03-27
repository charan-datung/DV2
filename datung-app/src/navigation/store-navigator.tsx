import React from 'react';
import { Platform, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import type { StoreStackParamList } from '../types/navigation';
import StoreHomeScreen from '../screens/store/store-home-screen';
import StoreCustomersScreen from '../screens/store/store-customers-screen';
import StoreTransactionDetailScreen from '../screens/store/store-transaction-detail-screen';
import StoreSettingsScreen from '../screens/store/store-settings-screen';

type StoreTabParamList = {
  HomeTab: undefined;
  CustomersTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<StoreTabParamList>();
const Stack = createStackNavigator<StoreStackParamList>();

function StoreHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: Platform.OS !== 'web' }}>
      <Stack.Screen name="StoreHome" component={StoreHomeScreen} />
      <Stack.Screen name="StoreTransactionDetail" component={StoreTransactionDetailScreen} />
    </Stack.Navigator>
  );
}

function StoreCustomersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: Platform.OS !== 'web' }}>
      <Stack.Screen name="StoreCustomers" component={StoreCustomersScreen} />
    </Stack.Navigator>
  );
}

function StoreSettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: Platform.OS !== 'web' }}>
      <Stack.Screen name="StoreSettings" component={StoreSettingsScreen} />
    </Stack.Navigator>
  );
}

export default function StoreNavigator() {
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
        component={StoreHomeStack}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <TabIcon label="D" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CustomersTab"
        component={StoreCustomersStack}
        options={{
          tabBarLabel: 'Mga Suki',
          tabBarIcon: ({ color }) => (
            <TabIcon label="S" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={StoreSettingsStack}
        options={{
          tabBarLabel: 'Mga Setting',
          tabBarIcon: ({ color }) => (
            <TabIcon label="⚙" color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/** Simple text-based tab icon (avoids vector icon setup issues) */
function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{label}</Text>;
}
