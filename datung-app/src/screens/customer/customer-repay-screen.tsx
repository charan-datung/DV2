import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import type { CustomerStackParamList } from '../../types/navigation';
import { useTransactionDetail } from '../../hooks/use-transactions';
import { transactionService } from '../../services/transaction-service';
import { formatCentavos, pesosToCentavos } from '../../utils/currency';
import { userFriendlyError } from '../../utils/errors';
import LoadingSpinner from '../../components/loading-spinner';
import SuccessModal from '../../components/success-modal';

// ---------------------------------------------------------------------------
// Datung payment details — update these before going live
// ---------------------------------------------------------------------------
const DATUNG_BANK = {
  bankName: 'UnionBank of the Philippines',
  accountName: 'Datung Financial Services',
  accountNumber: '109601234567890',
  instapayEnabled: true,
};

const C = {
  primary: '#0D5C37',
  primaryDark: '#09402A',
  primaryLight: '#E8F5EE',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textSub: '#5E6A7A',
  border: '#D9E2EC',
  error: '#C62828',
  errorBg: '#FFEBEE',
  disabled: '#A8B4C0',
  infoBg: '#EEF4FF',
  infoBorder: '#B3C9F5',
};

type RouteType = RouteProp<CustomerStackParamList, 'CustomerRepay'>;

export default function CustomerRepayScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { transactionId } = route.params;

  const { transaction, isLoading: txnLoading } = useTransactionDetail(transactionId);

  const [method, setMethod] = useState<'bank_qr' | 'otc'>('bank_qr');
  const [referenceNo, setReferenceNo] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  if (txnLoading && !transaction) {
    return <LoadingSpinner message="Nilo-load..." />;
  }

  if (!transaction) return null;

  const totalDue = transaction.amount_centavos + transaction.interest_centavos;

  // Calculate previously paid amount from repayments
  const { repayments } = useTransactionDetail(transactionId);
  const alreadyPaid = repayments.reduce((sum, r) => sum + r.amount_centavos, 0);
  const remainingDue = totalDue - alreadyPaid;

  const paymentAmount = isPartial
    ? pesosToCentavos(parseFloat(customAmount) || 0)
    : remainingDue;
  const isValidPayment = paymentAmount > 0 && paymentAmount <= remainingDue;

  // QR data encodes bank + amount so customer can screenshot and use it
  const amountPesos = (paymentAmount / 100).toFixed(2);
  const qrData = [
    `DATUNG PAYMENT`,
    `Bank: ${DATUNG_BANK.bankName}`,
    `Account Name: ${DATUNG_BANK.accountName}`,
    `Account No: ${DATUNG_BANK.accountNumber}`,
    `Amount: PHP ${amountPesos}`,
    `Ref: TXN-${transactionId.slice(0, 8).toUpperCase()}`,
  ].join('\n');

  const handleShareDetails = async () => {
    try {
      await Share.share({
        message: [
          '📲 Datung Payment Details',
          `Bank: ${DATUNG_BANK.bankName}`,
          `Account Name: ${DATUNG_BANK.accountName}`,
          `Account No: ${DATUNG_BANK.accountNumber}`,
          `Amount: ₱${amountPesos}`,
          `Reference: TXN-${transactionId.slice(0, 8).toUpperCase()}`,
          '',
          'I-InstaPay o i-PESONet ang halagang ito at ilagay ang reference number sa ibaba.',
        ].join('\n'),
      });
    } catch (_) {
      // user dismissed share sheet — no action needed
    }
  };

  const handleSubmit = async () => {
    if (!isValidPayment) return;
    setError('');
    setIsSubmitting(true);

    try {
      await transactionService.submitRepayment({
        transaction_id: transactionId,
        amount_centavos: paymentAmount,
        method,
        reference_no: referenceNo.trim() || undefined,
      });
      setShowSuccess(true);
    } catch (err) {
      setError(userFriendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Bumalik</Text>
          </Pressable>

          <Text style={styles.title}>Magbayad</Text>

          {/* Amount summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Natitirang babayaran</Text>
            <Text style={styles.summaryAmount}>{formatCentavos(remainingDue)}</Text>
            <Text style={styles.summaryBreakdown}>
              {formatCentavos(transaction.amount_centavos)} halaga +{' '}
              {formatCentavos(transaction.interest_centavos)} bayad-dagdag
            </Text>
            {alreadyPaid > 0 && (
              <Text style={[styles.summaryBreakdown, { color: C.primary, fontWeight: '600', marginTop: 4 }]}>
                Nabayaran na: {formatCentavos(alreadyPaid)}
              </Text>
            )}
          </View>

          {/* Partial payment toggle */}
          <View style={[styles.card, { marginBottom: 16 }]}>
            <View style={styles.partialRow}>
              <Pressable
                style={[styles.partialOption, !isPartial && styles.partialSelected]}
                onPress={() => { setIsPartial(false); setCustomAmount(''); }}
              >
                <Text style={[styles.partialText, !isPartial && styles.partialTextActive]}>
                  Buong bayad
                </Text>
              </Pressable>
              <Pressable
                style={[styles.partialOption, isPartial && styles.partialSelected]}
                onPress={() => setIsPartial(true)}
              >
                <Text style={[styles.partialText, isPartial && styles.partialTextActive]}>
                  Partial
                </Text>
              </Pressable>
            </View>

            {isPartial && (
              <>
                <Text style={styles.label}>Halaga ng babayaran (Pesos)</Text>
                <TextInput
                  style={styles.input}
                  value={customAmount}
                  onChangeText={(t) => setCustomAmount(t.replace(/[^0-9.]/g, ''))}
                  placeholder={`Max: ${formatCentavos(remainingDue)}`}
                  placeholderTextColor={C.disabled}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                {paymentAmount > remainingDue && (
                  <Text style={styles.errorText}>
                    Lumagpas sa natitirang {formatCentavos(remainingDue)}.
                  </Text>
                )}
              </>
            )}
          </View>

          {/* Payment method */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Paraan ng Bayad</Text>

            {/* Bank Transfer / QR option */}
            <Pressable
              style={[styles.methodOption, method === 'bank_qr' && styles.methodSelected]}
              onPress={() => setMethod('bank_qr')}
            >
              <View style={[styles.radio, method === 'bank_qr' && styles.radioSelected]}>
                {method === 'bank_qr' && <View style={styles.radioInner} />}
              </View>
              <View>
                <Text style={styles.methodTitle}>Bank Transfer / QR</Text>
                <Text style={styles.methodDesc}>InstaPay, PESONet, o online banking</Text>
              </View>
            </Pressable>

            {/* Cash at store option */}
            <Pressable
              style={[styles.methodOption, method === 'otc' && styles.methodSelected]}
              onPress={() => setMethod('otc')}
            >
              <View style={[styles.radio, method === 'otc' && styles.radioSelected]}>
                {method === 'otc' && <View style={styles.radioInner} />}
              </View>
              <View>
                <Text style={styles.methodTitle}>Cash sa Tindahan (OTC)</Text>
                <Text style={styles.methodDesc}>Magbayad ng cash sa tindahan</Text>
              </View>
            </Pressable>

            {/* Bank QR details panel */}
            {method === 'bank_qr' && (
              <View style={styles.bankPanel}>
                {/* QR code */}
                <View style={styles.qrContainer}>
                  <QRCode
                    value={qrData}
                    size={180}
                    color={C.text}
                    backgroundColor={C.white}
                  />
                  <Text style={styles.qrHint}>I-screenshot ang QR na ito para sa pagbabayad</Text>
                </View>

                {/* Bank details */}
                <View style={styles.bankDetails}>
                  <Text style={styles.bankDetailsTitle}>Detalye ng Account</Text>
                  <View style={styles.bankRow}>
                    <Text style={styles.bankLabel}>Bangko</Text>
                    <Text style={styles.bankValue}>{DATUNG_BANK.bankName}</Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={styles.bankLabel}>Pangalan</Text>
                    <Text style={styles.bankValue}>{DATUNG_BANK.accountName}</Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={styles.bankLabel}>Account No.</Text>
                    <Text style={[styles.bankValue, styles.bankAcctNo]}>
                      {DATUNG_BANK.accountNumber}
                    </Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={styles.bankLabel}>Halaga</Text>
                    <Text style={[styles.bankValue, { color: C.primary, fontWeight: '700' }]}>
                      ₱{amountPesos}
                    </Text>
                  </View>
                </View>

                {/* Info note */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    💡 Gamitin ang InstaPay o PESONet sa iyong banking app. Pagkatapos
                    magpadala, ilagay ang reference number sa ibaba at pindutin ang "Bayaran".
                  </Text>
                </View>

                {/* Share button */}
                <Pressable style={styles.shareBtn} onPress={handleShareDetails}>
                  <Text style={styles.shareBtnText}>📤  I-share ang Detalye ng Bayad</Text>
                </Pressable>
              </View>
            )}

            {/* Reference number */}
            <Text style={styles.label}>
              {method === 'bank_qr' ? 'Reference Number ng Transfer' : 'Resibo # (opsyonal)'}
            </Text>
            <TextInput
              style={styles.input}
              value={referenceNo}
              onChangeText={setReferenceNo}
              placeholder={method === 'bank_qr' ? 'InstaPay / PESONet ref #' : 'Resibo #'}
              placeholderTextColor={C.disabled}
              editable={!isSubmitting}
              autoCapitalize="characters"
            />

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                (isSubmitting || !isValidPayment) && styles.btnDisabled,
                pressed && isValidPayment && !isSubmitting && styles.btnPressed,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || !isValidPayment}
            >
              {isSubmitting ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.btnText}>
                  Bayaran — {formatCentavos(paymentAmount)}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={showSuccess}
        title="Bayad na!"
        message="Matagumpay ang iyong bayad. Salamat sa on-time na pagbabayad!"
        onClose={() => {
          setShowSuccess(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { paddingBottom: 40 },
  backBtn: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backText: { fontSize: 14, color: C.primary, fontWeight: '600' },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  summaryCard: {
    backgroundColor: C.primaryLight,
    borderRadius: 14,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 13, color: C.textSub, marginBottom: 4 },
  summaryAmount: { fontSize: 28, fontWeight: '800', color: C.primary },
  summaryBreakdown: { fontSize: 12, color: C.textSub, marginTop: 6 },

  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },

  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    backgroundColor: C.bg,
    marginBottom: 8,
  },
  methodSelected: { backgroundColor: C.primaryLight },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.disabled,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  radioSelected: { borderColor: C.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  methodTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  methodDesc: { fontSize: 12, color: C.textSub, marginTop: 2 },

  // Bank QR panel
  bankPanel: {
    marginTop: 8,
    marginBottom: 4,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 20,
    marginBottom: 12,
  },
  qrHint: {
    fontSize: 11,
    color: C.textSub,
    marginTop: 10,
    textAlign: 'center',
  },
  bankDetails: {
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  bankDetailsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginBottom: 10,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  bankLabel: { fontSize: 12, color: C.textSub, flex: 1 },
  bankValue: { fontSize: 13, color: C.text, fontWeight: '600', flex: 2, textAlign: 'right' },
  bankAcctNo: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 },

  infoBox: {
    backgroundColor: C.infoBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.infoBorder,
    padding: 12,
    marginBottom: 12,
  },
  infoText: { fontSize: 12, color: '#2C4A8A', lineHeight: 18 },

  shareBtn: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 8,
  },
  shareBtnText: { fontSize: 14, fontWeight: '600', color: C.primary },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: C.text,
  },

  errorBox: {
    backgroundColor: C.errorBg,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: { fontSize: 13, color: C.error },

  btn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  btnPressed: { backgroundColor: C.primaryDark },
  btnDisabled: { backgroundColor: C.disabled },
  btnText: { fontSize: 16, fontWeight: '700', color: C.white },

  partialRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  partialOption: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.border,
  },
  partialSelected: { borderColor: C.primary, backgroundColor: C.primaryLight },
  partialText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  partialTextActive: { color: C.primary },
});
