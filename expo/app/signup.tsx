import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Animated, Alert, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, User, ArrowLeft, Hash, BookOpen, Users, Camera, Upload, KeyRound, GraduationCap } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useOTP } from '@/contexts/OTPContext';
import Colors from '@/constants/colors';
import { GRADE_LEVELS, GradeLevel } from '@/types';
import * as ImagePicker from 'expo-image-picker';

export default function SignupScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { signup, signupPending, sections, subjects, validateRegCode, incrementLinkUsage } = useAuth();
  const { sendOTP, verifyOTP, resendOTP } = useOTP();

  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [regCode, setRegCode] = useState<string>(code || '');
  const [adminId, setAdminId] = useState<string | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState<boolean>(false);

  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<GradeLevel | ''>('');

  const [otpCode, setOtpCode] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [isSendingOTP, setIsSendingOTP] = useState<boolean>(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState<boolean>(false);

  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<number>(1);
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (code) {
      const validatedAdminId = validateRegCode(code);
      if (validatedAdminId) {
        setAdminId(validatedAdminId);
        setStep(1);
      } else {
        setError('Invalid or expired registration code');
      }
    }
  }, [code, validateRegCode]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setProfileImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const validateStep1 = () => {
    if (!fullName.trim() || !username.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return false;
    }
    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return false;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (validateStep1()) setStep(2);
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const validateRegCodeInput = async () => {
    if (!regCode.trim()) {
      setError('Please enter an invitation code');
      return;
    }
    setIsValidatingCode(true);
    const validatedAdminId = validateRegCode(regCode.trim().toUpperCase());
    if (validatedAdminId) {
      setAdminId(validatedAdminId);
      setError('');
    } else {
      setError('Invalid or expired invitation code');
    }
    setIsValidatingCode(false);
  };

  const handleProceedToOTP = async () => {
    setError('');
    if (!adminId && !regCode.trim()) {
      setStep(3);
      return;
    }
    if (!adminId && regCode.trim()) {
      await validateRegCodeInput();
      if (!adminId) return;
    }
    setIsSendingOTP(true);
    try {
      const code = await sendOTP(email.trim().toLowerCase());
      setOtpSent(true);
      setStep(4);
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

  const handleVerifyAndSignup = async () => {
    setError('');
    if (!otpCode.trim()) {
      setError('Please enter the verification code.');
      return;
    }
    setIsVerifyingOTP(true);
    try {
      const valid = await verifyOTP(email.trim().toLowerCase(), otpCode.trim());
      if (!valid) {
        setError('Invalid or expired verification code.');
        setIsVerifyingOTP(false);
        return;
      }
      await signup({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        profileImage: profileImage || undefined,
        adminId: adminId || undefined,
        sectionId: selectedSectionId || undefined,
        subjectIds: selectedSubjectIds.length > 0 ? selectedSubjectIds : undefined,
        gradeLevel: selectedGradeLevel || undefined,
      });
      if (regCode.trim()) {
        await incrementLinkUsage(regCode.trim().toUpperCase());
      }
      router.replace('/(student)/home' as any);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setIsSendingOTP(true);
    try {
      const code = await resendOTP(email.trim().toLowerCase());
      Alert.alert('OTP Resent', `New verification code: ${code}`);
    } catch (err) {
      setError('Failed to resend OTP.');
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleStep3Next = async () => {
    setError('');
    if (!adminId && regCode.trim()) {
      await validateRegCodeInput();
    }
    if (adminId || regCode.trim()) {
      await handleProceedToOTP();
    }
  };

  const onPressIn = () => Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();

  const availableSections = adminId ? sections.filter(s => s.adminId === adminId) : sections;
  const availableSubjects = adminId ? subjects.filter(s => s.adminId === adminId) : subjects;

  const totalSteps = 4;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>
          {step === 1 ? 'Create Account' : step === 2 ? 'Select Section & Subjects' : step === 3 ? 'Invitation Code' : 'Verify Email'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 1
            ? 'Join AIRA and start your learning journey'
            : step === 2
              ? 'Choose your section and subjects to enroll in'
              : step === 3
                ? 'Enter the invitation code provided by your instructor'
                : `Enter the verification code sent to ${email.trim()}`}
        </Text>

        <View style={styles.progressContainer}>
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
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
            <View style={styles.profileSection}>
              <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Camera size={32} color={Colors.textMuted} />
                  </View>
                )}
                <View style={styles.uploadBadge}>
                  <Upload size={14} color="#FFF" />
                </View>
              </TouchableOpacity>
              <Text style={styles.profileText}>
                {profileImage ? 'Tap to change photo' : 'Tap to add profile photo'}
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={Colors.textMuted} value={fullName} onChangeText={setFullName} testID="signup-fullname" />
            </View>
            <View style={styles.inputContainer}>
              <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Username" placeholderTextColor={Colors.textMuted} value={username} onChangeText={setUsername} autoCapitalize="none" testID="signup-username" />
            </View>
            <View style={styles.inputContainer}>
              <Mail size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="signup-email" />
            </View>
            <View style={styles.inputContainer}>
              <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} testID="signup-password" />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                {showPassword ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor={Colors.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} testID="signup-confirm" />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeIcon}>
                {showConfirm ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={styles.signUpButton}
                onPress={handleNext}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={0.8}
              >
                <Text style={styles.signUpButtonText}>Next</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.sectionLabel}>Select Grade Level</Text>
            <View style={styles.optionsContainer}>
              {GRADE_LEVELS.map((grade) => (
                <TouchableOpacity
                  key={grade}
                  style={[styles.optionCard, selectedGradeLevel === grade && styles.optionCardSelected]}
                  onPress={() => setSelectedGradeLevel(grade)}
                >
                  <GraduationCap size={20} color={selectedGradeLevel === grade ? Colors.primary : Colors.textMuted} />
                  <Text style={[styles.optionText, selectedGradeLevel === grade && styles.optionTextSelected]}>{grade}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Select Your Section</Text>
            {availableSections.length === 0 ? (
              <Text style={styles.emptyText}>No sections available</Text>
            ) : (
              <View style={styles.optionsContainer}>
                {availableSections.map((section) => (
                  <TouchableOpacity
                    key={section.id}
                    style={[styles.optionCard, selectedSectionId === section.id && styles.optionCardSelected]}
                    onPress={() => setSelectedSectionId(section.id)}
                  >
                    <Users size={20} color={selectedSectionId === section.id ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.optionText, selectedSectionId === section.id && styles.optionTextSelected]}>{section.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.sectionLabel}>Select Subjects to Enroll</Text>
            {availableSubjects.length === 0 ? (
              <Text style={styles.emptyText}>No subjects available</Text>
            ) : (
              <View style={styles.optionsContainer}>
                {availableSubjects.map((subject) => (
                  <TouchableOpacity
                    key={subject.id}
                    style={[styles.optionCard, selectedSubjectIds.includes(subject.id) && styles.optionCardSelected]}
                    onPress={() => toggleSubject(subject.id)}
                  >
                    <BookOpen size={20} color={selectedSubjectIds.includes(subject.id) ? Colors.primary : Colors.textMuted} />
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionText, selectedSubjectIds.includes(subject.id) && styles.optionTextSelected]}>{subject.name}</Text>
                      <Text style={styles.optionCode}>{subject.code}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <Animated.View style={{ flex: 1, transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.signUpButton, { marginTop: 0 }]}
                  onPress={() => adminId ? handleProceedToOTP() : setStep(3)}
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}
                  disabled={isSendingOTP}
                  activeOpacity={0.8}
                >
                  <Text style={styles.signUpButtonText}>
                    {isSendingOTP ? 'Sending OTP...' : adminId ? 'Next' : 'Enter Invitation Code'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <View style={styles.inputContainer}>
              <Hash size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter Invitation Code"
                placeholderTextColor={Colors.textMuted}
                value={regCode}
                onChangeText={setRegCode}
                autoCapitalize="characters"
                maxLength={8}
              />
            </View>

            {adminId && (
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>Code validated successfully</Text>
              </View>
            )}

            <Text style={styles.helpText}>
              Enter the invitation code provided by your instructor or scan the QR code they shared with you.
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <Animated.View style={{ flex: 1, transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.signUpButton, { marginTop: 0 }]}
                  onPress={handleStep3Next}
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}
                  disabled={signupPending || isValidatingCode || isSendingOTP}
                  activeOpacity={0.8}
                >
                  <Text style={styles.signUpButtonText}>
                    {isValidatingCode ? 'Validating...' : isSendingOTP ? 'Sending OTP...' : 'Verify & Continue'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </>
        )}

        {step === 4 && (
          <>
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
                  testID="signup-otp"
                />
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
                <TouchableOpacity
                  style={[styles.signUpButton, (isVerifyingOTP || signupPending) && styles.buttonDisabled]}
                  onPress={handleVerifyAndSignup}
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}
                  disabled={isVerifyingOTP || signupPending}
                  activeOpacity={0.8}
                >
                  <Text style={styles.signUpButtonText}>
                    {isVerifyingOTP || signupPending ? 'Verifying...' : 'Verify & Complete Registration'}
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
          <TouchableOpacity onPress={() => router.back()}>
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
  title: { fontSize: 28, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  errorBox: { backgroundColor: 'rgba(255,107,107,0.15)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: Colors.error, fontSize: 13, textAlign: 'center' as const },
  profileSection: { alignItems: 'center', marginBottom: 24 },
  profileImageContainer: { position: 'relative' as const },
  profileImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.primary },
  profilePlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
  uploadBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.background },
  profileText: { marginTop: 12, fontSize: 14, color: Colors.textSecondary },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 14, paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.text, fontSize: 15, height: '100%' },
  eyeIcon: { padding: 6 },
  sectionLabel: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginTop: 16, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic' as const, marginBottom: 16 },
  optionsContainer: { gap: 10, marginBottom: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  optionContent: { flex: 1 },
  optionText: { fontSize: 15, color: Colors.text, fontWeight: '500' as const },
  optionTextSelected: { color: Colors.primary, fontWeight: '600' as const },
  optionCode: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  backBtnText: { color: Colors.text, fontSize: 15, fontWeight: '500' as const },
  signUpButton: { backgroundColor: Colors.primary, borderRadius: 12, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  signUpButtonText: { color: '#000', fontSize: 16, fontWeight: '700' as const },
  helpText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' as const, marginBottom: 20, lineHeight: 20 },
  successBadge: {
    backgroundColor: Colors.success + '15',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  successBadgeText: { fontSize: 13, color: Colors.success, textAlign: 'center' as const, fontWeight: '500' as const },
  otpSection: { alignItems: 'center', paddingTop: 20 },
  otpIcon: { marginBottom: 16 },
  otpLabel: { fontSize: 18, fontWeight: '600' as const, color: Colors.text, marginBottom: 20 },
  otpInput: { textAlign: 'center' as const, fontSize: 24, letterSpacing: 8, fontWeight: '700' as const },
  resendBtn: { marginTop: 20, padding: 10 },
  resendText: { fontSize: 14, color: Colors.accent, fontWeight: '500' as const },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginLabel: { color: Colors.textSecondary, fontSize: 14 },
  loginLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' as const },
});
