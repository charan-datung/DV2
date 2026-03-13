import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StoreStackParamList } from '../../types/navigation';
import { useMyStore, useStoreTransactions } from '../../hooks/use-store';
import { formatCentavos } from '../../utils/currency';
import TransactionCard from '../../components/transaction-card';
import LoadingSpinner from '../../components/loading-spinner';
import ErrorBanner from '../../components/error-banner';
import EmptyState from '../../components/empty-state';

const C = {
  primary: '#0D5C37',
  primaryLight: '#E8F5EE',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textSub: '#5E6A7A',
  accent: '#F4A200',
  accentLight: '#FFF8E1',
  error: '#C62828',
  errorLight: '#FFEBEE',
};

type Nav = NativeStackNavigationProp<StoreStackParamList>;

export default function StoreHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { store, isLoading: storeLoading, error: storeError, refetch: refetchStore } = useMyStore();
  const {
    transactions,
    isLoading: txnLoading,
    error: txnError,
    refetch: refetchTxns,
  } = useStoreTransactions(store?.id);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStore(), refetchTxns()]);
    setRefreshing(false);
  }, [refetchStore, refetchTxns]);

  if (storeLoading && !store) {
    return <LoadingSpinner message="Nilo-load ang tindahan..." />;
  }

  const pendingCount = transactions.filter((t) => t.status === 'pending').length;
  const activeCount = transactions.filter(
    (t) => t.status === 'approved' || t.status === 'settled',
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.storeName}>{store?.name ?? 'Tindahan'}</Text>
              <View style={[styles.statusBadge, store?.status === 'frozen' && styles.frozenBadge]}>
                <Text style={[styles.statusText, store?.status === 'frozen' && styles.frozenText]}>
                  {store?.status === 'active' ? 'Active' : store?.status ?? ''}
                </Text>
              </View>
            </View>

            {/* Balance cards */}
            <View style={styles.balanceRow}>
              <View style={[styles.balanceCard, { backgroundColor: C.primaryLight }]}>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={[styles.balanceValue, { color: C.primary }]}>
                  {formatCentavos(store?.available_balance ?? 0)}
                </Text>
              </View>
              <View style={[styles.balanceCard, { backgroundColor: C.accentLight }]}>
                <Text style={styles.balanceLabel}>Credit Line</Text>
                <Text style={[styles.balanceValue, { color: C.accent }]}>
                  {formatCentavos(store?.credit_line ?? 0)}
                </Text>
              </View>
            </View>

            {/* Quick stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{activeCount}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{transactions.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            {(storeError || txnError) && (
              <ErrorBanner message={storeError || txnError || ''} />
            )}

            <Text style={styles.sectionTitle}>Mga Transaksyon</Text>
          </>
        }
        renderItem={({ item }) => (
          <TransactionCard
            transaction={item}
            subtitle={item.customers?.name}
            onPress={() =>
              navigation.navigate('StoreTransactionDetail', { transactionId: item.id })
            }
          />
        )}
        ListEmptyComponent={
          txnLoading ? null : (
            <EmptyState
              icon="📋"
              title="Wala pang transaksyon"
              subtitle="Kapag nag-request ang customer, makikita mo dito."
            />
          )
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  list: { paddingBottom: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  storeName: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: C.primaryLight,
  },
  frozenBadge: { backgroundColor: C.errorLight },
  statusText: { fontSize: 12, fontWeight: '700', color: C.primary },
  frozenText: { color: C.error },

  balanceRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  balanceCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '800',
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 11, color: C.textSub, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E8ECF0', marginVertical: 4 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
});
