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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { CustomerStackParamList } from '../../types/navigation';
import { useTransactionDetail } from '../../hooks/use-transactions';
import { transactionService } from '../../services/transaction-service';
import { formatCentavos } from '../../utils/currency';
import { userFriendlyError } from '../../utils/errors';
import LoadingSpinner from '../../components/loading-spinner';
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
};

type RouteType = RouteProp<CustomerStackParamList, 'CustomerRepay'>;

export default function CustomerRepayScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { transactionId } = route.params;

  const { transaction, isLoading: txnLoading } = useTransactionDetail(transactionId);

  const [method, setMethod] = useState<'gcash' | 'otc'>('gcash');
  const [referenceNo, setReferenceNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  if (txnLoading && !transaction) {
    return <LoadingSpinner message="Nilo-load..." />;
  }

  if (!transaction) return null;

  const totalDue = transaction.amount_centavos + transaction.interest_centavos;

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      await transactionService.submitRepayment({
        transaction_id: transactionId,
        amount_centavos: totalDue,
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
            <Text style={styles.summaryLabel}>Total na babayaran</Text>
            <Text style={styles.summaryAmount}>{formatCentavos(totalDue)}</Text>
            <Text style={styles.summaryBreakdown}>
              {formatCentavos(transaction.amount_centavos)} halaga +{' '}
              {formatCentavos(transaction.interest_centavos)} bayad-dagdag
            </Text>
          </View>

          {/* Payment method */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Paraan ng Bayad</Text>

            <Pressable
              style={[styles.methodOption, method === 'gcash' && styles.methodSelected]}
              onPress={() => setMethod('gcash')}
            >
              <View style={[styles.radio, method === 'gcash' && styles.radioSelected]}>
                {method === 'gcash' && <View style={styles.radioInner} />}
              </View>
              <View>
                <Text style={styles.methodTitle}>GCash</Text>
                <Text style={styles.methodDesc}>Magpadala gamit ang GCash app</Text>
              </View>
            </Pressable>

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

            {/* Reference number */}
            <Text style={styles.label}>Reference Number (opsyonal)</Text>
            <TextInput
              style={styles.input}
              value={referenceNo}
              onChangeText={setReferenceNo}
              placeholder={method === 'gcash' ? 'GCash reference #' : 'Resibo #'}
              placeholderTextColor={C.disabled}
              editable={!isSubmitting}
            />

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                isSubmitting && styles.btnDisabled,
                pressed && !isSubmitting && styles.btnPressed,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.btnText}>
                  Bayaran — {formatCentavos(totalDue)}
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
});
