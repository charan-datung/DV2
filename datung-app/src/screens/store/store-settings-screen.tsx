import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useMyStore } from '../../hooks/use-store';
import { storeService } from '../../services/store-service';
import { useAuthStore } from '../../stores/auth-store';
import { formatCentavos } from '../../utils/currency';
import { userFriendlyError } from '../../utils/errors';
import LoadingSpinner from '../../components/loading-spinner';
import StoreQRModal, { buildStoreQRValue } from '../../components/store-qr-modal';

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
  disabled: '#A8B4C0',
};

export default function StoreSettingsScreen() {
  const { store, isLoading: storeLoading, refetch } = useMyStore();
  const { logout } = useAuthStore();

  const [name, setName] = useState(store?.name ?? '');
  const [address, setAddress] = useState(store?.address ?? '');
  const [barangay, setBarangay] = useState(store?.barangay ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Sync form when store loads
  React.useEffect(() => {
    if (store) {
      setName(store.name);
      setAddress(store.address);
      setBarangay(store.barangay);
    }
  }, [store]);

  if (storeLoading && !store) {
    return <LoadingSpinner message="Nilo-load..." />;
  }

  const handleSave = async () => {
    if (!store) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await storeService.updateStore(store.id, {
        name: name.trim(),
        address: address.trim(),
        barangay: barangay.trim(),
      });
      await refetch();
      setSaved(true);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(userFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Mag-logout?', 'Sigurado ka bang gusto mong mag-logout?', [
      { text: 'Hindi', style: 'cancel' },
      {
        text: 'Oo, mag-logout',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Mga Setting</Text>

        {/* Store QR Code */}
        {store && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>QR Code ng Tindahan</Text>
            <Text style={[styles.label, { marginTop: 0, marginBottom: 16 }]}>
              Ipakita ito sa mga customer para i-scan at mag-request ng transaksyon.
            </Text>

            {/* Inline QR preview */}
            <View style={styles.qrContainer}>
              <Pressable
                style={({ pressed }) => [styles.qrTouchable, pressed && { opacity: 0.85 }]}
                onPress={() => setShowQR(true)}
              >
                <QRCode
                  value={buildStoreQRValue(store.id)}
                  size={180}
                  color={C.primary}
                  backgroundColor={C.white}
                />
              </Pressable>
              <Text style={styles.qrTapHint}>Pindutin para palakihin</Text>
            </View>

            {/* Store ID for manual entry fallback */}
            <View style={styles.storeIdBox}>
              <Text style={styles.storeIdLabel}>Store ID (para sa manual entry):</Text>
              <Text style={styles.storeIdValue} selectable>{store.id}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.showQRBtn, pressed && styles.showQRBtnPressed]}
              onPress={() => setShowQR(true)}
            >
              <Text style={styles.showQRBtnText}>Palakihin ang QR Code</Text>
            </Pressable>
          </View>
        )}

        {/* Full-screen QR modal */}
        {store && (
          <StoreQRModal
            visible={showQR}
            storeName={store.name}
            storeId={store.id}
            onClose={() => setShowQR(false)}
          />
        )}

        {/* Store info card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Impormasyon ng Tindahan</Text>

          <Text style={styles.label}>Pangalan</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => { setName(t); setSaved(false); }}
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={(t) => { setAddress(t); setSaved(false); }}
          />

          <Text style={styles.label}>Barangay</Text>
          <TextInput
            style={styles.input}
            value={barangay}
            onChangeText={(t) => { setBarangay(t); setSaved(false); }}
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {saved && <Text style={styles.savedText}>Na-save na!</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              saving && styles.btnDisabled,
              pressed && !saving && styles.saveBtnPressed,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={styles.saveBtnText}>I-save</Text>
            )}
          </Pressable>
        </View>

        {/* Account info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <InfoRow label="Status" value={store?.status ?? '-'} />
          <InfoRow label="Tier" value={`Tier ${store?.tier ?? 1}`} />
          <InfoRow label="Settlement" value={store?.settlement_type === 'same_day' ? 'Same Day' : '48 Hours'} />
          <InfoRow label="Credit Line" value={formatCentavos(store?.credit_line ?? 0)} />
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Mag-logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
    marginTop: 12,
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
  errorText: {
    fontSize: 13,
    color: C.error,
    marginTop: 12,
  },
  savedText: {
    fontSize: 13,
    color: C.primary,
    fontWeight: '600',
    marginTop: 12,
  },
  saveBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveBtnPressed: { backgroundColor: C.primaryDark },
  btnDisabled: { backgroundColor: C.disabled },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  infoLabel: { fontSize: 13, color: C.textSub },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.text },

  logoutBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
  },
  logoutBtnPressed: { backgroundColor: '#FFCDD2' },
  logoutText: { fontSize: 15, fontWeight: '700', color: C.error },

  qrContainer: { alignItems: 'center', paddingVertical: 8 },
  qrTouchable: {
    padding: 16,
    backgroundColor: C.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 8,
  },
  qrTapHint: { fontSize: 12, color: C.disabled, marginBottom: 12 },
  storeIdBox: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  storeIdLabel: { fontSize: 11, color: C.textSub, marginBottom: 4 },
  storeIdValue: { fontSize: 12, color: C.text, fontFamily: 'monospace' },
  showQRBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showQRBtnPressed: { backgroundColor: C.primaryLight },
  showQRBtnText: { fontSize: 14, fontWeight: '700', color: C.primary },
});
