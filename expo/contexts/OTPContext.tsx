import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { OTPCode } from '@/types';

const OTP_KEY = 'aira_otp_codes';
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const BRUTE_FORCE_LOCK_MINUTES = 15;

function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const [OTPProvider, useOTP] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [lastSentEmail, setLastSentEmail] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState<number>(0);
  const [verifyAttempts, setVerifyAttempts] = useState<number>(0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const otpQuery = useQuery({
    queryKey: ['otp_codes'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(OTP_KEY);
      if (stored) return JSON.parse(stored) as OTPCode[];
      return [] as OTPCode[];
    },
  });

  const saveOTPs = useCallback(async (codes: OTPCode[]) => {
    await AsyncStorage.setItem(OTP_KEY, JSON.stringify(codes));
    queryClient.setQueryData(['otp_codes'], codes);
  }, [queryClient]);

  useEffect(() => {
    if (resendCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      };
    }
  }, [resendCountdown]);

  const sendOTP = useCallback(async (email: string): Promise<string> => {
    const codes = otpQuery.data ?? [];
    const emailLower = email.toLowerCase().trim();

    const existing = codes.find((c) => c.email === emailLower);
    if (existing?.lockedUntil && new Date(existing.lockedUntil) > new Date()) {
      const remaining = Math.ceil((new Date(existing.lockedUntil).getTime() - Date.now()) / 60000);
      throw new Error(`Too many attempts. Please try again in ${remaining} minute(s).`);
    }

    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const resendAvailableAt = new Date(Date.now() + RESEND_COOLDOWN_SECONDS * 1000).toISOString();

    const filtered = codes.filter((c) => c.email !== emailLower);
    const newOTP: OTPCode = {
      email: emailLower,
      code,
      expires_at: expiresAt,
      attempts: 0,
      resendAvailableAt,
    };
    await saveOTPs([...filtered, newOTP]);

    setLastSentEmail(emailLower);
    setVerifyAttempts(0);
    setLockedUntil(null);
    setResendCountdown(RESEND_COOLDOWN_SECONDS);

    console.log(`[OTP] Code sent to ${emailLower}: ${code}`);
    return code;
  }, [otpQuery.data, saveOTPs]);

  const verifyOTP = useCallback(async (email: string, inputCode: string): Promise<boolean> => {
    const codes = otpQuery.data ?? [];
    const emailLower = email.toLowerCase().trim();
    const otpRecord = codes.find((c) => c.email === emailLower);

    if (!otpRecord) {
      console.log('[OTP] No OTP found for', emailLower);
      return false;
    }

    if (otpRecord.lockedUntil && new Date(otpRecord.lockedUntil) > new Date()) {
      const remaining = Math.ceil((new Date(otpRecord.lockedUntil).getTime() - Date.now()) / 60000);
      throw new Error(`Account locked. Please try again in ${remaining} minute(s).`);
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      console.log('[OTP] OTP expired for', emailLower);
      const filtered = codes.filter((c) => c.email !== emailLower);
      await saveOTPs(filtered);
      return false;
    }

    const currentAttempts = (otpRecord.attempts ?? 0) + 1;
    setVerifyAttempts(currentAttempts);

    if (otpRecord.code !== inputCode) {
      console.log('[OTP] Invalid code for', emailLower, 'attempt', currentAttempts);

      if (currentAttempts >= MAX_OTP_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + BRUTE_FORCE_LOCK_MINUTES * 60 * 1000);
        setLockedUntil(lockUntil);
        const updated = codes.map((c) =>
          c.email === emailLower ? { ...c, attempts: currentAttempts, lockedUntil: lockUntil.toISOString() } : c,
        );
        await saveOTPs(updated);
        throw new Error(`Too many invalid attempts. Locked for ${BRUTE_FORCE_LOCK_MINUTES} minutes.`);
      }

      const updated = codes.map((c) =>
        c.email === emailLower ? { ...c, attempts: currentAttempts } : c,
      );
      await saveOTPs(updated);
      return false;
    }

    const filtered = codes.filter((c) => c.email !== emailLower);
    await saveOTPs(filtered);
    setVerifyAttempts(0);
    setLockedUntil(null);
    console.log('[OTP] Verified successfully for', emailLower);
    return true;
  }, [otpQuery.data, saveOTPs]);

  const resendOTP = useCallback(async (email: string): Promise<string> => {
    const emailLower = email.toLowerCase().trim();
    const codes = otpQuery.data ?? [];
    const existing = codes.find((c) => c.email === emailLower);

    if (existing?.resendAvailableAt && new Date(existing.resendAvailableAt) > new Date()) {
      const remaining = Math.ceil((new Date(existing.resendAvailableAt).getTime() - Date.now()) / 1000);
      throw new Error(`Please wait ${remaining}s before resending.`);
    }

    return sendOTP(email);
  }, [otpQuery.data, sendOTP]);

  const canResend = resendCountdown === 0;

  return {
    sendOTP,
    verifyOTP,
    resendOTP,
    lastSentEmail,
    resendCountdown,
    canResend,
    verifyAttempts,
    maxAttempts: MAX_OTP_ATTEMPTS,
    isLocked: lockedUntil !== null && lockedUntil > new Date(),
    lockedUntil,
  };
});
