import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { OTPProvider } from "@/contexts/OTPContext";
import { ConnectivityProvider } from "@/contexts/ConnectivityContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { ChatProvider } from "@/contexts/ChatContext";
import ToastContainer from "@/components/ToastContainer";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { currentUser, isInitialized } = useAuth();

  useEffect(() => {
    if (!isInitialized) return;
    const firstSegment = segments[0];
    const protectedRoute = firstSegment === '(admin)' || firstSegment === '(student)' || ['coc', 'lo', 'quiz', 'student-detail', 'submissions', 'chat'].includes(firstSegment ?? '');
    const publicRoute = firstSegment === 'login' || firstSegment === 'signup' || firstSegment === 'admin-signup' || firstSegment === 'forgot-password';

    if (!currentUser && protectedRoute) {
      router.replace('/login' as any);
      return;
    }
    if (currentUser?.role === 'student' && firstSegment === '(admin)') {
      router.replace('/(student)/home' as any);
      return;
    }
    if (currentUser && firstSegment === '(student)' && currentUser.role !== 'student') {
      router.replace('/(admin)/dashboard' as any);
      return;
    }
    if (currentUser && publicRoute) {
      router.replace(currentUser.role === 'student' ? '/(student)/home' as any : '/(admin)/dashboard' as any);
    }
  }, [currentUser, isInitialized, router, segments]);

  // Prevent back-button access to protected pages after logout (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || currentUser || !isInitialized) return;
    const blockedSegments = ['(admin)', '(student)', 'coc', 'lo', 'quiz', 'student-detail', 'submissions', 'chat'];
    const firstSegment = segments[0];
    if (blockedSegments.includes(firstSegment ?? '')) {
      try {
        window.history.replaceState(null, '', '/login');
        window.history.pushState(null, '', '/login');
        window.history.pushState(null, '', '/login');
      } catch { /* noop */ }
    }
  }, [currentUser, isInitialized, segments]);

  // Listen for popstate events to prevent back navigation to protected pages after logout (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || currentUser || !isInitialized) return;
    const handlePopState = () => {
      const firstSegment = segments[0];
      const blockedSegments = ['(admin)', '(student)', 'coc', 'lo', 'quiz', 'student-detail', 'submissions', 'chat'];
      if (blockedSegments.includes(firstSegment ?? '')) {
        try {
          window.history.replaceState(null, '', '/login');
        } catch { /* noop */ }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, isInitialized, segments]);

  return <>{children}</>;
}

function RootLayoutNav() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="admin-signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(student)" />
      <Stack.Screen
        name="coc/[cocId]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
          title: "Learning Outcomes",
        }}
      />
      <Stack.Screen
        name="lo/[loId]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
          title: "Learning Materials",
        }}
      />
      <Stack.Screen
        name="quiz/[loId]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
          title: "Quiz",
        }}
      />
      <Stack.Screen
        name="student-detail/[studentId]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
          title: "Student Details",
        }}
      />
      <Stack.Screen
        name="submissions/[loId]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
          title: "Submissions",
        }}
      />
      <Stack.Screen
        name="subject/[subjectId]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
          title: "Subject",
        }}
      />
      <Stack.Screen
        name="chat/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="chat/[conversationId]"
        options={{
          headerShown: false,
        }}
      />

    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AuthProvider>
            <ConnectivityProvider>
              <OTPProvider>
                <DataProvider>
                  <ToastProvider>
                    <ChatProvider>
                      <RouteGuard>
                        <RootLayoutNav />
                      </RouteGuard>
                      <ToastContainer />
                    </ChatProvider>
                  </ToastProvider>
                </DataProvider>
              </OTPProvider>
            </ConnectivityProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
