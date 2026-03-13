import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StoreStackParamList } from '../../types/navigation';
import { useTransactionDetail } from '../../hooks/use-transactions';
import { storeService } from '../../services/store-service';
import { formatCentavos } from '../../utils/currency';
import { formatDate, formatDateTime, daysUntil } from '../../utils/date';
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
  disabled: '#A8B4C0',
};

const TRUST_REASONS: Record<string, string> = {
  neighbor_5yr: 'Kapitbahay (5+ taon)',
  regular_suki: 'Regular na suki',
  known_family: 'Kilalang pamilya',
  referred_by_customer: 'Na-refer ng ibang customer',
  work_colleague: 'Kasamahan sa trabaho',
  other: 'Iba pa',
};

type RouteType = RouteProp<StoreStackParamList, 'StoreTransactionDetail'>;

export default function StoreTransactionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { transactionId } = route.params;

  const { transaction, repayments, isLoading, error, refetch } =
    useTransactionDetail(transactionId);

  const [approving, setApproving] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

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
  const isPending = transaction.status === 'pending';

  const handleApprove = async () => {
    if (!selectedReason || !transaction.customers) return;
    setActionError('');
    setApproving(true);
    try {
      await storeService.approveTransaction(
        transaction.id,
        transaction.store_id,
        transaction.customer_id,
        selectedReason,
      );
      await refetch();
    } catch (err) {
      setActionError(userFriendlyError(err));
    } finally {
      setApproving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back button */}
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Bumalik</Text>
        </Pressable>

        {/* Amount */}
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Halaga</Text>
          <Text style={styles.amount}>{formatCentavos(transaction.amount_centavos)}</Text>
          {transaction.interest_centavos > 0 && (
            <Text style={styles.interest}>
              + {formatCentavos(transaction.interest_centavos)} interest
            </Text>
          )}
        </View>

        {/* Info rows */}
        <View style={styles.card}>
          <InfoRow label="Customer" value={transaction.customers?.name ?? '-'} />
          <InfoRow label="Level" value={`Level ${transaction.customers?.level ?? 0}`} />
          <InfoRow label="Status" value={transaction.status} />
          <InfoRow label="Due Date" value={formatDate(transaction.due_date)} />
          {isOverdue && (
            <InfoRow
              label="Overdue"
              value={`${Math.abs(days)} araw`}
              valueColor={C.error}
            />
          )}
          <InfoRow label="Created" value={formatDateTime(transaction.created_at)} />
          {transaction.approved_at && (
            <InfoRow label="Approved" value={formatDateTime(transaction.approved_at)} />
          )}
          {transaction.repaid_at && (
            <InfoRow label="Repaid" value={formatDateTime(transaction.repaid_at)} />
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
                    {r.method === 'gcash' ? 'GCash' : 'Cash (OTC)'}
                    {r.reference_no ? ` — ${r.reference_no}` : ''}
                  </Text>
                </View>
                <Text style={styles.repaymentDate}>{formatDateTime(r.created_at)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Approve section (only for pending transactions) */}
        {isPending && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>I-approve ang Transaksyon</Text>
            <Text style={styles.approveHint}>
              Piliin kung bakit mo pinagkakatiwalaan ang customer na ito:
            </Text>

            {Object.entries(TRUST_REASONS).map(([key, label]) => (
              <Pressable
                key={key}
                style={[
                  styles.reasonOption,
                  selectedReason === key && styles.reasonSelected,
                ]}
                onPress={() => setSelectedReason(key)}
              >
                <View
                  style={[
                    styles.radio,
                    selectedReason === key && styles.radioSelected,
                  ]}
                >
                  {selectedReason === key && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.reasonText}>{label}</Text>
              </Pressable>
            ))}

            {!!actionError && <ErrorBanner message={actionError} />}

            <Pressable
              style={({ pressed }) => [
                styles.approveBtn,
                (!selectedReason || approving) && styles.btnDisabled,
                pressed && selectedReason && styles.approveBtnPressed,
              ]}
              onPress={handleApprove}
              disabled={!selectedReason || approving}
            >
              {approving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.approveBtnText}>I-approve</Text>
              )}
            </Pressable>
          </View>
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

  amountBlock: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  amountLabel: { fontSize: 13, color: C.textSub, marginBottom: 4 },
  amount: { fontSize: 32, fontWeight: '800', color: C.text },
  interest: { fontSize: 14, color: C.textSub, marginTop: 4 },

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

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 12,
  },

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

  approveHint: {
    fontSize: 13,
    color: C.textSub,
    marginBottom: 16,
    lineHeight: 18,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: C.bg,
  },
  reasonSelected: { backgroundColor: C.primaryLight },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.disabled,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioSelected: { borderColor: C.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  reasonText: { fontSize: 14, color: C.text },

  approveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  approveBtnPressed: { backgroundColor: C.primaryDark },
  btnDisabled: { backgroundColor: C.disabled },
  approveBtnText: { fontSize: 16, fontWeight: '700', color: C.white },
});
