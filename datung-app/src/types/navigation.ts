import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

// ----------------------------------------------------------------
// Auth stack — shown when user is not authenticated or needs setup
// ----------------------------------------------------------------
export type AuthStackParamList = {
  Login: undefined;
  RoleSelect: undefined;
  StoreRegistration: undefined;
  CustomerRegistration: undefined;
};

// ----------------------------------------------------------------
// Store owner stack
// ----------------------------------------------------------------
export type StoreStackParamList = {
  StoreHome: undefined;
  StoreCustomers: undefined;
  StoreTransactionDetail: { transactionId: string };
  StoreSettings: undefined;
};

// ----------------------------------------------------------------
// Customer stack
// ----------------------------------------------------------------
export type CustomerStackParamList = {
  CustomerHome: undefined;
  CustomerScan: undefined;
  CustomerTransactionDetail: { transactionId: string };
  CustomerRepay: { transactionId: string };
};

// ----------------------------------------------------------------
// Admin stack
// ----------------------------------------------------------------
export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminTransactions: undefined;
  AdminSettlements: undefined;
};

// ----------------------------------------------------------------
// Root stack (wraps auth + role stacks)
// ----------------------------------------------------------------
export type RootStackParamList = {
  Auth: undefined;
  Store: undefined;
  Customer: undefined;
  Admin: undefined;
};

// ----------------------------------------------------------------
// Convenience prop types for screens
// ----------------------------------------------------------------
export type LoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Login'
>;

export type RoleSelectScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'RoleSelect'
>;

export type LoginScreenRouteProp = RouteProp<AuthStackParamList, 'Login'>;
export type RoleSelectScreenRouteProp = RouteProp<AuthStackParamList, 'RoleSelect'>;
