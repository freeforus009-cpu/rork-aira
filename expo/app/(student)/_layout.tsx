import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, BookOpen, BarChart3, UserCircle, ClipboardList, MessageCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useChat } from '@/contexts/ChatContext';

function NotificationBadge({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <View style={styles.badgeContainer}>
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
      </View>
    </View>
  );
}

export default function StudentTabLayout() {
  const { currentUser } = useAuth();
  const { getUnreadNotificationCount, getUndismissedAnnouncements } = useData();
  const { totalUnread: chatUnread } = useChat();
  const { colors } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const unreadCount = currentUser ? getUnreadNotificationCount(currentUser.id) : 0;
  const unreadAnnCount = currentUser ? getUndismissedAnnouncements(
    currentUser.id, currentUser.adminId, currentUser.sectionId, currentUser.gradeLevel
  ).length : 0;
  const totalNotifUnread = unreadCount + unreadAnnCount;

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
          name="home"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <View>
                <Home size={size} color={color} />
                {totalNotifUnread > 0 && <NotificationBadge count={totalNotifUnread} color={colors.error} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="my-courses"
          options={{
            title: 'Courses',
            tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="my-progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="quiz-history"
          options={{
            title: 'Quiz History',
            tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size }) => (
              <View>
                <MessageCircle size={size} color={color} />
                {chatUnread > 0 && <NotificationBadge count={chatUnread} color={colors.error} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="student-profile"
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
