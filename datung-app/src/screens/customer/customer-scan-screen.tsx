import React, { useCallback, useState } from 'react';
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMyCustomer, useActiveTransactions } from '../../hooks/use-customer';
import {
  customerService,
  getMaxTransaction,
  getTermDays,
} from '../../services/customer-service';
import { parseStoreQRValue } from '../../components/store-qr-modal';
import { calculateInterest, formatCentavos, pesosToCentavos } from '../../utils/currency';
import { getTodayManila, addDays } from '../../utils/date';
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
  scanOverlay: 'rgba(0,0,0,0.6)',
};

/** Allow only one decimal point */
function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex === -1) return cleaned;
  return cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '');
}

// ---------------------------------------------------------------------------
// Camera scanner view
// ---------------------------------------------------------------------------
function QRScanner({
  onScanned,
  onClose,
}: {
  onScanned: (storeId: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;
      const storeId = parseStoreQRValue(data);
      if (storeId) {
        setScanned(true);
        onScanned(storeId);
      }
    },
    [scanned, onScanned],
  );

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={scanStyles.permBox}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={scanStyles.permBox}>
        <Text style={scanStyles.permTitle}>Kailangan ng Camera</Text>
        <Text style={scanStyles.permSub}>
          Para ma-scan ang QR code ng tindahan, kailangan ang pahintulot sa camera.
        </Text>
        <Pressable
          style={({ pressed }) => [scanStyles.permBtn, pressed && { opacity: 0.8 }]}
          onPress={requestPermission}
        >
          <Text style={scanStyles.permBtnText}>Payagan ang Camera</Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ marginTop: 12 }}>
          <Text style={{ color: C.textSub, fontSize: 14 }}>Kanselahin</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={scanStyles.container}>
      <CameraView
        style={scanStyles.camera}
        facing="back"
        onBarcodeScanned={handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        {/* Dark overlay with cutout */}
        <View style={scanStyles.overlay}>
          <View style={scanStyles.overlayTop} />
          <View style={scanStyles.overlayMiddle}>
            <View style={scanStyles.overlaySide} />
            <View style={scanStyles.cutout}>
              {/* Corner brackets */}
              <View style={[scanStyles.bracket, scanStyles.bracketTL]} />
              <View style={[scanStyles.bracket, scanStyles.bracketTR]} />
              <View style={[scanStyles.bracket, scanStyles.bracketBL]} />
              <View style={[scanStyles.bracket, scanStyles.bracketBR]} />
            </View>
            <View style={scanStyles.overlaySide} />
          </View>
          <View style={scanStyles.overlayBottom}>
            <Text style={scanStyles.scanHint}>
              I-align ang QR code ng tindahan sa loob ng kahon
            </Text>
            <Pressable
              style={({ pressed }) => [scanStyles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={onClose}
            >
              <Text style={scanStyles.cancelText}>Kanselahin</Text>
            </Pressable>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const CUTOUT = 240;
const BRACKET = 28;
const THICKNESS = 4;

const scanStyles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  permBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 10 },
  permSub: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  permBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: C.primary,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnText: { fontSize: 15, fontWeight: '700', color: C.white },
  overlay: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: C.scanOverlay },
  overlayMiddle: { flexDirection: 'row', height: CUTOUT },
  overlaySide: { flex: 1, backgroundColor: C.scanOverlay },
  cutout: {
    width: CUTOUT,
    height: CUTOUT,
    backgroundColor: 'transparent',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: C.scanOverlay,
    alignItems: 'center',
    paddingTop: 24,
  },
  scanHint: {
    color: C.white,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    opacity: 0.9,
  },
  cancelBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  cancelText: { color: C.white, fontSize: 15, fontWeight: '600' },
  bracket: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
    borderColor: C.white,
  },
  bracketTL: {
    top: 0, left: 0,
    borderTopWidth: THICKNESS, borderLeftWidth: THICKNESS, borderTopLeftRadius: 4,
  },
  bracketTR: {
    top: 0, right: 0,
    borderTopWidth: THICKNESS, borderRightWidth: THICKNESS, borderTopRightRadius: 4,
  },
  bracketBL: {
    bottom: 0, left: 0,
    borderBottomWidth: THICKNESS, borderLeftWidth: THICKNESS, borderBottomLeftRadius: 4,
  },
  bracketBR: {
    bottom: 0, right: 0,
    borderBottomWidth: THICKNESS, borderRightWidth: THICKNESS, borderBottomRightRadius: 4,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function CustomerScanScreen() {
  const { customer } = useMyCustomer();
  const { transactions: activeTxns } = useActiveTransactions();

  const [mode, setMode] = useState<'scanner' | 'manual'>('scanner');
  const [storeId, setStoreId] = useState('');
  const [scannedStoreName, setScannedStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const level = customer?.level ?? 0;
  const maxCentavos = getMaxTransaction(level);
  const termDays = getTermDays(level);

  const totalOutstanding = (activeTxns ?? [])
    .filter((t) => t.status === 'approved' || t.status === 'settled')
    .reduce((sum: number, t) => sum + t.amount_centavos, 0);
  const availableCentavos = Math.max(0, maxCentavos - totalOutstanding);

  const parsedAmount = parseFloat(amount);
  const amountCentavos = isNaN(parsedAmount) ? 0 : pesosToCentavos(parsedAmount);
  const isValidAmount = amountCentavos > 0 && amountCentavos <= availableCentavos;
  const interestCentavos = isValidAmount ? calculateInterest(amountCentavos, termDays) : 0;

  const isBlocked = customer?.status === 'blocked' || customer?.status === 'suspended';
  const isFrozen = customer?.status === 'frozen';
  const canTransact = !isBlocked && !isFrozen;

  const canSubmit = storeId.trim().length > 0 && isValidAmount && !isLoading && !isValidating && canTransact;

  // Called when QR scanner reads a valid store QR
  const handleScanned = useCallback(async (id: string) => {
    setError('');
    setIsValidating(true);
    setMode('manual'); // switch to form view
    setStoreId(id);

    try {
      const store = await customerService.validateStore(id);
      if (!store) {
        setError('Hindi mahanap ang tindahan. Subukan muli.');
        setStoreId('');
      } else if (store.status !== 'active') {
        setError('Hindi aktibo ang tindahang ito.');
        setStoreId('');
      } else {
        setScannedStoreName(store.name);
      }
    } catch {
      setError('Hindi ma-verify ang tindahan. Suriin ang koneksyon.');
      setStoreId('');
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit || !customer) return;
    setError('');
    setIsLoading(true);

    try {
      const store = await customerService.validateStore(storeId.trim());
      if (!store) {
        setError('Hindi mahanap ang tindahan. Subukan muli.');
        return;
      }
      if (store.status !== 'active') {
        setError('Hindi aktibo ang tindahang ito.');
        return;
      }

      const dueDateStr = addDays(getTodayManila(), termDays);
      await customerService.requestTransaction({
        store_id: store.id,
        customer_id: customer.id,
        amount_centavos: amountCentavos,
        interest_centavos: interestCentavos,
        due_date: dueDateStr,
      });
      setShowSuccess(true);
      setStoreId('');
      setScannedStoreName('');
      setAmount('');
    } catch (err) {
      setError(userFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Camera scanner mode — full screen
  // ------------------------------------------------------------------
  if (mode === 'scanner' && canTransact) {
    // On web, camera scanning may not work — fall back gracefully
    if (Platform.OS === 'web') {
      // Fall through to manual entry on web
    } else {
      return (
        <QRScanner
          onScanned={handleScanned}
          onClose={() => setMode('manual')}
        />
      );
    }
  }

  // ------------------------------------------------------------------
  // Manual entry / transaction form
  // ------------------------------------------------------------------
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

          {/* Outstanding balance info */}
          {canTransact && totalOutstanding > 0 && (
            <View style={styles.balanceCard}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Outstanding</Text>
                <Text style={styles.balanceValue}>{formatCentavos(totalOutstanding)}</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Available pa</Text>
                <Text style={[styles.balanceValue, { color: C.primary }]}>
                  {formatCentavos(availableCentavos)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.card}>
            {/* Store ID section */}
            {storeId && scannedStoreName ? (
              // Scanned successfully — show store name with option to rescan
              <View style={styles.scannedStore}>
                <View style={styles.scannedStoreInfo}>
                  <Text style={styles.scannedLabel}>Tindahan</Text>
                  <Text style={styles.scannedName}>{scannedStoreName}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.rescanBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    setStoreId('');
                    setScannedStoreName('');
                    setError('');
                    if (Platform.OS !== 'web') setMode('scanner');
                  }}
                >
                  <Text style={styles.rescanText}>
                    {Platform.OS === 'web' ? 'Baguhin' : 'I-scan ulit'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              // No store scanned — show scan button + manual entry
              <>
                {Platform.OS !== 'web' && (
                  <Pressable
                    style={({ pressed }) => [styles.scanBtn, pressed && styles.scanBtnPressed]}
                    onPress={() => { setError(''); setMode('scanner'); }}
                    disabled={!canTransact}
                  >
                    <Text style={styles.scanBtnIcon}>⬛</Text>
                    <Text style={styles.scanBtnText}>I-scan ang QR ng Tindahan</Text>
                  </Pressable>
                )}

                <Text style={styles.orDivider}>
                  {Platform.OS === 'web' ? 'Ilagay ang Store ID:' : '— o manual entry —'}
                </Text>

                <Text style={styles.label}>Store ID</Text>
                <View style={styles.storeIdRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={storeId}
                    onChangeText={(t) => { setStoreId(t); setError(''); setScannedStoreName(''); }}
                    placeholder="Paste ang Store ID dito"
                    placeholderTextColor={C.disabled}
                    editable={!isLoading && !isValidating}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {storeId.trim().length > 0 && (
                    <Pressable
                      style={({ pressed }) => [styles.verifyBtn, pressed && { opacity: 0.8 }]}
                      onPress={() => handleScanned(storeId.trim())}
                      disabled={isValidating}
                    >
                      {isValidating
                        ? <ActivityIndicator color={C.white} size="small" />
                        : <Text style={styles.verifyBtnText}>I-verify</Text>
                      }
                    </Pressable>
                  )}
                </View>
              </>
            )}

            {/* Amount input — only show after store is confirmed */}
            {(storeId && scannedStoreName) || (storeId && Platform.OS === 'web') ? (
              <>
                <Text style={styles.label}>Halaga (Pesos)</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={(t) => { setAmount(sanitizeDecimal(t)); setError(''); }}
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
                      label={`Bayad-dagdag (${termDays} araw @ 6%/buwan)`}
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
                    </Text>
                  </View>
                )}
              </>
            ) : null}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {canTransact && (storeId || Platform.OS === 'web') && (
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
                  <Text style={styles.btnText}>Mag-request ng Bayad-alin</Text>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={showSuccess}
        title="Na-submit na!"
        message={`Hinihintay ang approval ng ${scannedStoreName || 'tindahan'}. Makikita mo ang status sa Home screen.`}
        onClose={() => {
          setShowSuccess(false);
          if (Platform.OS !== 'web') setMode('scanner');
        }}
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
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 16 },

  balanceCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  balanceLabel: { fontSize: 13, color: C.textSub },
  balanceValue: { fontSize: 13, fontWeight: '700', color: C.text },

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

  // Scan button
  scanBtn: {
    height: 64,
    borderRadius: 14,
    backgroundColor: C.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 4,
  },
  scanBtnPressed: { backgroundColor: C.primaryDark },
  scanBtnIcon: { fontSize: 22, color: C.white },
  scanBtnText: { fontSize: 16, fontWeight: '700', color: C.white },

  orDivider: {
    textAlign: 'center',
    fontSize: 12,
    color: C.textSub,
    marginVertical: 14,
  },

  // Scanned store display
  scannedStore: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  scannedStoreInfo: { flex: 1 },
  scannedLabel: { fontSize: 11, color: C.primary, fontWeight: '600', marginBottom: 2 },
  scannedName: { fontSize: 16, fontWeight: '700', color: C.text },
  rescanBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  rescanText: { fontSize: 12, fontWeight: '700', color: C.primary },

  // Store ID row with verify button
  storeIdRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  verifyBtn: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: { fontSize: 13, fontWeight: '700', color: C.white },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
    marginTop: 16,
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
  summaryLabel: { fontSize: 13, color: C.textSub, flex: 1, marginRight: 8 },
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
  errorText: { fontSize: 13, color: C.error, lineHeight: 18 },

  btn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  btnPressed: { backgroundColor: C.primaryDark },
  btnDisabled: { backgroundColor: C.disabled },
  btnText: { fontSize: 15, fontWeight: '700', color: C.white },
});
