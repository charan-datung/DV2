/**
 * RoleSelectScreen
 *
 * Shown once, immediately after a new user verifies their OTP and no existing
 * store or customer profile is found. The user chooses their role and is
 * directed to the appropriate registration flow.
 *
 * Note: Customer-facing text NEVER uses "loan / credit / lend / borrow"
 * per CLAUDE.md business rules.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RoleSelectScreenNavigationProp } from '../../types/navigation';
import { useAuthStore, type UserRole } from '../../stores/auth-store';

// ---------------------------------------------------------------------------
// Brand colours (same tokens as login-screen)
// ---------------------------------------------------------------------------
const C = {
  primary: '#0D5C37',
  primaryDark: '#09402A',
  primaryLight: '#E8F5EE',
  accent: '#F4A200',
  accentLight: '#FFF8E1',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textSub: '#5E6A7A',
  border: '#D9E2EC',
  disabled: '#A8B4C0',
};

// ---------------------------------------------------------------------------
// Role card config
// ---------------------------------------------------------------------------
interface RoleOption {
  role: UserRole;
  emoji: string;
  title: string;
  subtitle: string;
  detail: string;
  color: string;
  colorLight: string;
  navigateTo: 'StoreRegistration' | 'CustomerRegistration';
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'store',
    emoji: '🏪',
    title: 'Ako ay may-ari ng tindahan',
    subtitle: 'I am a store owner',
    detail:
      'Pamahalaan ang iyong tindahan, mag-alok ng bayad sa susunod sa mga suki, at makita ang lahat ng transaksyon.',
    color: C.primary,
    colorLight: C.primaryLight,
    navigateTo: 'StoreRegistration',
  },
  {
    role: 'customer',
    emoji: '👤',
    title: 'Ako ay customer',
    subtitle: 'I am a customer',
    detail:
      'Bumili sa paboritong tindahan at bayaran mamaya. Simple, mabilis, ligtas.',
    color: '#1565C0',
    colorLight: '#E3F2FD',
    navigateTo: 'CustomerRegistration',
  },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function RoleSelectScreen() {
  const navigation = useNavigation<RoleSelectScreenNavigationProp>();
  const { setRole } = useAuthStore();

  const [selected, setSelected] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;

    setIsLoading(true);

    // Persist the chosen role in the store
    setRole(selected);

    const option = ROLE_OPTIONS.find((o) => o.role === selected);
    if (option) {
      navigation.navigate(option.navigateTo);
    }

    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kumusta! 👋</Text>
          <Text style={styles.headerSub}>
            Piliin kung sino ka para makapagsimula.
          </Text>
        </View>

        {/* Role cards */}
        <View style={styles.cardsBlock}>
          {ROLE_OPTIONS.map((opt) => {
            const isSelected = selected === opt.role;
            return (
              <Pressable
                key={opt.role}
                onPress={() => setSelected(opt.role)}
                style={({ pressed }) => [
                  styles.card,
                  isSelected && {
                    borderColor: opt.color,
                    backgroundColor: opt.colorLight,
                  },
                  pressed && styles.cardPressed,
                ]}
              >
                {/* Selection indicator */}
                <View style={styles.cardRow}>
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && { borderColor: opt.color },
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={[styles.radioInner, { backgroundColor: opt.color }]}
                      />
                    )}
                  </View>

                  <View style={styles.cardEmoji}>
                    <Text style={styles.cardEmojiText}>{opt.emoji}</Text>
                  </View>
                </View>

                <Text style={[styles.cardTitle, isSelected && { color: opt.color }]}>
                  {opt.title}
                </Text>
                <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
                <Text style={styles.cardDetail}>{opt.detail}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Continue button */}
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            !selected && styles.btnDisabled,
            pressed && selected && styles.btnPressed,
          ]}
          onPress={handleContinue}
          disabled={!selected || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.btnText}>Magpatuloy →</Text>
          )}
        </Pressable>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          Hindi na mababago ang pagpipiliang ito. Makipag-ugnayan sa support
          kung kailangan ng pagbabago.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: 'center',
  },

  // Header
  header: {
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 15,
    color: C.textSub,
    lineHeight: 22,
  },

  // Cards
  cardsBlock: {
    gap: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.border,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },
  cardEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmojiText: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: C.textSub,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  cardDetail: {
    fontSize: 13,
    color: C.textSub,
    lineHeight: 19,
  },

  // Button
  btn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 16,
  },
  btnPressed: {
    backgroundColor: C.primaryDark,
    elevation: 2,
  },
  btnDisabled: {
    backgroundColor: C.disabled,
    elevation: 0,
    shadowOpacity: 0,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.3,
  },

  footerNote: {
    fontSize: 11,
    color: C.disabled,
    textAlign: 'center',
    lineHeight: 16,
  },
});
