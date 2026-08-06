import React, { useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import {
  Bell, Megaphone, BookOpen, ClipboardCheck, Calendar, TrendingUp, Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { AppNotification, NotificationType } from '@/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ICON_MAP: Record<NotificationType, typeof Bell> = {
  announcement: Megaphone,
  lesson_uploaded: BookOpen,
  quiz_available: ClipboardCheck,
  deadline_approaching: Calendar,
  grade_released: TrendingUp,
};

interface NotificationItemProps {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationItemInner({ notification, onMarkRead, onDelete }: NotificationItemProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;     // x translate
  const opacityAnim = useRef(new Animated.Value(1)).current;    // fade
  const heightAnim = useRef(new Animated.Value(1)).current;     // collapse (0..1 scale of measured height)
  const readPulse = useRef(new Animated.Value(notification.isRead ? 0 : 1)).current;
  const measuredHeight = useRef(0);
  const isDeleting = useRef(false);

  const Icon = ICON_MAP[notification.type] ?? Bell;
  const isUnread = !notification.isRead;

  // Animate the "read" indicator pulse when transitioning to read
  useEffect(() => {
    if (!isUnread) {
      Animated.timing(readPulse, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [isUnread]);

  const handlePress = useCallback(() => {
    if (isUnread) {
      onMarkRead(notification.id);
    }
  }, [isUnread, notification.id, onMarkRead]);

  const handleDelete = useCallback(() => {
    if (isDeleting.current) return;
    isDeleting.current = true;

    // Configure layout animation so siblings slide up smoothly
    LayoutAnimation.configureNext(
      LayoutAnimation.create(300, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity)
    );

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Collapse height after slide-out
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        onDelete(notification.id);
      });
    });
  }, [notification.id, onDelete]);

  const animatedHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, measuredHeight.current || 9999],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateX: slideAnim }],
          opacity: opacityAnim,
          height: measuredHeight.current > 0 ? animatedHeight : undefined,
          overflow: 'hidden',
        },
      ]}
      onLayout={(e) => {
        if (measuredHeight.current === 0) {
          measuredHeight.current = e.nativeEvent.layout.height;
        }
      }}
    >
      <View style={[styles.notifItem, isUnread && styles.notifItemUnread]}>
        {/* Unread accent bar on the left edge */}
        {isUnread && (
          <Animated.View style={[styles.notifAccentBar, { opacity: readPulse }]} />
        )}

        {/* Icon / read indicator */}
        <TouchableOpacity
          style={[styles.notifIconWrap, isUnread && styles.notifIconWrapUnread]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <Icon size={14} color={isUnread ? Colors.primary : Colors.textMuted} />
        </TouchableOpacity>

        {/* Main content - tap to mark read */}
        <TouchableOpacity
          style={styles.notifItemInfo}
          onPress={handlePress}
          activeOpacity={0.85}
        >
          <View style={styles.notifTitleRow}>
            <Text style={[styles.notifItemTitle, isUnread && styles.notifItemTitleUnread]} numberOfLines={1}>
              {notification.title}
            </Text>
            {/* "NEW" badge - prominent label for unread items */}
            <Animated.View style={[styles.notifNewBadge, { opacity: readPulse }]}>
              <Text style={styles.notifNewBadgeText}>NEW</Text>
            </Animated.View>
          </View>
          <Text style={[styles.notifItemMsg, isUnread && styles.notifItemMsgUnread]} numberOfLines={2}>{notification.message}</Text>
          <Text style={styles.notifItemDate}>
            {new Date(notification.createdAt).toLocaleDateString()} ·{' '}
            {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>

        {/* Unread dot - larger pulsing dot that fades out when read */}
        <Animated.View style={[styles.notifUnreadDotWrap, { opacity: readPulse }]}>
          <View style={styles.notifUnreadDot} />
        </Animated.View>

        {/* Delete button */}
        <TouchableOpacity
          style={styles.notifDeleteBtn}
          onPress={handleDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Trash2 size={15} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const NotificationItem = React.memo(NotificationItemInner);
export default NotificationItem;

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  notifItemUnread: {
    backgroundColor: Colors.primary + '0D',
    paddingHorizontal: 10,
    marginHorizontal: -8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  notifIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifIconWrapUnread: {
    backgroundColor: Colors.successSoft,
  },
  notifItemInfo: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifItemTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  notifItemTitleUnread: {
    fontWeight: '800' as const,
    color: Colors.text,
    flexShrink: 0,
  },
  notifNewBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    flexShrink: 0,
  },
  notifNewBadgeText: {
    fontSize: 8,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  notifItemMsg: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  notifItemMsgUnread: {
    color: Colors.text,
    fontWeight: '500' as const,
  },
  notifItemDate: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  notifUnreadDotWrap: {
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  notifUnreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
  },
  notifAccentBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  notifDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.errorSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
