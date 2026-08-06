import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Animated, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, User, ArrowLeft, Shield, KeyRound } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useOTP } from '@/contexts/OTPContext';
import Colors from '@/constants/colors';

export default function AdminSignupScreen() {
  const router = useRouter();
  const { adminSignup, adminSignupPending } = useAuth();
  const { sendOTP, verifyOTP, resendOTP } = useOTP();

  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [invitationCode, setInvitationCode] = useState<string>('');
  const [schoolOrganization, setSchoolOrganization] = useState<string>('');
  const [accountType, setAccountType] = useState<'admin' | 'teacher'>('admin');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const [otpCode, setOtpCode] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpVerified, setOtpVerified] = useState<boolean>(false);
  const [isSendingOTP, setIsSendingOTP] = useState<boolean>(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState<boolean>(false);
  const [generatedOTP, setGeneratedOTP] = useState<string>('');

  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<number>(1);
  const buttonScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();

  const validateStep1 = () => {
    if (!fullName.trim() || !username.trim() || !email.trim() || !password || !confirmPassword || !invitationCode.trim()) {
      setError('Please fill in all fields, including your invitation code.');
      return false;
    }
    if (!email.trim().toLowerCase().endsWith('@deped.gov.ph')) {
      setError('Admin accounts must use a @deped.gov.ph email address.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleSendOTP = async () => {
    setError('');
    if (!validateStep1()) return;
    setIsSendingOTP(true);
    try {
      const code = await sendOTP(email.trim().toLowerCase());
      setGeneratedOTP(code);
      setOtpSent(true);
      setStep(2);
      Alert.alert(
        'OTP Sent',
        `A verification code has been sent to ${email.trim()}.\n\nFor demo purposes, your code is: ${code}`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError('');
    if (!otpCode.trim()) {
      setError('Please enter the verification code.');
      return;
    }
    setIsVerifyingOTP(true);
    try {
      const valid = await verifyOTP(email.trim().toLowerCase(), otpCode.trim());
      if (valid) {
        setOtpVerified(true);
        await handleCreateAccount();
      } else {
        setError('Invalid or expired verification code. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setIsSendingOTP(true);
    try {
      const code = await resendOTP(email.trim().toLowerCase());
      setGeneratedOTP(code);
      Alert.alert('OTP Resent', `New verification code: ${code}`);
    } catch (err) {
      setError('Failed to resend OTP.');
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleCreateAccount = async () => {
    try {
      await adminSignup({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        invitationCode: invitationCode.trim().toUpperCase(),
        schoolOrganization: schoolOrganization.trim(),
        accountType,
      });
      router.replace('/(admin)/dashboard' as any);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <View style={styles.shieldIcon}>
            <Shield size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>
            {step === 1 ? 'Admin Registration' : 'Verify Email'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Create an administrator account using your DepEd email'
              : `Enter the verification code sent to ${email.trim()}`}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          {[1, 2].map((s) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                { backgroundColor: s <= step ? Colors.primary : Colors.border }
              ]}
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === 1 && (
          <>
            <View style={styles.emailNotice}>
              <Mail size={16} color={Colors.warning} />
              <Text style={styles.emailNoticeText}>
                Only @deped.gov.ph emails are accepted for admin and teacher accounts
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={Colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
                testID="admin-fullname"
              />
            </View>

            <View style={styles.inputContainer}>
              <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={Colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                testID="admin-username"
              />
            </View>

            <View style={styles.inputContainer}>
              <Mail size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email (@deped.gov.ph)"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="admin-email"
              />
            </View>

            <View style={styles.inputContainer}>
              <KeyRound size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Admin / Teacher Invitation Code"
                placeholderTextColor={Colors.textMuted}
                value={invitationCode}
                onChangeText={setInvitationCode}
                autoCapitalize="characters"
                testID="admin-invitation-code"
              />
            </View>

            <View style={styles.inputContainer}>
              <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="School / Organization (optional)"
                placeholderTextColor={Colors.textMuted}
                value={schoolOrganization}
                onChangeText={setSchoolOrganization}
              />
            </View>

            <Text style={styles.roleLabel}>Account type</Text>
            <View style={styles.roleSelector}>
              {(['admin', 'teacher'] as const).map(type => (
                <TouchableOpacity key={type} style={[styles.roleOption, accountType === type && styles.roleOptionActive]} onPress={() => setAccountType(type)}>
                  <Text style={[styles.roleOptionText, accountType === type && styles.roleOptionTextActive]}>{type === 'admin' ? 'Admin' : 'Teacher'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputContainer}>
              <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                testID="admin-password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                {showPassword ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                testID="admin-confirm"
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeIcon}>
                {showConfirm ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[styles.primaryButton, isSendingOTP && styles.buttonDisabled]}
                onPress={handleSendOTP}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={isSendingOTP}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>
                  {isSendingOTP ? 'Sending OTP...' : 'Send Verification Code'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.otpSection}>
              <KeyRound size={48} color={Colors.primary} style={styles.otpIcon} />
              <Text style={styles.otpLabel}>Enter 6-digit Code</Text>

              <View style={styles.inputContainer}>
                <KeyRound size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor={Colors.textMuted}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  testID="admin-otp"
                />
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.primaryButton, (isVerifyingOTP || adminSignupPending) && styles.buttonDisabled]}
                  onPress={handleVerifyOTP}
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}
                  disabled={isVerifyingOTP || adminSignupPending}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>
                    {isVerifyingOTP || adminSignupPending ? 'Verifying...' : 'Verify & Create Account'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResendOTP}
                disabled={isSendingOTP}
              >
                <Text style={styles.resendText}>
                  {isSendingOTP ? 'Resending...' : "Didn't receive the code? Resend"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.loginRow}>
          <Text style={styles.loginLabel}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/login' as any)}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  backButton: { marginBottom: 20 },
  headerSection: { alignItems: 'center', marginBottom: 16 },
  shieldIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '700' as const, color: Colors.text, textAlign: 'center' as const },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' as const, lineHeight: 20 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  errorBox: { backgroundColor: 'rgba(255,107,107,0.15)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: Colors.error, fontSize: 13, textAlign: 'center' as const },
  emailNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warning + '15',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  emailNoticeText: { fontSize: 12, color: Colors.warning, flex: 1, lineHeight: 18 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.text, fontSize: 15, height: '100%' },
  roleLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8, marginTop: 2 },
  roleSelector: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  roleOption: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  roleOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleOptionText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' as const },
  roleOptionTextActive: { color: '#000' },
  eyeIcon: { padding: 6 },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#000', fontSize: 16, fontWeight: '700' as const },
  otpSection: { alignItems: 'center', paddingTop: 20 },
  otpIcon: { marginBottom: 16 },
  otpLabel: { fontSize: 18, fontWeight: '600' as const, color: Colors.text, marginBottom: 20 },
  otpInput: { textAlign: 'center' as const, fontSize: 24, letterSpacing: 8, fontWeight: '700' as const },
  resendBtn: { marginTop: 20, padding: 10 },
  resendText: { fontSize: 14, color: Colors.accent, fontWeight: '500' as const },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  loginLabel: { color: Colors.textSecondary, fontSize: 14 },
  loginLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' as const },
});
