import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle, KeyRound, Clock, AlertTriangle,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useOTP } from '@/contexts/OTPContext';
import { useToast } from '@/contexts/ToastContext';
import Colors from '@/constants/colors';

type Step = 'email' | 'otp' | 'password' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const { sendOTP, verifyOTP, resendOTP, resendCountdown, canResend, verifyAttempts, maxAttempts, isLocked } = useOTP();
  const { success: showSuccess, error: showError } = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
  }, [step, slideAnim]);

  const stepOrder: Step[] = ['email', 'otp', 'password', 'success'];
  const currentStepIndex = stepOrder.indexOf(step);

  const handleSendOTP = async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your registered email.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    try {
      const code = await sendOTP(email.trim().toLowerCase());
      setGeneratedCode(code);
      setStep('otp');
      Alert.alert(
        'OTP Sent',
        `A verification code has been sent to ${email.trim()}.\n\nFor demo purposes, your code is: ${code}`,
        [{ text: 'OK' }],
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError('');
    if (!otpCode.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setIsSubmitting(true);
    try {
      const valid = await verifyOTP(email.trim().toLowerCase(), otpCode.trim());
      if (!valid) {
        setError(`Invalid or expired code. Attempt ${verifyAttempts + 1} of ${maxAttempts}.`);
        setIsSubmitting(false);
        return;
      }
      setStep('password');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const code = await resendOTP(email.trim().toLowerCase());
      setGeneratedCode(code);
      Alert.alert('OTP Resent', `New verification code: ${code}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resend OTP.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword(email.trim().toLowerCase(), newPassword);
      setStep('success');
      showSuccess('Password reset successfully! You can now log in.');
      setTimeout(() => router.replace('/login'), 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Reset failed.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {stepOrder.slice(0, 3).map((s, i) => (
        <View
          key={s}
          style={[
            styles.progressDot,
            { backgroundColor: i <= currentStepIndex ? Colors.primary : Colors.border },
          ]}
        />
      ))}
    </View>
  );

  if (step === 'success') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <CheckCircle size={72} color={Colors.primary} />
        <Text style={styles.successTitle}>Password Reset!</Text>
 <Text style={styles.successText}>Your password has been changed successfully.</Text>
        <Text style={styles.successSubtext}>Redirecting to login...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          {step === 'email' && 'Enter your registered email to receive a verification code'}
          {step === 'otp' && `Enter the 6-digit code sent to ${email.trim()}`}
          {step === 'password' && 'Create a new password for your account'}
        </Text>

        {renderProgressBar()}

        {error ? (
          <View style={styles.errorBox}>
            {isLocked && <AlertTriangle size={16} color={Colors.error} style={{ marginRight: 8 }} />}
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === 'email' && (
          <Animated.View style={{ opacity: slideAnim }}>
            <View style={styles.inputContainer}>
              <Mail size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Registered Email"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <TouchableOpacity style={[styles.actionButton, isSubmitting && styles.actionButtonDisabled]} onPress={handleSendOTP} disabled={isSubmitting} activeOpacity={0.8}>
              <Text style={styles.actionButtonText}>
                {isSubmitting ? 'Sending...' : 'Send Verification Code'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {step === 'otp' && (
          <Animated.View style={{ opacity: slideAnim }}>
            <View style={styles.otpSection}>
              <KeyRound size={48} color={Colors.primary} style={styles.otpIcon} />
              <Text style={styles.otpLabel}>Enter 6-digit Code</Text>

              <View style={[styles.inputContainer, { width: '100%' }]}>
                <KeyRound size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor={Colors.textMuted}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <View style={styles.attemptsInfo}>
                <Text style={styles.attemptsText}>Attempt {verifyAttempts} of {maxAttempts}</Text>
              </View>

              <TouchableOpacity style={[styles.actionButton, { width: '100%' }, isSubmitting && styles.actionButtonDisabled]} onPress={handleVerifyOTP} disabled={isSubmitting} activeOpacity={0.8}>
                <Text style={styles.actionButtonText}>
                  {isSubmitting ? 'Verifying...' : 'Verify Code'}
                </Text>
              </TouchableOpacity>

              <View style={styles.resendRow}>
                {canResend ? (
                  <TouchableOpacity onPress={handleResendOTP} disabled={isSubmitting}>
                    <Text style={styles.resendText}>Didn't receive the code? Resend</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.resendRowWaiting}>
                    <Clock size={14} color={Colors.textMuted} />
                    <Text style={styles.resendWaitingText}>Resend in {resendCountdown}s</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {step === 'password' && (
          <Animated.View style={{ opacity: slideAnim }}>
            <View style={styles.inputContainer}>
              <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor={Colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                {showPassword ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>

            <TouchableOpacity style={[styles.actionButton, isSubmitting && styles.actionButtonDisabled]} onPress={handleResetPassword} disabled={isSubmitting} activeOpacity={0.8}>
              <Text style={styles.actionButtonText}>
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <TouchableOpacity style={styles.backToLogin} onPress={() => router.replace('/login')}>
          <Text style={styles.backToLoginText}>Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 40 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  backButton: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,107,107,0.15)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: Colors.error, fontSize: 13, textAlign: 'center' as const, flex: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 14, paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.text, fontSize: 15, height: '100%' },
  eyeIcon: { padding: 6 },
  actionButton: { backgroundColor: Colors.primary, borderRadius: 12, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#000', fontSize: 16, fontWeight: '700' as const },
  otpSection: { alignItems: 'center', paddingTop: 20 },
  otpIcon: { marginBottom: 16 },
  otpLabel: { fontSize: 18, fontWeight: '600' as const, color: Colors.text, marginBottom: 20 },
  otpInput: { textAlign: 'center' as const, fontSize: 24, letterSpacing: 8, fontWeight: '700' as const },
  attemptsInfo: { marginBottom: 16 },
  attemptsText: { fontSize: 12, color: Colors.textMuted },
  resendRow: { marginTop: 20, alignItems: 'center' as const },
  resendRowWaiting: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resendText: { fontSize: 14, color: Colors.accent, fontWeight: '500' as const },
  resendWaitingText: { fontSize: 14, color: Colors.textMuted },
  backToLogin: { marginTop: 24, alignItems: 'center' as const },
  backToLoginText: { fontSize: 14, color: Colors.accent, fontWeight: '500' as const },
  successTitle: { fontSize: 24, fontWeight: '700' as const, color: Colors.text, marginTop: 20 },
  successText: { fontSize: 15, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' as const },
  successSubtext: { fontSize: 13, color: Colors.textMuted, marginTop: 12 },
});
