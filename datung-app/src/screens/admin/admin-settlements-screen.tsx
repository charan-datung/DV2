import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminSettlements } from '../../hooks/use-admin';
import { adminService } from '../../services/admin-service';
import { formatCentavos } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import { userFriendlyError } from '../../utils/errors';
import LoadingSpinner from '../../components/loading-spinner';
import ErrorBanner from '../../components/error-banner';
import EmptyState from '../../components/empty-state';

const C = {
  primary: '#0D5C37',
  primaryDark: '#09402A',
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
  pending: { label: 'Pending', color: C.warning, bg: C.warningLight },
  processing: { label: 'Processing', color: C.blue, bg: C.blueLight },
  completed: { label: 'Completed', color: C.primary, bg: C.primaryLight },
  failed: { label: 'Failed', color: C.error, bg: C.errorLight },
};

type FilterTab = 'all' | 'pending' | 'completed';

export default function AdminSettlementsScreen() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const filterStatus = filter === 'all' ? undefined : filter;
  const { settlements, isLoading, error, refetch } = useAdminSettlements(
    filterStatus ? { status: filterStatus } : undefined,
  );

  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleProcess = (settlementId: string, storeName: string, amount: number) => {
    Alert.alert(
      'Process Settlement',
      `Mark ${formatCentavos(amount)} to ${storeName} as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setProcessing(settlementId);
            try {
              await adminService.processSettlement(settlementId);
              await refetch();
            } catch (err) {
              Alert.alert('Error', userFriendlyError(err));
            } finally {
              setProcessing(null);
            }
          },
        },
      ],
    );
  };

  // Summary totals
  const pendingTotal = settlements
    .filter((s) => s.status === 'pending')
    .reduce((sum, s) => sum + s.amount_centavos, 0);
  const completedTotal = settlements
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.amount_centavos, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Settlement Processing</Text>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: C.warningLight }]}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={[styles.summaryValue, { color: C.warning }]}>
            {formatCentavos(pendingTotal)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: C.primaryLight }]}>
          <Text style={styles.summaryLabel}>Completed</Text>
          <Text style={[styles.summaryValue, { color: C.primary }]}>
            {formatCentavos(completedTotal)}
          </Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'completed'] as FilterTab[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={settlements}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        renderItem={({ item }) => {
          const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
          const isPending = item.status === 'pending';

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.storeName}>{item.stores?.name ?? 'Unknown Store'}</Text>
                  <Text style={styles.amount}>{formatCentavos(item.amount_centavos)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.badgeText, { color: sc.color }]}>{sc.label}</Text>
                </View>
              </View>

              <Text style={styles.timestamp}>Created: {formatDateTime(item.created_at)}</Text>
              {item.settled_at && (
                <Text style={styles.timestamp}>Settled: {formatDateTime(item.settled_at)}</Text>
              )}

              {isPending && (
                <Pressable
                  style={({ pressed }) => [
                    styles.processBtn,
                    pressed && styles.processBtnPressed,
                  ]}
                  onPress={() => handleProcess(item.id, item.stores?.name ?? '', item.amount_centavos)}
                  disabled={processing === item.id}
                >
                  {processing === item.id ? (
                    <ActivityIndicator color={C.white} size="small" />
                  ) : (
                    <Text style={styles.processBtnText}>Mark as Completed</Text>
                  )}
                </Pressable>
              )}

              <Text style={styles.txnId}>ID: {item.id.slice(0, 8)}...</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <LoadingSpinner message="Loading..." />
          ) : (
            <EmptyState icon="💰" title="No settlements" subtitle="No settlements found." />
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

  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 16 },
  summaryLabel: { fontSize: 12, color: C.textSub, fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800' },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8,
  },
  storeName: { fontSize: 15, fontWeight: '700', color: C.text },
  amount: { fontSize: 20, fontWeight: '800', color: C.text, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  timestamp: { fontSize: 11, color: C.disabled, marginTop: 4 },
  txnId: { fontSize: 10, color: C.disabled, marginTop: 4, fontFamily: 'monospace' },

  processBtn: {
    backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginTop: 12,
  },
  processBtnPressed: { backgroundColor: C.primaryDark },
  processBtnText: { fontSize: 14, fontWeight: '700', color: C.white },
});
