import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform, Pressable,
} from 'react-native';
import {
  CheckCircle, XCircle, Info, AlertTriangle, X,
} from 'lucide-react-native';
import { useToast, ToastType, ToastMessage } from '@/contexts/ToastContext';
import Colors from '@/constants/colors';

const iconMap: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap: Record<ToastType, string> = {
  success: Colors.success,
  error: Colors.error,
  info: Colors.accent,
  warning: Colors.warning,
};

const bgColorMap: Record<ToastType, string> = {
  success: 'rgba(0,201,167,0.12)',
  error: 'rgba(255,107,107,0.12)',
  info: 'rgba(91,164,207,0.12)',
  warning: 'rgba(255,217,61,0.12)',
};

function ToastItem({
  toast,
  index,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: ToastMessage;
  index: number;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const Icon = iconMap[toast.type];
  const color = colorMap[toast.type];
  const bgColor = bgColorMap[toast.type];

  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const [isExiting, setIsExiting] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(iconScaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, opacityAnim, iconScaleAnim]);

  // Progress bar countdown
  useEffect(() => {
    if (!toast.duration || toast.pausedAt !== null && toast.pausedAt !== undefined) return;
    if (toast.pausedAt === null) {
      // Reset progress to full and animate down
      progressAnim.setValue(1);
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: toast.duration,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    }
  }, [toast.duration, toast.pausedAt, progressAnim]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!toast.duration) return;
    let remaining = toast.duration;
    let startTime = Date.now();

    if (toast.pausedAt !== null && toast.pausedAt !== undefined && toast.pausedAt !== null) {
      remaining = toast.duration - (toast.elapsedAtPause ?? 0);
      startTime = Date.now();
    }

    const timer = setTimeout(() => {
      handleExit();
    }, remaining);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.duration, toast.pausedAt, toast.elapsedAtPause]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const handleExit = () => {
    if (isExiting) return;
    setIsExiting(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const handlePress = () => {
    handleExit();
  };

  const handleHoverIn = () => {
    if (Platform.OS === 'web') {
      onPause(toast.id);
    }
  };

  const handleHoverOut = () => {
    if (Platform.OS === 'web') {
      onResume(toast.id);
    }
  };

  const isReducedMotion = Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: Colors.surface, borderLeftColor: color },
        {
          transform: [{ translateY: isReducedMotion ? 0 : slideAnim }],
          opacity: isReducedMotion ? 1 : opacityAnim,
        },
      ]}
      // @ts-expect-error web-only hover handlers
      onMouseEnter={handleHoverIn}
      onMouseLeave={handleHoverOut}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.toastInner, { backgroundColor: bgColor }]}>
        <Animated.View style={{ transform: [{ scale: isReducedMotion ? 1 : iconScaleAnim }] }}>
          <Icon size={22} color={color} strokeWidth={2.5} />
        </Animated.View>
        <View style={styles.toastContent}>
          {toast.title && <Text style={styles.toastTitle}>{toast.title}</Text>}
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
        <TouchableOpacity onPress={handlePress} style={styles.closeBtn} accessibilityLabel="Dismiss notification">
          <X size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      {toast.duration && (
        <Animated.View
          style={[
            styles.progressBar,
            {
              backgroundColor: color,
            },
            Platform.OS === 'web'
              ? {
                  transform: [{ scaleX: progressAnim as any }],
                  transformOrigin: 'left' as const,
                }
              : {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }) as any,
                },
          ]}
        />
      )}
    </Animated.View>
  );
}

export default function ToastContainer() {
  const { toasts, dismiss, pauseToast, resumeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          index={index}
          onDismiss={dismiss}
          onPause={pauseToast}
          onResume={resumeToast}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    top: Platform.OS === 'web' ? 20 : 50,
    left: Platform.OS === 'web' ? '50%' : 16,
    right: Platform.OS === 'web' ? undefined : 16,
    zIndex: 99999,
    gap: 10,
    ...(Platform.OS === 'web'
      ? {
          transform: [{ translateX: '-50%' as unknown as number }],
          minWidth: 340,
          maxWidth: 480,
        }
      : {}),
  },
  toast: {
    borderRadius: 14,
    borderLeftWidth: 4,
    elevation: 10,
    overflow: 'hidden' as const,
    ...(Platform.OS === 'web'
      ? { width: '100%' as any }
      : {}),
  },
  toastInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toastContent: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  toastText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  progressBar: {
    height: 3,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 14,
  },
});
