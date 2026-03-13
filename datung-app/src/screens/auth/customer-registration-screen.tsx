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
import { useAuthStore } from '../../stores/auth-store';
import { customerService } from '../../services/customer-service';
import { userFriendlyError } from '../../utils/errors';

const C = {
  primary: '#0D5C37',
  primaryDark: '#09402A',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textSub: '#5E6A7A',
  border: '#D9E2EC',
  error: '#C62828',
  errorBg: '#FFEBEE',
  disabled: '#A8B4C0',
};

export default function CustomerRegistrationScreen() {
  const { user, setRole } = useAuthStore();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || !user) return;
    setError('');
    setIsLoading(true);

    try {
      // Phone number comes from the auth session
      const phone = user.phone ?? '';
      await customerService.register({
        user_id: user.id,
        phone,
        name: name.trim(),
      });
      // Registration complete — set role, which triggers navigation to customer home
      setRole('customer');
    } catch (err) {
      setError(userFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Mag-register</Text>
          <Text style={styles.subtitle}>
            Ilagay ang iyong pangalan para makapagsimula. Simple lang!
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Buong Pangalan</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Juan Dela Cruz"
              placeholderTextColor={C.disabled}
              editable={!isLoading}
              autoFocus
            />

            <Text style={styles.hint}>
              Gagamitin ito para makilala ka ng mga tindahan na iyong bibisitahin.
            </Text>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                (!isValid || isLoading) && styles.btnDisabled,
                pressed && isValid && styles.btnPressed,
              ]}
              onPress={handleSubmit}
              disabled={!isValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.btnText}>Magpatuloy</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.levelInfo}>
            <Text style={styles.levelTitle}>Paano gumagana?</Text>
            <Text style={styles.levelText}>
              Magsimula sa Level 0 — hanggang ₱500 na halaga, 3 araw para magbayad.{'\n'}
              Habang nagbabayad ka on time, tumataas ang iyong level at ang halaga na puwede mong gamitin.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: C.textSub,
    marginBottom: 24,
    lineHeight: 20,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.text,
    backgroundColor: C.white,
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: C.textSub,
    lineHeight: 17,
  },
  errorBox: {
    backgroundColor: C.errorBg,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    fontSize: 13,
    color: C.error,
  },
  btn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  btnPressed: { backgroundColor: C.primaryDark },
  btnDisabled: { backgroundColor: C.disabled },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
  },
  levelInfo: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#E8F5EE',
    borderRadius: 12,
  },
  levelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.primary,
    marginBottom: 6,
  },
  levelText: {
    fontSize: 13,
    color: C.text,
    lineHeight: 19,
  },
});
