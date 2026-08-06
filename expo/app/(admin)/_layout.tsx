import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { LayoutDashboard, BookOpen, Users, UserCircle, KeyRound, ShieldCheck, ClipboardCheck, MessageCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useChat } from '@/contexts/ChatContext';

function ChatBadge({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <View style={styles.badgeContainer}>
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
      </View>
    </View>
  );
}

export default function AdminTabLayout() {
  const { currentUser } = useAuth();
  const { colors } = useTheme();
  const { totalUnread } = useChat();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fadeAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingBottom: 4,
            height: 56,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600' as const,
          },
          tabBarIconStyle: {
            marginTop: 2,
          },
          sceneStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="subjects-mgmt"
          options={{
            title: 'Subjects',
            tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="sections-mgmt"
          options={{
            title: 'Sections',
            tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="scores"
          options={{
            title: 'Scores',
            tabBarIcon: ({ color, size }) => <ClipboardCheck size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size }) => (
              <View>
                <MessageCircle size={size} color={color} />
                {totalUnread > 0 && <ChatBadge count={totalUnread} color={colors.error} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="reg-links"
          options={{
            title: 'Access',
            tabBarIcon: ({ color, size }) => <KeyRound size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin-management"
          options={{
            title: 'Admins',
            href: isSuperAdmin ? undefined : null,
            tabBarIcon: ({ color, size }) => <ShieldCheck size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <UserCircle size={size} color={color} />,
          }}
        />
      </Tabs>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute' as const,
    top: -4,
    right: -10,
    zIndex: 10,
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
