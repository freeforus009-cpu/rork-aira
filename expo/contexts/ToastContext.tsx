import { useState, useCallback, useRef, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  createdAt: number;
  pausedAt?: number | null;
  elapsedAtPause?: number;
}

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;

export const [ToastProvider, useToast] = createContextHook(() => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const show = useCallback((type: ToastType, message: string, options?: { title?: string; duration?: number }) => {
    const duration = options?.duration ?? DEFAULT_DURATION;
    const id = `toast_${++counterRef.current}`;

    setToasts((prev) => {
      // Prevent duplicate notifications (same type + message within 2 seconds)
      const isDuplicate = prev.some(
        (t) => t.type === type && t.message === message && Date.now() - t.createdAt < 2000
      );
      if (isDuplicate) return prev;

      const toast: ToastMessage = {
        id,
        type,
        message,
        title: options?.title,
        duration: duration > 0 ? duration : undefined,
        createdAt: Date.now(),
        pausedAt: null,
        elapsedAtPause: 0,
      };

      // Limit stack to MAX_TOASTS — remove oldest
      const updated = [...prev, toast];
      return updated.length > MAX_TOASTS ? updated.slice(updated.length - MAX_TOASTS) : updated;
    });

    return id;
  }, []);

  const success = useCallback((message: string, duration?: number) => show('success', message, { duration }), [show]);
  const error = useCallback((message: string, duration?: number) => show('error', message, { duration: duration ?? 5000 }), [show]);
  const info = useCallback((message: string, duration?: number) => show('info', message, { duration }), [show]);
  const warning = useCallback((message: string, duration?: number) => show('warning', message, { duration }), [show]);

  const pauseToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) =>
        t.id === id && t.duration && !t.pausedAt
          ? { ...t, pausedAt: Date.now(), elapsedAtPause: Date.now() - t.createdAt }
          : t
      )
    );
  }, []);

  const resumeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id || !t.pausedAt) return t;
        const pausedDuration = Date.now() - t.pausedAt;
        return {
          ...t,
          pausedAt: null,
          createdAt: t.createdAt + pausedDuration,
        };
      })
    );
  }, []);

  return { toasts, show, success, error, info, warning, dismiss, dismissAll, pauseToast, resumeToast };
});
