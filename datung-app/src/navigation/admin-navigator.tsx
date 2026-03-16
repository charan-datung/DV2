import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AdminDashboardScreen from '../screens/admin/admin-dashboard-screen';
import AdminUsersScreen from '../screens/admin/admin-users-screen';
import AdminTransactionsScreen from '../screens/admin/admin-transactions-screen';
import AdminSettlementsScreen from '../screens/admin/admin-settlements-screen';

type AdminTabParamList = {
  DashboardTab: undefined;
  UsersTab: undefined;
  TransactionsTab: undefined;
  SettlementsTab: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

export default function AdminNavigator() {
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
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <TabIcon label="D" color={color} />,
        }}
      />
      <Tab.Screen
        name="UsersTab"
        component={AdminUsersScreen}
        options={{
          tabBarLabel: 'Users',
          tabBarIcon: ({ color }) => <TabIcon label="U" color={color} />,
        }}
      />
      <Tab.Screen
        name="TransactionsTab"
        component={AdminTransactionsScreen}
        options={{
          tabBarLabel: 'Txns',
          tabBarIcon: ({ color }) => <TabIcon label="T" color={color} />,
        }}
      />
      <Tab.Screen
        name="SettlementsTab"
        component={AdminSettlementsScreen}
        options={{
          tabBarLabel: 'Settle',
          tabBarIcon: ({ color }) => <TabIcon label="$" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{label}</Text>;
}
