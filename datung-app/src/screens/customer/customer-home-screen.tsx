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
import type { CustomerStackParamList } from '../../types/navigation';
import { useMyCustomer, useCustomerTransactions } from '../../hooks/use-customer';
import { formatCentavos } from '../../utils/currency';
import { daysUntil } from '../../utils/date';
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
  error: '#C62828',
  errorLight: '#FFEBEE',
  warning: '#E65100',
  warningLight: '#FFF3E0',
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
                Pinakamataas na halaga: {formatCentavos(maxAmount)}
              </Text>
            </View>

            {/* ID upload prompt for Level 2+ customers without ID */}
            {level >= 2 && !customer?.id_photo_url && (
              <Pressable
                style={[styles.pendingBanner, { backgroundColor: '#E3F2FD' }]}
                onPress={() => navigation.navigate('CustomerProfile')}
              >
                <Text style={[styles.pendingText, { color: '#1565C0' }]}>
                  📎 Mag-upload ng valid ID para maging eligible sa Level 3 (hanggang ₱5,000).{' '}
                  <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }}>
                    I-tap para mag-upload →
                  </Text>
                </Text>
              </Pressable>
            )}

            {/* Selfie upload prompt */}
            {level >= 1 && !customer?.selfie_url && (
              <Pressable
                style={[styles.pendingBanner, { backgroundColor: '#E3F2FD' }]}
                onPress={() => navigation.navigate('CustomerProfile')}
              >
                <Text style={[styles.pendingText, { color: '#1565C0' }]}>
                  🤳 Mag-upload ng selfie para ma-verify ang iyong account.{' '}
                  <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }}>
                    I-tap para mag-upload →
                  </Text>
                </Text>
              </Pressable>
            )}

            {/* Pending transactions banner */}
            {activeTransactions.filter((t) => t.status === 'pending').length > 0 && (
              <View style={styles.pendingBanner}>
                <Text style={styles.pendingText}>
                  May {activeTransactions.filter((t) => t.status === 'pending').length} na pending na transaksyon — hinihintay ang approval ng tindahan.
                </Text>
              </View>
            )}

            {/* Nearest due date warning */}
            {(() => {
              const activeDue = activeTransactions
                .filter((t) => t.status === 'approved' || t.status === 'settled')
                .map((t) => ({ ...t, days: daysUntil(t.due_date) }))
                .sort((a, b) => a.days - b.days);
              const nearest = activeDue[0];
              if (!nearest) return null;
              if (nearest.days < 0) {
                return (
                  <View style={styles.urgentBanner}>
                    <Text style={styles.urgentText}>
                      May overdue ka nang {Math.abs(nearest.days)} araw! Magbayad agad para maiwasan ang penalty.
                    </Text>
                  </View>
                );
              }
              if (nearest.days <= 3) {
                return (
                  <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>
                      {nearest.days === 0
                        ? 'Ngayong araw ang due date mo!'
                        : `${nearest.days} araw na lang bago mag-due ang bayad mo.`}
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* Frozen/blocked status */}
            {customer?.status === 'frozen' && (
              <View style={styles.urgentBanner}>
                <Text style={styles.urgentText}>
                  Naka-freeze ang iyong account. Bayaran muna ang overdue na balanse.
                </Text>
              </View>
            )}
            {(customer?.status === 'blocked' || customer?.status === 'suspended') && (
              <View style={styles.urgentBanner}>
                <Text style={styles.urgentText}>
                  Hindi aktibo ang iyong account. Makipag-ugnayan sa Datung support.
                </Text>
              </View>
            )}

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

  pendingBanner: {
    backgroundColor: C.accentLight,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  pendingText: { fontSize: 13, color: C.accent, lineHeight: 18, fontWeight: '600' },

  warningBanner: {
    backgroundColor: C.warningLight,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  warningText: { fontSize: 13, color: C.warning, lineHeight: 18, fontWeight: '600' },

  urgentBanner: {
    backgroundColor: C.errorLight,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  urgentText: { fontSize: 13, color: C.error, lineHeight: 18, fontWeight: '600' },
});
