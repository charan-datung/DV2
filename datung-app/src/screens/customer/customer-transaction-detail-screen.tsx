import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CustomerStackParamList } from '../../types/navigation';
import { useTransactionDetail } from '../../hooks/use-transactions';
import { formatCentavos } from '../../utils/currency';
import { formatDate, formatDateTime, daysUntil } from '../../utils/date';
import LoadingSpinner from '../../components/loading-spinner';
import ErrorBanner from '../../components/error-banner';

const C = {
  primary: '#0D5C37',
  primaryDark: '#09402A',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textSub: '#5E6A7A',
  error: '#C62828',
};

type RouteType = RouteProp<CustomerStackParamList, 'CustomerTransactionDetail'>;
type Nav = NativeStackNavigationProp<CustomerStackParamList>;

export default function CustomerTransactionDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const { transactionId } = route.params;

  const { transaction, repayments, isLoading } = useTransactionDetail(transactionId);

  if (isLoading && !transaction) {
    return <LoadingSpinner message="Nilo-load..." />;
  }

  if (!transaction) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorBanner message="Hindi nahanap ang transaksyon." />
      </SafeAreaView>
    );
  }

  const days = daysUntil(transaction.due_date);
  const isOverdue = days < 0 && !['repaid', 'defaulted'].includes(transaction.status);
  const canRepay = ['approved', 'settled'].includes(transaction.status);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Bumalik</Text>
        </Pressable>

        {/* Amount block */}
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Halaga</Text>
          <Text style={styles.amount}>{formatCentavos(transaction.amount_centavos)}</Text>
          {transaction.interest_centavos > 0 && (
            <Text style={styles.interest}>
              + {formatCentavos(transaction.interest_centavos)} bayad-dagdag
            </Text>
          )}
          <Text style={styles.total}>
            Total: {formatCentavos(transaction.amount_centavos + transaction.interest_centavos)}
          </Text>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <InfoRow label="Tindahan" value={transaction.stores?.name ?? '-'} />
          <InfoRow label="Status" value={transaction.status} />
          <InfoRow label="Takdang Araw" value={formatDate(transaction.due_date)} />
          {isOverdue && (
            <InfoRow
              label="Overdue"
              value={`${Math.abs(days)} araw nang late`}
              valueColor={C.error}
            />
          )}
          {!isOverdue && days >= 0 && !['repaid', 'defaulted'].includes(transaction.status) && (
            <InfoRow
              label="Natitira"
              value={days === 0 ? 'Ngayong araw!' : `${days} araw`}
              valueColor={days <= 1 ? C.error : days <= 3 ? '#E65100' : undefined}
            />
          )}
          <InfoRow label="Petsa" value={formatDateTime(transaction.created_at)} />
          {transaction.repaid_at && (
            <InfoRow label="Nabayaran" value={formatDateTime(transaction.repaid_at)} />
          )}
        </View>

        {/* Repayments */}
        {repayments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mga Bayad</Text>
            {repayments.map((r) => (
              <View key={r.id} style={styles.repaymentRow}>
                <View>
                  <Text style={styles.repaymentAmount}>
                    {formatCentavos(r.amount_centavos)}
                  </Text>
                  <Text style={styles.repaymentMeta}>
                    {r.method === 'bank_qr' ? 'Bank Transfer / QR' : 'Cash (OTC)'}
                    {r.reference_no ? ` — ${r.reference_no}` : ''}
                  </Text>
                </View>
                <Text style={styles.repaymentDate}>{formatDateTime(r.created_at)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Repay button */}
        {canRepay && (
          <Pressable
            style={({ pressed }) => [styles.repayBtn, pressed && styles.repayBtnPressed]}
            onPress={() => navigation.navigate('CustomerRepay', { transactionId: transaction.id })}
          >
            <Text style={styles.repayBtnText}>Magbayad</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  backBtn: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backText: { fontSize: 14, color: C.primary, fontWeight: '600' },

  amountBlock: { alignItems: 'center', paddingVertical: 24 },
  amountLabel: { fontSize: 13, color: C.textSub, marginBottom: 4 },
  amount: { fontSize: 32, fontWeight: '800', color: C.text },
  interest: { fontSize: 14, color: C.textSub, marginTop: 4 },
  total: { fontSize: 16, fontWeight: '700', color: C.primary, marginTop: 8 },

  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  infoLabel: { fontSize: 13, color: C.textSub },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.text },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },

  repaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  repaymentAmount: { fontSize: 14, fontWeight: '700', color: C.text },
  repaymentMeta: { fontSize: 12, color: C.textSub, marginTop: 2 },
  repaymentDate: { fontSize: 11, color: C.textSub },

  repayBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
  },
  repayBtnPressed: { backgroundColor: C.primaryDark },
  repayBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
