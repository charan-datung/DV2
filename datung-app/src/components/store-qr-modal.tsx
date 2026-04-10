import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

/**
 * The QR value encodes the store ID in a URL scheme so the scanner
 * can unambiguously identify it as a Datung store.
 */
export function buildStoreQRValue(storeId: string): string {
  return `datung://store/${storeId}`;
}

/**
 * Parse a scanned QR value back to a store ID.
 * Accepts both the URL scheme and a raw UUID (for backwards compatibility).
 */
export function parseStoreQRValue(scanned: string): string | null {
  const urlMatch = scanned.match(/^datung:\/\/store\/([a-f0-9-]{36})$/i);
  if (urlMatch) return urlMatch[1];

  // Accept raw UUID directly
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(scanned.trim())) {
    return scanned.trim();
  }

  return null;
}

const C = {
  primary: '#0D5C37',
  primaryDark: '#09402A',
  primaryLight: '#E8F5EE',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textSub: '#5E6A7A',
  bg: '#F5F7FA',
  overlay: 'rgba(0,0,0,0.55)',
};

interface Props {
  visible: boolean;
  storeName: string;
  storeId: string;
  onClose: () => void;
}

export default function StoreQRModal({ visible, storeName, storeId, onClose }: Props) {
  const qrValue = buildStoreQRValue(storeId);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Datung Store ID para sa ${storeName}:\n${storeId}\n\nI-download ang Datung app at gamitin ang Store ID na ito para mag-request ng bayad-alin.`,
        title: `Datung QR — ${storeName}`,
      });
    } catch {
      // User dismissed share sheet — no-op
    }
  };

  const shortId = storeId ? `${storeId.slice(0, 8)}...` : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle bar */}
          <View style={styles.handle} />

          <Text style={styles.heading}>QR Code ng Tindahan</Text>
          <Text style={styles.subheading}>{storeName}</Text>
          <Text style={styles.instruction}>
            Ipakita ito sa customer para i-scan at mag-request ng transaksyon.
          </Text>

          {/* QR Code */}
          <View style={styles.qrWrapper}>
            <View style={styles.qrCard}>
              <QRCode
                value={qrValue}
                size={220}
                color={C.primary}
                backgroundColor={C.white}
                // Corner finder pattern color
                enableLinearGradient={false}
              />
            </View>

            {/* Corner decorations */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          {/* Store ID text below QR */}
          <View style={styles.idRow}>
            <Text style={styles.idLabel}>Store ID</Text>
            <Text style={styles.idValue}>{shortId}</Text>
          </View>

          {/* Action buttons */}
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
            onPress={handleShare}
          >
            <Text style={styles.shareBtnText}>
              {Platform.OS === 'web' ? 'Ibahagi ang Store ID' : 'Ibahagi ang QR / Store ID'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            onPress={onClose}
          >
            <Text style={styles.closeBtnText}>Isara</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;
const CORNER_OFFSET = -4;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D0D5DD',
    borderRadius: 2,
    marginBottom: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: C.primary,
    marginBottom: 8,
  },
  instruction: {
    fontSize: 13,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },

  // QR wrapper with corner decorations
  qrWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  qrCard: {
    backgroundColor: C.white,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: C.primary,
  },
  cornerTL: {
    top: CORNER_OFFSET,
    left: CORNER_OFFSET,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: CORNER_OFFSET,
    right: CORNER_OFFSET,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: CORNER_OFFSET,
    left: CORNER_OFFSET,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: CORNER_OFFSET,
    right: CORNER_OFFSET,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 6,
  },

  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 24,
  },
  idLabel: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: '600',
  },
  idValue: {
    fontSize: 13,
    color: C.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  shareBtn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  shareBtnPressed: { backgroundColor: C.primaryDark },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.white,
  },
  closeBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: { backgroundColor: '#C8E6C9' },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.primary,
  },
});
