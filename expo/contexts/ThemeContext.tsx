import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useColorScheme, Appearance } from 'react-native';
import { useEffect, useMemo, useState, useCallback } from 'react';
import Colors from '@/constants/colors';

const THEME_KEY = 'aira_theme_preference';

export type ThemeMode = 'light' | 'dark' | 'auto';

export const lightColors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceLight: '#F0F4F8',
  surfaceElevated: '#FFFFFF',
  primary: '#00A88A',
  primaryDark: '#008B72',
  primaryLight: '#33D4B8',
  primarySoft: 'rgba(0,168,138,0.10)',
  accent: '#4A90D9',
  accentLight: '#7DBCE0',
  accentSoft: 'rgba(74,144,217,0.10)',
  text: '#1A202C',
  textSecondary: '#4A5568',
  textMuted: '#718096',
  textBright: '#1A202C',
  border: '#E2E8F0',
  borderLight: '#CBD5E0',
  borderFocus: '#00A88A',
  error: '#E53E3E',
  errorSoft: 'rgba(229,62,62,0.08)',
  warning: '#D69E2E',
  warningSoft: 'rgba(214,158,46,0.10)',
  success: '#00A88A',
  successSoft: 'rgba(0,168,138,0.10)',
  locked: '#A0AEC0',
  lockedSoft: 'rgba(160,174,192,0.12)',
  info: '#4A90D9',
  infoSoft: 'rgba(74,144,217,0.10)',
  danger: '#E53E3E',
  dangerSoft: 'rgba(229,62,62,0.08)',
  inputBg: '#FFFFFF',
  inputFocus: '#F0F4F8',
  overlay: 'rgba(0,0,0,0.45)',
  cardGradientStart: '#FFFFFF',
  cardGradientEnd: '#F0F4F8',
  pdfColor: '#E53E3E',
  pptColor: '#DD6B20',
  docColor: '#4A90D9',
  imageColor: '#805AD5',
  videoColor: '#E53E3E',
  youtubeColor: '#FF0000',
  textColor: '#00A88A',
  glowPrimary: 'rgba(0,168,138,0.15)',
  glowAccent: 'rgba(74,144,217,0.12)',
  glowError: 'rgba(229,62,62,0.12)',
};

export type ThemeColors = typeof Colors & typeof lightColors;

function getColorPalette(isDark: boolean): ThemeColors {
  return (isDark ? Colors : lightColors) as ThemeColors;
}

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [themePreference, setThemePreference] = useState<ThemeMode>('dark');
  const [isReady, setIsReady] = useState<boolean>(false);
  const systemColorScheme = useColorScheme();

  // Load persisted theme preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        setThemePreference(stored as ThemeMode);
      }
      setIsReady(true);
    }).catch(() => setIsReady(true));
  }, []);

  const isDark = useMemo(() => {
    if (themePreference === 'dark') return true;
    if (themePreference === 'light') return false;
    return systemColorScheme !== 'light';
  }, [themePreference, systemColorScheme]);

  const colors = useMemo(() => getColorPalette(isDark), [isDark]);

  // Apply the color scheme override to the system (affects useColorScheme globally)
  useEffect(() => {
    if (isReady) {
      try {
        Appearance.setColorScheme(isDark ? 'dark' : 'light');
      } catch {
        // Appearance.setColorScheme may not be available on all platforms
      }
    }
  }, [isDark, isReady]);

  const setTheme = useCallback(async (theme: ThemeMode) => {
    setThemePreference(theme);
    try {
      await AsyncStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      console.log('[Theme] Failed to persist theme preference', e);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const next: ThemeMode = isDark ? 'light' : 'dark';
    await setTheme(next);
  }, [isDark, setTheme]);

  return {
    colors,
    isDark,
    themePreference,
    isReady,
    setTheme,
    toggleTheme,
  };
});
