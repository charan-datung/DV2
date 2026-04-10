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
  successBg: '#E8F5EE',
  successText: '#0D5C37',
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
  if (/invalid.*login|invalid.*credentials/i.test(msg)) {
    return 'Mali ang email o password. Subukan muli.';
  }
  if (/user.*already.*registered|already.*exists/i.test(msg)) {
    return 'May account na gamit ang email na ito. Mag-login na lang.';
  }
  if (/password.*short|at least/i.test(msg)) {
    return 'Ang password ay dapat 6 na character o higit pa.';
  }
  if (/invalid.*email|email.*invalid/i.test(msg)) {
    return 'Mali ang format ng email.';
  }
  return 'May nangyaring mali. Subukan muli.';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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

/** Tab selector for auth mode */
function AuthModeTabs({
  mode,
  onChangeMode,
}: {
  mode: 'phone' | 'email';
  onChangeMode: (m: 'phone' | 'email') => void;
}) {
  return (
    <View style={styles.tabRow}>
      <Pressable
        style={[styles.tab, mode === 'phone' && styles.tabActive]}
        onPress={() => onChangeMode('phone')}
      >
        <Text style={[styles.tabText, mode === 'phone' && styles.tabTextActive]}>
          Phone OTP
        </Text>
      </Pressable>
      <Pressable
        style={[styles.tab, mode === 'email' && styles.tabActive]}
        onPress={() => onChangeMode('email')}
      >
        <Text style={[styles.tabText, mode === 'email' && styles.tabTextActive]}>
          Email
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
type PhoneStep = 'phone' | 'otp';
type EmailStep = 'login' | 'signup' | 'confirm';

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { sendOtp, verifyOtp, signInWithEmail, signUpWithEmail, isAuthenticated, role } = useAuthStore();

  // When a user confirms their email (clicks the link in the confirmation email),
  // Supabase fires SIGNED_IN and the auth store sets isAuthenticated=true, role=null.
  // We detect that here and push them straight to RoleSelect so they can register.
  useEffect(() => {
    if (isAuthenticated && !role) {
      navigation.navigate('RoleSelect');
    }
  }, [isAuthenticated, role, navigation]);

  // Auth mode: phone OTP or email/password
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('email');

  // Phone OTP state
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email state
  const [emailStep, setEmailStep] = useState<EmailStep>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // T&C consent — must be accepted before signup (required by PH Data Privacy Act)
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const phoneRef = useRef<TextInput>(null);

  // ---- Hardware back: go back instead of exiting ----
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phoneStep === 'otp' && authMode === 'phone') {
        setPhoneStep('phone');
        setOtp('');
        setError('');
        return true;
      }
      if (emailStep === 'signup' && authMode === 'email') {
        setEmailStep('login');
        setError('');
        return true;
      }
      if (emailStep === 'confirm' && authMode === 'email') {
        setEmailStep('login');
        setError('');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [phoneStep, emailStep, authMode]);

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

  // ---- Clear error on mode/step change ----
  const handleModeChange = useCallback((m: 'phone' | 'email') => {
    setAuthMode(m);
    setError('');
  }, []);

  // ------------------------------------------------------------------
  // Phone OTP handlers
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
      setPhoneStep('otp');
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [phone, sendOtp]);

  const handleVerify = useCallback(async () => {
    if (otp.length < 6) return;
    setError('');
    setIsLoading(true);
    try {
      const { needsRegistration } = await verifyOtp(formattedPhone, otp);
      if (needsRegistration) {
        navigation.navigate('RoleSelect');
      }
    } catch (err) {
      setError(mapErrorMessage(err));
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  }, [otp, formattedPhone, verifyOtp, navigation]);

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
  // Email handlers
  // ------------------------------------------------------------------
  const handleEmailLogin = useCallback(async () => {
    setError('');
    if (!isValidEmail(email)) {
      setError('Mali ang format ng email.');
      return;
    }
    if (password.length < 6) {
      setError('Ang password ay dapat 6 na character o higit pa.');
      return;
    }
    setIsLoading(true);
    try {
      const { needsRegistration } = await signInWithEmail(email.trim(), password);
      if (needsRegistration) {
        navigation.navigate('RoleSelect');
      }
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [email, password, signInWithEmail, navigation]);

  const handleEmailSignup = useCallback(async () => {
    setError('');
    if (!isValidEmail(email)) {
      setError('Mali ang format ng email.');
      return;
    }
    if (password.length < 6) {
      setError('Ang password ay dapat 6 na character o higit pa.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Hindi magkatugma ang password.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await signUpWithEmail(email.trim(), password);
      if (result.confirmationRequired) {
        setEmailStep('confirm');
      } else if (result.needsRegistration) {
        navigation.navigate('RoleSelect');
      }
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [email, password, confirmPassword, signUpWithEmail, navigation]);

  // ------------------------------------------------------------------
  const maskedPhone = formattedPhone
    ? formattedPhone.replace(/(\+63\d{3})\d{4}(\d{3})/, '$1****$2')
    : '';

  const emailLoginReady = isValidEmail(email) && password.length >= 6;
  const emailSignupReady = emailLoginReady && confirmPassword.length >= 6 && termsAccepted;

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
            {/* Tab switcher */}
            <AuthModeTabs mode={authMode} onChangeMode={handleModeChange} />

            {/* ============================================ */}
            {/* PHONE OTP MODE                               */}
            {/* ============================================ */}
            {authMode === 'phone' && phoneStep === 'phone' && (
              <>
                <Text style={styles.cardTitle}>Mag-login gamit ang Phone</Text>
                <Text style={styles.cardSub}>
                  Ilagay ang iyong numero ng telepono
                </Text>

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

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

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
            )}

            {authMode === 'phone' && phoneStep === 'otp' && (
              <>
                <Pressable onPress={() => { setPhoneStep('phone'); setOtp(''); setError(''); }}>
                  <Text style={styles.backLink}>← Bumalik</Text>
                </Pressable>

                <Text style={styles.cardTitle}>I-verify ang OTP</Text>
                <Text style={styles.cardSub}>
                  Ilagay ang 6-digit na code na ipinadala sa{'\n'}
                  <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
                </Text>

                <OtpInput value={otp} onChange={setOtp} onSubmit={handleVerify} />

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

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
              </>
            )}

            {/* ============================================ */}
            {/* EMAIL LOGIN MODE                             */}
            {/* ============================================ */}
            {authMode === 'email' && emailStep === 'login' && (
              <>
                <Text style={styles.cardTitle}>Mag-login</Text>
                <Text style={styles.cardSub}>
                  Gamitin ang iyong email at password
                </Text>

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(t) => { setError(''); setEmail(t); }}
                  placeholder="you@example.com"
                  placeholderTextColor={C.disabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(t) => { setError(''); setPassword(t); }}
                  placeholder="••••••••"
                  placeholderTextColor={C.disabled}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!isLoading}
                  onSubmitEditing={handleEmailLogin}
                />

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    (isLoading || !emailLoginReady) && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleEmailLogin}
                  disabled={isLoading || !emailLoginReady}
                >
                  {isLoading ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.btnText}>Mag-login</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => { setEmailStep('signup'); setError(''); }}
                  style={styles.switchBtn}
                >
                  <Text style={styles.switchText}>
                    Wala pang account? <Text style={styles.switchLink}>Mag-sign up</Text>
                  </Text>
                </Pressable>
              </>
            )}

            {/* ============================================ */}
            {/* EMAIL SIGNUP MODE                            */}
            {/* ============================================ */}
            {authMode === 'email' && emailStep === 'signup' && (
              <>
                <Pressable onPress={() => { setEmailStep('login'); setError(''); }}>
                  <Text style={styles.backLink}>← Bumalik</Text>
                </Pressable>

                <Text style={styles.cardTitle}>Gumawa ng Account</Text>
                <Text style={styles.cardSub}>
                  Mag-sign up gamit ang email at password
                </Text>

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(t) => { setError(''); setEmail(t); }}
                  placeholder="you@example.com"
                  placeholderTextColor={C.disabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(t) => { setError(''); setPassword(t); }}
                  placeholder="6+ characters"
                  placeholderTextColor={C.disabled}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!isLoading}
                />

                <Text style={styles.label}>Kumpirmahin ang Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={(t) => { setError(''); setConfirmPassword(t); }}
                  placeholder="Ulitin ang password"
                  placeholderTextColor={C.disabled}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!isLoading}
                  onSubmitEditing={handleEmailSignup}
                />

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* T&C consent — required by PH Data Privacy Act (RA 10173) */}
                <Pressable
                  style={styles.termsRow}
                  onPress={() => setTermsAccepted((v) => !v)}
                >
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                    {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    Sumasang-ayon ako sa{' '}
                    <Text style={styles.termsLink}>Mga Tuntunin ng Serbisyo</Text>
                    {' '}at{' '}
                    <Text style={styles.termsLink}>Patakaran sa Privacy</Text>
                    {' '}ng Datung, at pinahihintulutan ang pagkolekta ng aking personal na impormasyon alinsunod sa RA 10173 (Data Privacy Act).
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    (isLoading || !emailSignupReady) && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleEmailSignup}
                  disabled={isLoading || !emailSignupReady}
                >
                  {isLoading ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.btnText}>Mag-sign up</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => { setEmailStep('login'); setError(''); }}
                  style={styles.switchBtn}
                >
                  <Text style={styles.switchText}>
                    May account na? <Text style={styles.switchLink}>Mag-login</Text>
                  </Text>
                </Pressable>
              </>
            )}

            {/* ============================================ */}
            {/* EMAIL CONFIRMATION NOTICE                    */}
            {/* ============================================ */}
            {authMode === 'email' && emailStep === 'confirm' && (
              <>
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmIcon}>✓</Text>
                  <Text style={styles.cardTitle}>Tingnan ang Email</Text>
                  <Text style={styles.cardSub}>
                    Nagpadala kami ng confirmation link sa{'\n'}
                    <Text style={styles.phoneHighlight}>{email}</Text>
                    {'\n\n'}
                    I-click ang link para ma-activate ang iyong account,
                    tapos bumalik dito para mag-login.
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => { setEmailStep('login'); setError(''); }}
                >
                  <Text style={styles.btnText}>Bumalik sa Login</Text>
                </Pressable>
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

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: C.bg,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: C.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSub,
  },
  tabTextActive: {
    color: C.primary,
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

  // Generic input
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.text,
    backgroundColor: C.white,
    marginBottom: 16,
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

  // Back / resend / switch
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
  switchBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 13,
    color: C.textSub,
  },
  switchLink: {
    color: C.primary,
    fontWeight: '700',
  },

  // Confirmation
  confirmBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  confirmIcon: {
    fontSize: 48,
    color: C.primary,
    marginBottom: 12,
  },

  // T&C consent checkbox
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 20,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  checkmark: {
    fontSize: 13,
    color: C.white,
    fontWeight: '800',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: C.textSub,
    lineHeight: 18,
  },
  termsLink: {
    color: C.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
