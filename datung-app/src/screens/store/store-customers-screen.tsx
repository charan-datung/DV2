import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMyStore, useStoreCustomers } from '../../hooks/use-store';
import { formatCentavos } from '../../utils/currency';
import LoadingSpinner from '../../components/loading-spinner';
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
};

const LEVEL_LABELS = ['Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4'];

export default function StoreCustomersScreen() {
  const { store } = useMyStore();
  const { customers, isLoading, refetch } = useStoreCustomers(store?.id);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading && customers.length === 0) {
    return <LoadingSpinner message="Nilo-load ang mga suki..." />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mga Suki</Text>
        <Text style={styles.count}>{customers.length} customer(s)</Text>
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.customerName}>{item.name}</Text>
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'blocked' && styles.blockedBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    item.status === 'blocked' && styles.blockedText,
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>

            <Text style={styles.phone}>{item.phone}</Text>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{LEVEL_LABELS[item.level] ?? 'Level ?'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>
                  On-time: {item.on_time_repayment_count}
                </Text>
              </View>
              {item.recent_default_count > 0 && (
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: C.error }]}>
                    Defaults: {item.recent_default_count}
                  </Text>
                </View>
              )}
            </View>

            {(item.outstanding_centavos ?? 0) > 0 && (
              <View style={styles.outstandingRow}>
                <Text style={styles.outstandingLabel}>Outstanding:</Text>
                <Text style={styles.outstandingValue}>
                  {formatCentavos(item.outstanding_centavos ?? 0)}
                </Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title="Wala pang suki"
            subtitle="Kapag may nag-transact sa tindahan mo, lalabas sila dito."
          />
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
  title: { fontSize: 22, fontWeight: '800', color: C.text },
  count: { fontSize: 13, color: C.textSub, marginTop: 2 },
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: { fontSize: 16, fontWeight: '700', color: C.text },
  phone: { fontSize: 13, color: C.textSub, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.primaryLight,
  },
  blockedBadge: { backgroundColor: C.errorLight },
  statusText: { fontSize: 11, fontWeight: '700', color: C.primary },
  blockedText: { color: C.error },
  infoRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 12,
  },
  infoItem: {
    backgroundColor: C.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoLabel: { fontSize: 11, fontWeight: '600', color: C.textSub },
  outstandingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  outstandingLabel: { fontSize: 13, color: C.textSub },
  outstandingValue: { fontSize: 15, fontWeight: '700', color: C.text },
});
