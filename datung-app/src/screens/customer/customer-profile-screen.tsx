import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useMyCustomer } from '../../hooks/use-customer';
import { useAuthStore } from '../../stores/auth-store';
import { formatCentavos } from '../../utils/currency';
import { customerService, getMaxTransaction } from '../../services/customer-service';
import { userFriendlyError } from '../../utils/errors';
import LoadingSpinner from '../../components/loading-spinner';

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
  errorLight: '#FFEBEE',
  disabled: '#A8B4C0',
  accent: '#F4A200',
  blue: '#1565C0',
  blueLight: '#E3F2FD',
  success: '#2E7D32',
  successLight: '#E8F5E9',
};

// Level config for display
const LEVEL_INFO: Record<number, { label: string; maxPeso: string; color: string; bgColor: string }> = {
  0: { label: 'Level 0', maxPeso: '₱500', color: '#5E6A7A', bgColor: '#F5F7FA' },
  1: { label: 'Level 1', maxPeso: '₱500', color: C.blue, bgColor: C.blueLight },
  2: { label: 'Level 2', maxPeso: '₱2,000', color: '#6A1B9A', bgColor: '#F3E5F5' },
  3: { label: 'Level 3', maxPeso: '₱5,000', color: '#E65100', bgColor: '#FFF3E0' },
  4: { label: 'Level 4', maxPeso: '₱10,000', color: C.primary, bgColor: C.primaryLight },
};

const LEVEL_NEXT_REQ: Record<number, string> = {
  0: '2 on-time na bayad para sa Level 1',
  1: '5 on-time na bayad para sa Level 2',
  2: '10 on-time na bayad + valid ID para sa Level 3',
  3: '20 on-time na bayad para sa Level 4',
  4: 'Pinakamataas na level na',
};

export default function CustomerProfileScreen() {
  const { customer, isLoading, refetch } = useMyCustomer();
  const { logout } = useAuthStore();

  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);
  const [selfieError, setSelfieError] = useState('');
  const [idError, setIdError] = useState('');

  if (isLoading && !customer) {
    return <LoadingSpinner message="Nilo-load ang profile..." />;
  }

  if (!customer) return null;

  const level = customer.level ?? 0;
  const levelInfo = LEVEL_INFO[level] ?? LEVEL_INFO[0];

  // -------------------------------------------------------------------------
  // Image picking helpers
  // -------------------------------------------------------------------------
  async function requestPermission(type: 'camera' | 'library'): Promise<boolean> {
    if (Platform.OS === 'web') return true; // web uses native file picker

    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Kailangan ng pahintulot',
          'Bigyan ang app ng pahintulot na gamitin ang camera sa Settings ng iyong telepono.',
        );
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Kailangan ng pahintulot',
          'Bigyan ang app ng pahintulot na ma-access ang gallery sa Settings ng iyong telepono.',
        );
        return false;
      }
    }
    return true;
  }

  async function pickImage(source: 'camera' | 'gallery'): Promise<string | null> {
    const hasPermission = await requestPermission(source === 'camera' ? 'camera' : 'library');
    if (!hasPermission) return null;

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: source === 'camera' ? [1, 1] : [4, 3],
      quality: 0.8,
    };

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  }

  // -------------------------------------------------------------------------
  // Upload handlers
  // -------------------------------------------------------------------------
  const handleUploadSelfie = async (source: 'camera' | 'gallery') => {
    setSelfieError('');
    const uri = await pickImage(source);
    if (!uri) return;

    setUploadingSelfie(true);
    try {
      await customerService.uploadSelfie(customer.id, uri);
      await refetch();
    } catch (err) {
      setSelfieError(userFriendlyError(err));
    } finally {
      setUploadingSelfie(false);
    }
  };

  const handleUploadId = async () => {
    setIdError('');
    const uri = await pickImage('gallery');
    if (!uri) return;

    setUploadingId(true);
    try {
      await customerService.uploadIdPhoto(customer.id, uri);
      await refetch();
    } catch (err) {
      setIdError(userFriendlyError(err));
    } finally {
      setUploadingId(false);
    }
  };

  const handleShowSelfieOptions = () => {
    if (Platform.OS === 'web') {
      handleUploadSelfie('gallery');
      return;
    }
    Alert.alert('Mag-upload ng Selfie', 'Piliin ang pinagkukunan ng larawan', [
      { text: 'Camera', onPress: () => handleUploadSelfie('camera') },
      { text: 'Gallery', onPress: () => handleUploadSelfie('gallery') },
      { text: 'Kanselahin', style: 'cancel' },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Mag-logout?', 'Sigurado ka bang gusto mong mag-logout?', [
      { text: 'Hindi', style: 'cancel' },
      { text: 'Oo, mag-logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Profile</Text>

        {/* Level badge + info */}
        <View style={[styles.levelCard, { backgroundColor: levelInfo.bgColor }]}>
          <View style={styles.levelRow}>
            <View>
              <Text style={[styles.levelLabel, { color: levelInfo.color }]}>
                {levelInfo.label}
              </Text>
              <Text style={styles.customerName}>{customer.name}</Text>
              <Text style={styles.customerPhone}>{customer.phone}</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={[styles.levelBadgeText, { color: levelInfo.color }]}>
                {levelInfo.maxPeso}
              </Text>
              <Text style={styles.levelBadgeSub}>max</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              {customer.on_time_repayment_count} on-time na bayad
            </Text>
          </View>
          {level < 4 && (
            <Text style={styles.nextLevel}>
              Susunod: {LEVEL_NEXT_REQ[level]}
            </Text>
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Selfie verification                                              */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Selfie Verification</Text>
          <Text style={styles.sectionDesc}>
            Kinakailangan para ma-verify ang iyong identity. Kumuha ng malinaw na selfie kung saan
            makikita ang iyong mukha.
          </Text>

          {customer.selfie_url ? (
            <View style={styles.photoRow}>
              <Image source={{ uri: customer.selfie_url }} style={styles.photoThumb} />
              <View style={styles.photoMeta}>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>Na-upload na</Text>
                </View>
                <Pressable
                  style={styles.reuploadBtn}
                  onPress={handleShowSelfieOptions}
                  disabled={uploadingSelfie}
                >
                  <Text style={styles.reuploadText}>
                    {uploadingSelfie ? 'Ina-upload...' : 'Palitan'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.uploadBtn,
                  uploadingSelfie && styles.uploadBtnDisabled,
                  pressed && !uploadingSelfie && styles.uploadBtnPressed,
                ]}
                onPress={handleShowSelfieOptions}
                disabled={uploadingSelfie}
              >
                {uploadingSelfie ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <>
                    <Text style={styles.uploadBtnIcon}>📷</Text>
                    <Text style={styles.uploadBtnText}>Mag-upload ng Selfie</Text>
                  </>
                )}
              </Pressable>
              {!!selfieError && (
                <Text style={styles.errorText}>{selfieError}</Text>
              )}
            </>
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* ID photo                                                          */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Valid ID</Text>
          <Text style={styles.sectionDesc}>
            Kinakailangan para sa Level 3 (hanggang ₱5,000). Tanggap na ID: PhilSys, Driver's
            License, Passport, Voter's ID, SSS/GSIS, o iba pang government-issued ID.
          </Text>

          {customer.id_photo_url ? (
            <View style={styles.photoRow}>
              <Image source={{ uri: customer.id_photo_url }} style={styles.photoThumb} />
              <View style={styles.photoMeta}>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>Na-upload na</Text>
                </View>
                <Pressable
                  style={styles.reuploadBtn}
                  onPress={handleUploadId}
                  disabled={uploadingId}
                >
                  <Text style={styles.reuploadText}>
                    {uploadingId ? 'Ina-upload...' : 'Palitan'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.uploadBtn,
                  { backgroundColor: C.blue },
                  uploadingId && styles.uploadBtnDisabled,
                  pressed && !uploadingId && { backgroundColor: '#0D47A1' },
                ]}
                onPress={handleUploadId}
                disabled={uploadingId}
              >
                {uploadingId ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <>
                    <Text style={styles.uploadBtnIcon}>🪪</Text>
                    <Text style={styles.uploadBtnText}>Mag-upload ng Valid ID</Text>
                  </>
                )}
              </Pressable>
              {!!idError && (
                <Text style={styles.errorText}>{idError}</Text>
              )}
            </>
          )}

          {Platform.OS === 'web' && (
            <Text style={styles.webNote}>
              Sa web: piliin ang larawan ng iyong ID mula sa iyong computer.
            </Text>
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Account info                                                      */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <InfoRow label="Status" value={customer.status ?? 'active'} />
          <InfoRow label="On-time na bayad" value={String(customer.on_time_repayment_count ?? 0)} />
          <InfoRow
            label="Max na halaga"
            value={formatCentavos(getMaxTransaction(level))}
          />
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
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },

  // Level card
  levelCard: {
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  levelLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  customerName: { fontSize: 18, fontWeight: '800', color: C.text },
  customerPhone: { fontSize: 13, color: C.textSub, marginTop: 2 },
  levelBadge: { alignItems: 'center' },
  levelBadgeText: { fontSize: 22, fontWeight: '800' },
  levelBadgeSub: { fontSize: 11, color: C.textSub },
  progressRow: { marginBottom: 4 },
  progressLabel: { fontSize: 13, color: C.textSub },
  nextLevel: { fontSize: 12, color: C.textSub, marginTop: 4, fontStyle: 'italic' },

  // Card
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
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 12,
    color: C.textSub,
    lineHeight: 18,
    marginBottom: 14,
  },

  // Upload button
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderRadius: 12,
    height: 50,
    gap: 8,
  },
  uploadBtnPressed: { backgroundColor: C.primaryDark },
  uploadBtnDisabled: { backgroundColor: C.disabled },
  uploadBtnIcon: { fontSize: 18 },
  uploadBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  // Existing photo
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: C.bg,
  },
  photoMeta: { flex: 1, gap: 8 },
  verifiedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: { fontSize: 12, fontWeight: '700', color: C.success },
  reuploadBtn: { alignSelf: 'flex-start' },
  reuploadText: { fontSize: 13, color: C.primary, fontWeight: '600' },

  errorText: { fontSize: 12, color: C.error, marginTop: 8 },

  webNote: {
    fontSize: 11,
    color: C.textSub,
    marginTop: 10,
    fontStyle: 'italic',
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  infoLabel: { fontSize: 13, color: C.textSub },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.text },

  // Logout
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
});
