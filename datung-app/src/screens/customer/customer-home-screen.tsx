import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CustomerStackParamList } from '../../types/navigation';
import { useMyCustomer, useCustomerTransactions } from '../../hooks/use-customer';
import { formatCentavos } from '../../utils/currency';
import { getMaxTransaction } from '../../services/customer-service';
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
};

type Nav = NativeStackNavigationProp<CustomerStackParamList>;

const LEVEL_NAMES = ['Baguhan', 'Suki', 'Tapat', 'Matibay', 'Beterano'];

export default function CustomerHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { customer, isLoading: custLoading, error: custError, refetch: refetchCust } = useMyCustomer();
  const {
    transactions,
    isLoading: txnLoading,
    error: txnError,
    refetch: refetchTxns,
  } = useCustomerTransactions();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchCust(), refetchTxns()]);
    setRefreshing(false);
  }, [refetchCust, refetchTxns]);

  if (custLoading && !customer) {
    return <LoadingSpinner message="Nilo-load..." />;
  }

  const level = customer?.level ?? 0;
  const maxAmount = getMaxTransaction(level);
  const activeTransactions = transactions.filter(
    (t) => t.status === 'approved' || t.status === 'settled' || t.status === 'pending',
  );
  const totalOutstanding = activeTransactions
    .filter((t) => t.status === 'approved' || t.status === 'settled')
    .reduce((sum, t) => sum + t.amount_centavos, 0);

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
            {/* Greeting */}
            <View style={styles.header}>
              <Text style={styles.greeting}>
                Kumusta, {customer?.name?.split(' ')[0] ?? 'Customer'}!
              </Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>
                  Level {level} — {LEVEL_NAMES[level] ?? ''}
                </Text>
              </View>
            </View>

            {/* Balance cards */}
            <View style={styles.cardRow}>
              <View style={[styles.infoCard, { backgroundColor: C.primaryLight }]}>
                <Text style={styles.cardLabel}>Natitirang Halaga</Text>
                <Text style={[styles.cardValue, { color: C.primary }]}>
                  {formatCentavos(maxAmount - totalOutstanding)}
                </Text>
              </View>
              <View style={[styles.infoCard, { backgroundColor: C.accentLight }]}>
                <Text style={styles.cardLabel}>Outstanding</Text>
                <Text style={[styles.cardValue, { color: C.accent }]}>
                  {formatCentavos(totalOutstanding)}
                </Text>
              </View>
            </View>

            {/* Max amount info */}
            <View style={styles.maxRow}>
              <Text style={styles.maxText}>
                Maximum per transaction: {formatCentavos(maxAmount)}
              </Text>
            </View>

            {(custError || txnError) && (
              <ErrorBanner message={custError || txnError || ''} />
            )}

            <Text style={styles.sectionTitle}>Mga Transaksyon</Text>
          </>
        }
        renderItem={({ item }) => (
          <TransactionCard
            transaction={item}
            subtitle={item.stores?.name}
            onPress={() =>
              navigation.navigate('CustomerTransactionDetail', { transactionId: item.id })
            }
          />
        )}
        ListEmptyComponent={
          txnLoading ? null : (
            <EmptyState
              icon="🛒"
              title="Wala pang transaksyon"
              subtitle="I-scan ang QR code ng tindahan para magsimula."
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
  },

  cardRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  infoCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
  },
  cardLabel: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '800',
  },

  maxRow: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  maxText: {
    fontSize: 12,
    color: C.textSub,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
});
