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
import { useAdminStores, useAdminCustomers } from '../../hooks/use-admin';
import { adminService } from '../../services/admin-service';
import { formatCentavos } from '../../utils/currency';
import { userFriendlyError } from '../../utils/errors';
import LoadingSpinner from '../../components/loading-spinner';
import ErrorBanner from '../../components/error-banner';

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

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  active: { color: C.primary, bg: C.primaryLight },
  frozen: { color: C.warning, bg: C.warningLight },
  suspended: { color: C.error, bg: C.errorLight },
  blocked: { color: C.error, bg: C.errorLight },
};

const LEVEL_NAMES = ['Baguhan', 'Suki', 'Tapat', 'Matibay', 'Beterano'];

type Tab = 'stores' | 'customers';

export default function AdminUsersScreen() {
  const [tab, setTab] = useState<Tab>('stores');
  const { stores, isLoading: storesLoading, error: storesError, refetch: refetchStores } = useAdminStores();
  const { customers, isLoading: custLoading, error: custError, refetch: refetchCustomers } = useAdminCustomers();
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStores(), refetchCustomers()]);
    setRefreshing(false);
  }, [refetchStores, refetchCustomers]);

  const handleStoreStatusChange = (storeId: string, storeName: string, currentStatus: string) => {
    const actions = currentStatus === 'active'
      ? [
          { text: 'Freeze', onPress: () => updateStoreStatus(storeId, 'frozen') },
          { text: 'Suspend', onPress: () => updateStoreStatus(storeId, 'suspended') },
        ]
      : currentStatus === 'frozen'
        ? [
            { text: 'Unfreeze (Active)', onPress: () => updateStoreStatus(storeId, 'active') },
            { text: 'Block', onPress: () => updateStoreStatus(storeId, 'blocked') },
          ]
        : [
            { text: 'Activate', onPress: () => updateStoreStatus(storeId, 'active') },
          ];

    Alert.alert(
      `Manage: ${storeName}`,
      `Current status: ${currentStatus}`,
      [...actions, { text: 'Cancel', style: 'cancel' }],
    );
  };

  const updateStoreStatus = async (storeId: string, status: string) => {
    setActing(storeId);
    try {
      await adminService.updateStoreStatus(storeId, status);
      await refetchStores();
    } catch (err) {
      Alert.alert('Error', userFriendlyError(err));
    } finally {
      setActing(null);
    }
  };

  const handleCustomerAction = (customerId: string, customerName: string, currentStatus: string, level: number) => {
    const statusActions = currentStatus === 'active'
      ? [
          { text: 'Freeze', onPress: () => updateCustomerStatus(customerId, 'frozen') },
          { text: 'Block', onPress: () => updateCustomerStatus(customerId, 'blocked') },
        ]
      : currentStatus === 'frozen'
        ? [
            { text: 'Unfreeze', onPress: () => updateCustomerStatus(customerId, 'active') },
            { text: 'Block', onPress: () => updateCustomerStatus(customerId, 'blocked') },
          ]
        : [
            { text: 'Activate', onPress: () => updateCustomerStatus(customerId, 'active') },
          ];

    const levelActions = level < 4
      ? [{ text: `Upgrade to L${level + 1}`, onPress: () => updateCustomerLevel(customerId, level + 1) }]
      : [];

    Alert.alert(
      `Manage: ${customerName}`,
      `Status: ${currentStatus} · Level ${level}`,
      [...statusActions, ...levelActions, { text: 'Cancel', style: 'cancel' }],
    );
  };

  const updateCustomerStatus = async (customerId: string, status: string) => {
    setActing(customerId);
    try {
      await adminService.updateCustomerStatus(customerId, status);
      await refetchCustomers();
    } catch (err) {
      Alert.alert('Error', userFriendlyError(err));
    } finally {
      setActing(null);
    }
  };

  const updateCustomerLevel = async (customerId: string, level: number) => {
    setActing(customerId);
    try {
      await adminService.updateCustomerLevel(customerId, level);
      await refetchCustomers();
    } catch (err) {
      Alert.alert('Error', userFriendlyError(err));
    } finally {
      setActing(null);
    }
  };

  const isLoading = tab === 'stores' ? storesLoading : custLoading;
  const error = tab === 'stores' ? storesError : custError;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>User Management</Text>

      {/* Tab selector */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'stores' && styles.tabActive]}
          onPress={() => setTab('stores')}
        >
          <Text style={[styles.tabText, tab === 'stores' && styles.tabTextActive]}>
            Stores ({stores.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'customers' && styles.tabActive]}
          onPress={() => setTab('customers')}
        >
          <Text style={[styles.tabText, tab === 'customers' && styles.tabTextActive]}>
            Customers ({customers.length})
          </Text>
        </Pressable>
      </View>

      {error && <ErrorBanner message={error} />}

      {tab === 'stores' ? (
        <FlatList
          data={stores}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
          renderItem={({ item }) => {
            const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.active;
            return (
              <Pressable
                style={styles.card}
                onPress={() => handleStoreStatusChange(item.id, item.name, item.status)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.badgeText, { color: sc.color }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>{item.address}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>Credit: {formatCentavos(item.credit_line)}</Text>
                  <Text style={styles.metaText}>Available: {formatCentavos(item.available_balance)}</Text>
                  <Text style={styles.metaText}>Tier {item.tier} · {item.settlement_type}</Text>
                </View>
                {acting === item.id && (
                  <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            isLoading ? <LoadingSpinner message="Loading..." /> : null
          }
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
          renderItem={({ item }) => {
            const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.active;
            return (
              <Pressable
                style={styles.card}
                onPress={() => handleCustomerAction(item.id, item.name, item.status, item.level)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.badgeText, { color: sc.color }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>{item.phone}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>
                    Level {item.level} ({LEVEL_NAMES[item.level] ?? ''})
                  </Text>
                  <Text style={styles.metaText}>On-time: {item.on_time_repayment_count}</Text>
                  {item.recent_default_count > 0 && (
                    <Text style={[styles.metaText, { color: C.error }]}>
                      Defaults: {item.recent_default_count}
                    </Text>
                  )}
                </View>
                {acting === item.id && (
                  <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            isLoading ? <LoadingSpinner message="Loading..." /> : null
          }
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  title: { fontSize: 22, fontWeight: '800', color: C.text, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  list: { paddingBottom: 20 },

  tabRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: C.white, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.disabled,
  },
  tabActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  tabText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  tabTextActive: { color: C.primary },

  card: {
    backgroundColor: C.white, borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  cardSub: { fontSize: 13, color: C.textSub, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaText: { fontSize: 12, color: C.textSub, backgroundColor: C.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
