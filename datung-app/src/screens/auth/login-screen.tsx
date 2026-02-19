import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
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
import { useNavigation } from '@react-navigation/native';
import type { LoginScreenNavigationProp } from '../../types/navigation';
import { isValidPhilippinePhone } from '../../services/auth-service';
import { useAuthStore } from '../../stores/auth-store';

// ---------------------------------------------------------------------------
// Brand colours
// ---------------------------------------------------------------------------
const C = {
  primary: '#0D5C37',
  primaryDark: '#09402A',
  primaryLight: '#E8F5EE',
  accent: '#F4A200',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textSub: '#5E6A7A',
  error: '#C62828',
  errorBg: '#FFEBEE',
  border: '#D9E2EC',
  borderFocus: '#0D5C37',
  disabled: '#A8B4C0',
  otpBox: '#EEF2F7',
  otpBoxFocus: '#E8F5EE',
};

// ---------------------------------------------------------------------------
// OTP resend cooldown (seconds)
// ---------------------------------------------------------------------------
const RESEND_COOLDOWN = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mapErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (/invalid.*phone|phone.*invalid/i.test(msg)) {
    return 'Mali ang format ng numero. Gamitin ang: 9XXXXXXXXX';
  }
  if (/token.*invalid|invalid.*token|expired/i.test(msg)) {
    return 'Mali o expired na ang OTP. Subukan muli.';
  }
  if (/rate.*limit|too many/i.test(msg)) {
    return 'Maraming pagsubok. Maghintay ng ilang minuto bago ulitin.';
  }
  if (/network|fetch|connect/i.test(msg)) {
    return 'Walang koneksyon. Suriin ang internet at subukan muli.';
  }
  return 'May nangyaring mali. Subukan muli.';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Six individual OTP digit boxes backed by a single hidden TextInput */
function OtpInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(6, ' ').split('');

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpWrapper}>
      {digits.map((d, i) => {
        const filled = d.trim().length > 0;
        const active = value.length === i;
        return (
          <View
            key={i}
            style={[
              styles.otpBox,
              active && styles.otpBoxActive,
              filled && styles.otpBoxFilled,
            ]}
          >
            <Text style={styles.otpDigit}>{filled ? d : ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        onSubmitEditing={onSubmit}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.otpHiddenInput}
        caretHidden
        autoFocus
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
type Step = 'phone' | 'otp';

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { sendOtp, verifyOtp } = useAuthStore();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  // The formatted +63XXXXXXXX returned after sendOtp succeeds
  const [formattedPhone, setFormattedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const phoneRef = useRef<TextInput>(null);

  // ---- Hardware back: go back to phone step instead of exiting ----
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'otp') {
        setStep('phone');
        setOtp('');
        setError('');
        return true; // prevent default (exit)
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  // ---- Resend cooldown timer ----
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // ---- Auto-submit OTP when all 6 digits entered ----
  useEffect(() => {
    if (otp.length === 6) handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  // ------------------------------------------------------------------
  const handleSendOtp = useCallback(async () => {
    setError('');

    const trimmed = phone.trim();
    if (!isValidPhilippinePhone(trimmed)) {
      setError('Mali ang format ng numero. Gamitin ang: 9XXXXXXXXX');
      return;
    }

    setIsLoading(true);
    try {
      const normalised = await sendOtp(trimmed);
      setFormattedPhone(normalised);
      setStep('otp');
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [phone, sendOtp]);

  // ------------------------------------------------------------------
  const handleVerify = useCallback(async () => {
    if (otp.length < 6) return;
    setError('');
    setIsLoading(true);

    try {
      const { needsRegistration } = await verifyOtp(formattedPhone, otp);
      if (needsRegistration) {
        navigation.navigate('RoleSelect');
      }
      // If not needsRegistration the root navigator will redirect to the
      // correct home screen once isAuthenticated + role are set in the store.
    } catch (err) {
      setError(mapErrorMessage(err));
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  }, [otp, formattedPhone, verifyOtp, navigation]);

  // ------------------------------------------------------------------
  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    setError('');
    setOtp('');
    setIsLoading(true);
    try {
      await sendOtp(phone.trim());
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [resendCooldown, phone, sendOtp]);

  // ------------------------------------------------------------------
  const maskedPhone = formattedPhone
    ? formattedPhone.replace(/(\+63\d{3})\d{4}(\d{3})/, '$1****$2')
    : '';

  // ------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ---- Logo ---- */}
          <View style={styles.logoBlock}>
            <View style={styles.logoIconWrap}>
              <Text style={styles.logoIcon}>₱</Text>
            </View>
            <Text style={styles.logoText}>datung</Text>
            <Text style={styles.logoTagline}>Tindahan. Tiwala. Takda.</Text>
          </View>

          {/* ---- Card ---- */}
          <View style={styles.card}>
            {step === 'phone' ? (
              <>
                <Text style={styles.cardTitle}>Mag-login</Text>
                <Text style={styles.cardSub}>
                  Ilagay ang iyong numero ng telepono
                </Text>

                {/* Phone input */}
                <Text style={styles.label}>Numero ng Telepono</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.prefixBox}>
                    <Text style={styles.prefixText}>+63</Text>
                  </View>
                  <TextInput
                    ref={phoneRef}
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={(t) => {
                      setError('');
                      setPhone(t.replace(/\D/g, '').slice(0, 10));
                    }}
                    placeholder="9XXXXXXXXX"
                    placeholderTextColor={C.disabled}
                    keyboardType="number-pad"
                    maxLength={10}
                    returnKeyType="done"
                    onSubmitEditing={handleSendOtp}
                    editable={!isLoading}
                  />
                </View>

                {/* Error */}
                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Send OTP button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    (isLoading || phone.length < 10) && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleSendOtp}
                  disabled={isLoading || phone.length < 10}
                >
                  {isLoading ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.btnText}>Magpadala ng OTP</Text>
                  )}
                </Pressable>

                <Text style={styles.hint}>
                  Magpapadala kami ng 6-digit na code sa iyong numero.
                </Text>
              </>
            ) : (
              <>
                <Pressable onPress={() => { setStep('phone'); setOtp(''); setError(''); }}>
                  <Text style={styles.backLink}>← Bumalik</Text>
                </Pressable>

                <Text style={styles.cardTitle}>I-verify ang OTP</Text>
                <Text style={styles.cardSub}>
                  Ilagay ang 6-digit na code na ipinadala sa{'\n'}
                  <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
                </Text>

                {/* OTP boxes */}
                <OtpInput value={otp} onChange={setOtp} onSubmit={handleVerify} />

                {/* Error */}
                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Verify button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    (isLoading || otp.length < 6) && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleVerify}
                  disabled={isLoading || otp.length < 6}
                >
                  {isLoading ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.btnText}>I-verify</Text>
                  )}
                </Pressable>

                {/* Resend */}
                <Pressable
                  onPress={handleResend}
                  disabled={resendCooldown > 0 || isLoading}
                  style={styles.resendBtn}
                >
                  <Text
                    style={[
                      styles.resendText,
                      resendCooldown > 0 && styles.resendDisabled,
                    ]}
                  >
                    {resendCooldown > 0
                      ? `Muling magpadala sa loob ng ${resendCooldown}s`
                      : 'Hindi natanggap? Magpadala ulit'}
                  </Text>
                </Pressable>

                {/* Dev helper */}
                {__DEV__ && (
                  <Text style={styles.devHint}>
                    Dev: Gamitin ang test numbers mula sa .env{'\n'}
                    OTP = 123456
                  </Text>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  // Logo
  logoBlock: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  logoIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: C.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  logoIcon: {
    fontSize: 34,
    color: C.white,
    fontWeight: '800',
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: 1,
  },
  logoTagline: {
    fontSize: 13,
    color: C.textSub,
    marginTop: 4,
    letterSpacing: 0.5,
  },

  // Card
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
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 14,
    color: C.textSub,
    marginBottom: 24,
    lineHeight: 20,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: C.text,
  },

  // Label
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 8,
  },

  // Phone row
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  prefixBox: {
    backgroundColor: C.primaryLight,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRightWidth: 0,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 14,
    height: 52,
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.primary,
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderColor: C.border,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    color: C.text,
    letterSpacing: 1,
    backgroundColor: C.white,
  },

  // Error
  errorBox: {
    backgroundColor: C.errorBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: C.error,
    lineHeight: 18,
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

  hint: {
    marginTop: 14,
    fontSize: 12,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 17,
  },

  // OTP
  otpWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 24,
    position: 'relative',
  },
  otpBox: {
    width: 44,
    height: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.otpBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: C.borderFocus,
    backgroundColor: C.otpBoxFocus,
  },
  otpBoxFilled: {
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
  },
  otpHiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },

  // Back / resend
  backLink: {
    fontSize: 14,
    color: C.primary,
    fontWeight: '600',
    marginBottom: 16,
  },
  resendBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 13,
    color: C.primary,
    fontWeight: '600',
  },
  resendDisabled: {
    color: C.disabled,
  },

  devHint: {
    marginTop: 16,
    fontSize: 11,
    color: C.accent,
    textAlign: 'center',
    lineHeight: 16,
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    padding: 8,
  },
});
