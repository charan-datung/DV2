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
import { useAdminTransactions } from '../../hooks/use-admin';
import { formatCentavos } from '../../utils/currency';
import { formatDate, formatDateTime, daysUntil } from '../../utils/date';
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
  error: '#C62828',
  errorLight: '#FFEBEE',
  warning: '#E65100',
  warningLight: '#FFF3E0',
  blue: '#1565C0',
  blueLight: '#E3F2FD',
  disabled: '#A8B4C0',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#E65100', bg: '#FFF3E0' },
  approved: { label: 'Approved', color: '#1565C0', bg: '#E3F2FD' },
  settled: { label: 'Settled', color: '#2E7D32', bg: '#E8F5E9' },
  repaid: { label: 'Repaid', color: '#0D5C37', bg: '#E8F5EE' },
  defaulted: { label: 'Defaulted', color: '#C62828', bg: '#FFEBEE' },
};

type FilterTab = 'all' | 'pending' | 'active' | 'overdue' | 'defaulted';

export default function AdminTransactionsScreen() {
  const [filter, setFilter] = useState<FilterTab>('all');

  const statusFilter = filter === 'active' ? undefined : filter === 'overdue' ? undefined : filter === 'all' ? undefined : filter;
  const { transactions, isLoading, error, refetch } = useAdminTransactions(
    statusFilter ? { status: statusFilter } : undefined,
  );

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Apply client-side filters for special cases
  const filtered = filter === 'active'
    ? transactions.filter((t) => t.status === 'approved' || t.status === 'settled')
    : filter === 'overdue'
      ? transactions.filter(
          (t) =>
            (t.status === 'approved' || t.status === 'settled') &&
            daysUntil(t.due_date) < 0,
        )
      : transactions;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>All Transactions</Text>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'active', 'overdue', 'defaulted'] as FilterTab[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        renderItem={({ item }) => {
          const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
          const days = daysUntil(item.due_date);
          const isOverdue = days < 0 && !['repaid', 'defaulted'].includes(item.status);

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.amount}>{formatCentavos(item.amount_centavos)}</Text>
                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.badgeText, { color: sc.color }]}>{sc.label}</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Customer</Text>
                  <Text style={styles.infoValue}>{item.customers?.name ?? '-'}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Store</Text>
                  <Text style={styles.infoValue}>{item.stores?.name ?? '-'}</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Due</Text>
                  <Text style={styles.infoValue}>{formatDate(item.due_date)}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Level</Text>
                  <Text style={styles.infoValue}>L{item.customers?.level ?? 0}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Interest</Text>
                  <Text style={styles.infoValue}>{formatCentavos(item.interest_centavos)}</Text>
                </View>
              </View>

              {isOverdue && (
                <Text style={styles.overdueText}>
                  {Math.abs(days)} days overdue
                </Text>
              )}

              <Text style={styles.timestamp}>Created: {formatDateTime(item.created_at)}</Text>
              <Text style={styles.txnId}>ID: {item.id.slice(0, 8)}...</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <LoadingSpinner message="Loading..." />
          ) : (
            <EmptyState icon="📋" title="No transactions" subtitle={`No ${filter} transactions found.`} />
          )
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  title: { fontSize: 22, fontWeight: '800', color: C.text, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  list: { paddingBottom: 20 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.disabled,
  },
  filterChipActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  filterText: { fontSize: 12, fontWeight: '600', color: C.textSub },
  filterTextActive: { color: C.primary },

  card: {
    backgroundColor: C.white, borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  amount: { fontSize: 20, fontWeight: '800', color: C.text },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  infoGrid: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 11, color: C.textSub, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.text },

  overdueText: {
    fontSize: 12, fontWeight: '700', color: C.error,
    backgroundColor: C.errorLight, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, alignSelf: 'flex-start', marginTop: 4,
  },

  timestamp: { fontSize: 11, color: C.disabled, marginTop: 8 },
  txnId: { fontSize: 10, color: C.disabled, marginTop: 2, fontFamily: 'monospace' },
});
