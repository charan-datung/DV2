import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMyCustomer, useActiveTransactions } from '../../hooks/use-customer';
import {
  customerService,
  getMaxTransaction,
  getTermDays,
} from '../../services/customer-service';
import { calculateInterest, formatCentavos, pesosToCentavos } from '../../utils/currency';
import { userFriendlyError } from '../../utils/errors';
import SuccessModal from '../../components/success-modal';

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
  warning: '#E65100',
  warningBg: '#FFF3E0',
};

/** Sanitize decimal input — only allow one decimal point */
function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 2) return cleaned;
  return parts[0] + '.' + parts.slice(1).join('');
}

export default function CustomerScanScreen() {
  const { customer } = useMyCustomer();
  const { transactions: activeTxns } = useActiveTransactions();
  const [storeId, setStoreId] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const level = customer?.level ?? 0;
  const maxCentavos = getMaxTransaction(level);
  const termDays = getTermDays(level);

  // Global outstanding balance (approved + settled transactions)
  const totalOutstanding = (activeTxns ?? [])
    .filter((t) => t.status === 'approved' || t.status === 'settled')
    .reduce((sum: number, t: any) => sum + t.amount_centavos, 0);
  const availableCentavos = Math.max(0, maxCentavos - totalOutstanding);

  const amountCentavos = pesosToCentavos(parseFloat(amount) || 0);
  const isValidAmount = amountCentavos > 0 && amountCentavos <= availableCentavos;
  const interestCentavos = isValidAmount ? calculateInterest(amountCentavos, termDays) : 0;

  // Status guards
  const isBlocked = customer?.status === 'blocked' || customer?.status === 'suspended';
  const isFrozen = customer?.status === 'frozen';
  const canTransact = !isBlocked && !isFrozen;

  const canSubmit = storeId.trim().length > 0 && isValidAmount && !isLoading && canTransact;

  const handleSubmit = async () => {
    if (!canSubmit || !customer) return;
    setError('');
    setIsLoading(true);

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + termDays);
    const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      await customerService.requestTransaction({
        store_id: storeId.trim(),
        customer_id: customer.id,
        amount_centavos: amountCentavos,
        interest_centavos: interestCentavos,
        due_date: dueDateStr,
      });
      setShowSuccess(true);
      setStoreId('');
      setAmount('');
    } catch (err) {
      setError(userFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Bagong Transaksyon</Text>
          <Text style={styles.subtitle}>
            I-enter ang Store ID at ang halaga na gusto mong gamitin.
          </Text>

          {/* Status guard banners */}
          {isBlocked && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                Hindi ka maaaring mag-transact. Naka-block o naka-suspend ang iyong account.
              </Text>
            </View>
          )}
          {isFrozen && !isBlocked && (
            <View style={[styles.errorBox, { backgroundColor: C.warningBg }]}>
              <Text style={[styles.errorText, { color: C.warning }]}>
                Naka-freeze ang iyong account. Bayaran muna ang overdue na balanse.
              </Text>
            </View>
          )}

          {/* Available balance info */}
          {canTransact && totalOutstanding > 0 && (
            <View style={[styles.summary, { marginBottom: 16, marginTop: 0 }]}>
              <SummaryRow label="Outstanding" value={formatCentavos(totalOutstanding)} />
              <SummaryRow label="Available pa" value={formatCentavos(availableCentavos)} />
            </View>
          )}

          {/* QR placeholder / manual entry */}
          <View style={styles.card}>
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrIcon}>⎕</Text>
              <Text style={styles.qrText}>
                QR Scanner (available sa production build)
              </Text>
            </View>

            <Text style={styles.orText}>o kaya manual entry:</Text>

            <Text style={styles.label}>Store ID</Text>
            <TextInput
              style={styles.input}
              value={storeId}
              onChangeText={setStoreId}
              placeholder="Paste ang Store ID dito"
              placeholderTextColor={C.disabled}
              editable={!isLoading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Halaga (Pesos)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(t) => setAmount(sanitizeDecimal(t))}
              placeholder={`Max: ${formatCentavos(availableCentavos)}`}
              placeholderTextColor={C.disabled}
              keyboardType="decimal-pad"
              editable={!isLoading}
            />

            {/* Summary */}
            {isValidAmount && (
              <View style={styles.summary}>
                <SummaryRow label="Halaga" value={formatCentavos(amountCentavos)} />
                <SummaryRow
                  label={`Bayad-dagdag (${termDays} araw)`}
                  value={formatCentavos(interestCentavos)}
                />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total na babayaran</Text>
                  <Text style={styles.totalValue}>
                    {formatCentavos(amountCentavos + interestCentavos)}
                  </Text>
                </View>
                <Text style={styles.termNote}>
                  Due date: {termDays} araw mula ngayon
                </Text>
              </View>
            )}

            {amountCentavos > availableCentavos && amountCentavos > 0 && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  Lumagpas sa available na {formatCentavos(availableCentavos)} para sa Level {level}.
                  {totalOutstanding > 0 ? ` May outstanding ka pang ${formatCentavos(totalOutstanding)}.` : ''}
                </Text>
              </View>
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                !canSubmit && styles.btnDisabled,
                pressed && canSubmit && styles.btnPressed,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {isLoading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.btnText}>Mag-request</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={showSuccess}
        title="Na-submit na!"
        message="Hinihintay ang approval ng tindahan. Makikita mo ang status sa Home screen."
        onClose={() => setShowSuccess(false)}
      />
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.textSub, marginBottom: 20, lineHeight: 20 },

  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  qrPlaceholder: {
    height: 120,
    backgroundColor: C.bg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  qrIcon: { fontSize: 36, color: C.disabled, marginBottom: 6 },
  qrText: { fontSize: 12, color: C.textSub },
  orText: {
    textAlign: 'center',
    fontSize: 12,
    color: C.textSub,
    marginBottom: 16,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.text,
  },

  summary: {
    backgroundColor: C.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 13, color: C.textSub },
  summaryValue: { fontSize: 13, fontWeight: '600', color: C.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#C8E6C9',
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  totalValue: { fontSize: 14, fontWeight: '800', color: C.primary },
  termNote: { fontSize: 12, color: C.textSub, marginTop: 8 },

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
});
