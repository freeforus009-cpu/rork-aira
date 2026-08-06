import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Animated,
  TextInput, RefreshControl, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  BookOpen, ChevronRight, Megaphone, X, BellRing,
  AlertCircle, Search, Bell, ClipboardCheck, CheckCircle, Clock, RefreshCw,
  TrendingUp, Flame, Calendar, Layers,
} from 'lucide-react-native';
import NotificationItem from '@/components/NotificationItem';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import OfflineBanner from '@/components/OfflineBanner';
import EmptyState from '@/components/EmptyState';
import SkeletonLoader from '@/components/SkeletonLoader';
import Colors from '@/constants/colors';
import type { Announcement } from '@/types';

export default function StudentHomeScreen() {
  const router = useRouter();
  const { currentUser, subjects, allUsers } = useAuth();
  const {
    getUndismissedAnnouncements, dismissAnnouncements,
    getStudentPendingReminders, getStudentQuizStats,
    getUnreadNotificationCount, getQuizDisplayStatus, getSubjectLOs,
    getStudentNotifications, markNotificationRead, markAllNotificationsRead,
    deleteNotification, setActiveSubjectId, getSubjectCOCs,
    refreshFromCloud,
  } = useData();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showReminder, setShowReminder] = useState<boolean>(false);
  const [reminderOpacity] = useState(() => new Animated.Value(0));
  const [reminderDismissed, setReminderDismissed] = useState<boolean>(false);
  const [showAnnPopup, setShowAnnPopup] = useState<boolean>(false);
  const [popupOpacity] = useState(() => new Animated.Value(0));
  const [isDashLoading, setIsDashLoading] = useState<boolean>(true);

  // === DATA ===
  const enrolledSubjects = useMemo(() => {
    if (!currentUser) return [];
    const enrolledIds = currentUser.subjectIds || [];
    return subjects.filter(s => enrolledIds.includes(s.id) && !s.archived);
  }, [currentUser, subjects]);

  const enrolledSubjectIds = useMemo(() => enrolledSubjects.map(s => s.id), [enrolledSubjects]);

  const filteredSubjects = useMemo(() => {
    if (!subjectSearch.trim()) return enrolledSubjects;
    const q = subjectSearch.toLowerCase().trim();
    return enrolledSubjects.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q)
    );
  }, [enrolledSubjects, subjectSearch]);

  const undismissedAnnouncements = useMemo(() => {
    if (!currentUser) return [];
    return getUndismissedAnnouncements(currentUser.id, currentUser.adminId, currentUser.sectionId, currentUser.gradeLevel);
  }, [currentUser, getUndismissedAnnouncements]);

  const unreadCount = useMemo(() => {
    if (!currentUser) return 0;
    return getUnreadNotificationCount(currentUser.id);
  }, [currentUser, getUnreadNotificationCount]);

  const unreadAnnCount = useMemo(() => undismissedAnnouncements.length, [undismissedAnnouncements]);

  const pendingReminders = useMemo(() => {
    if (!currentUser) return [];
    return getStudentPendingReminders(currentUser.id, enrolledSubjectIds);
  }, [currentUser, enrolledSubjectIds, getStudentPendingReminders]);

  const studentNotifications = useMemo(() => {
    if (!currentUser) return [];
    return getStudentNotifications(currentUser.id);
  }, [currentUser, getStudentNotifications]);

  // === EFFECTS ===
  useEffect(() => {
    const timer = setTimeout(() => setIsDashLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (undismissedAnnouncements.length > 0) {
      setShowAnnPopup(true);
      Animated.timing(popupOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [undismissedAnnouncements.length]);

  useEffect(() => {
    if (pendingReminders.length > 0 && !reminderDismissed) {
      const timer = setTimeout(() => {
        setShowReminder(true);
        Animated.timing(reminderOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [pendingReminders.length, reminderDismissed, reminderOpacity]);

  // === HANDLERS ===
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFromCloud();
    } finally {
      setRefreshing(false);
    }
  }, [refreshFromCloud]);

  const closeReminder = () => {
    Animated.timing(reminderOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setShowReminder(false);
      setReminderDismissed(true);
    });
  };

  const closeAnnPopup = () => {
    const ids = undismissedAnnouncements.map(a => a.id);
    Animated.timing(popupOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowAnnPopup(false);
      if (ids.length > 0) dismissAnnouncements(ids);
    });
  };

  const getTeacherName = (subjectAdminId: string): string => {
    const teacher = allUsers.find((u: { id: string; fullName: string }) => u.id === subjectAdminId);
    return teacher?.fullName ?? 'Unknown Teacher';
  };

  const getSubjectQuizStats = (subjectId: string) => {
    if (!currentUser) return { completed: 0, pending: 0 };
    const los = getSubjectLOs(subjectId);
    let completed = 0, pending = 0;
    for (const lo of los) {
      const status = getQuizDisplayStatus(currentUser.id, lo.id, subjectId);
      if (status === 'completed') completed++;
      else if (status === 'not_started' || status === 'in_progress') pending++;
    }
    return { completed, pending };
  };

  const getAnnouncementAuthor = (ann: Announcement): string => {
    const author = allUsers.find((u: { id: string; fullName: string; role: string }) => u.id === ann.adminId);
    if (author) {
      if (author.role === 'super_admin') return 'Super Admin';
      return author.fullName;
    }
    return 'System';
  };

  if (!currentUser) return null;

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{currentUser.fullName}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => setShowNotifications(true)}
                style={styles.bellBtn}
              >
                <Bell size={20} color={Colors.text} />
                {(unreadCount + unreadAnnCount) > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount + unreadAnnCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(student)/student-profile' as any)}>
                {currentUser.profileImage ? (
                  <Image source={{ uri: currentUser.profileImage }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{currentUser.fullName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sync Status + Enrolled Subjects Section */}
          <View style={styles.syncRow}>
            <SyncStatusIndicator />
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <BookOpen size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>My Subjects</Text>
            </View>
          </View>

          {/* Subject Search */}
          {enrolledSubjects.length > 2 && (
            <View style={styles.searchBox}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search subjects..."
                placeholderTextColor={Colors.textMuted}
                value={subjectSearch}
                onChangeText={setSubjectSearch}
              />
              {subjectSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSubjectSearch('')}>
                  <X size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {isDashLoading ? (
            <SkeletonLoader count={2} height={120} />
          ) : filteredSubjects.length > 0 ? (
            <View style={styles.subjectsList}>
              {filteredSubjects.map(subject => {
                const sq = getSubjectQuizStats(subject.id);
                const subjectCOCs = getSubjectCOCs(subject.id);
                return (
                  <TouchableOpacity
                    key={subject.id}
                    style={styles.subjectCard}
                    onPress={() => {
                      setActiveSubjectId(subject.id);
                      router.push(`/subject/${subject.id}` as any);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.subjectCardTop}>
                      <View style={styles.subjectCardLeft}>
                        <View style={styles.subjectIconWrap}>
                          <BookOpen size={20} color={Colors.primary} />
                        </View>
                        <View style={styles.subjectInfo}>
                          <Text style={styles.subjectName} numberOfLines={2}>{subject.name}</Text>
                          <Text style={styles.subjectTeacher}>{getTeacherName(subject.adminId)}</Text>
                          <View style={styles.subjectMetaRow}>
                            <View style={styles.subjectCodeBadge}>
                              <Text style={styles.subjectCodeText}>{subject.code}</Text>
                            </View>
                            <Text style={styles.subjectStatusText}>
                              {subjectCOCs.length} {subject.unlockType === 'flexible' ? 'topics' : 'COCs'} · {sq.completed} quizzes done
                            </Text>
                          </View>
                        </View>
                      </View>
                      <ChevronRight size={20} color={Colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon={<BookOpen size={36} color={Colors.textMuted} />}
              title={subjectSearch ? "No subjects found" : "No Subjects Enrolled"}
              message={subjectSearch ? "Try a different search term" : "Browse available subjects in the Courses tab to enroll."}
              actionLabel={!subjectSearch ? "Browse Courses" : undefined}
              onAction={!subjectSearch ? () => router.push('/(student)/my-courses' as any) : undefined}
            />
          )}

        </ScrollView>
      </SafeAreaView>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <View style={styles.notifOverlay}>
          <View style={styles.notifCard}>
            <View style={styles.notifHeader}>
              <View style={styles.notifHeaderLeft}>
                <Bell size={20} color={Colors.primary} />
                <Text style={styles.notifTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.notifHeaderRight}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={() => currentUser && markAllNotificationsRead(currentUser.id)} style={styles.notifMarkAllBtn}>
                    <Text style={styles.notifMarkAllText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.notifCloseBtn}>
                  <X size={20} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.notifScroll} showsVerticalScrollIndicator={false}>
              {studentNotifications.length === 0 ? (
                <View style={styles.notifEmpty}>
                  <Bell size={32} color={Colors.textMuted} />
                  <Text style={styles.notifEmptyText}>No notifications yet</Text>
                </View>
              ) : (
                studentNotifications.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={markNotificationRead}
                    onDelete={deleteNotification}
                  />
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Pending Lessons Reminder Popup */}
      <Modal visible={showReminder && pendingReminders.length > 0} transparent animationType="none">
        <Animated.View style={[styles.reminderOverlay, { opacity: reminderOpacity }]}>
          <View style={styles.reminderCard}>
            <View style={styles.reminderHeader}>
              <View style={styles.reminderHeaderLeft}>
                <View style={styles.reminderIconWrap}>
                  <BellRing size={20} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.reminderTitle}>Pending Lessons</Text>
                  <Text style={styles.reminderSubtitle}>{pendingReminders.length} lesson{pendingReminders.length > 1 ? 's' : ''} need attention</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeReminder} style={styles.reminderCloseBtn}>
                <X size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.reminderScroll} showsVerticalScrollIndicator={false}>
              {pendingReminders.slice(0, 8).map((r) => (
                <TouchableOpacity
                  key={r.loId}
                  style={styles.reminderItem}
                  onPress={() => { closeReminder(); router.push(`/lo/${r.loId}` as any); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.reminderItemLeft}>
                    <AlertCircle size={16} color={Colors.warning} />
                    <View style={styles.reminderItemInfo}>
                      <Text style={styles.reminderItemTitle} numberOfLines={1}>{r.loTitle}</Text>
                      <Text style={styles.reminderItemMeta}>{r.subjectCode} · {r.incomplete} pending item{r.incomplete > 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
              {pendingReminders.length > 8 && (
                <Text style={styles.reminderMoreText}>+{pendingReminders.length - 8} more lessons</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.reminderDismissBtn} onPress={closeReminder}>
              <Text style={styles.reminderDismissText}>I'll check later</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      {/* New Announcements Popup */}
      <Modal visible={showAnnPopup && undismissedAnnouncements.length > 0} transparent animationType="none">
        <Animated.View style={[styles.annPopupOverlay, { opacity: popupOpacity }]}>
          <View style={styles.annPopupCard}>
            <View style={styles.annPopupHeader}>
              <View style={styles.annPopupHeaderLeft}>
                <Megaphone size={20} color={Colors.warning} />
                <Text style={styles.annPopupTitle}>New Announcements</Text>
              </View>
              <TouchableOpacity onPress={closeAnnPopup} style={styles.annPopupCloseBtn} testID="close-announcement">
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.annPopupScroll} showsVerticalScrollIndicator={false}>
              {undismissedAnnouncements.map(ann => {
                const isGlobal = ann.scope === 'global';
                const isTargeted = ann.scope === 'targeted';
                return (
                  <View key={ann.id} style={[
                    styles.annPopupItem,
                    isGlobal && { borderLeftColor: Colors.accent },
                    isTargeted && { borderLeftColor: Colors.warning },
                  ]}>
                    <View style={styles.annPopupItemTitleRow}>
                      <Text style={styles.annPopupItemTitle}>{ann.title}</Text>
                      {ann.priority === 'important' && (
                        <View style={styles.annPriorityBadge}>
                          <Flame size={9} color="#000" />
                          <Text style={styles.annPriorityText}>Important</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.annPopupItemMsg}>{ann.message}</Text>
                    <Text style={styles.annPopupItemDate}>
                      {getAnnouncementAuthor(ann)} · {new Date(ann.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.annPopupDismissBtn} onPress={closeAnnPopup}>
              <Text style={styles.annPopupDismissText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 20 },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: 14, color: Colors.textSecondary },
  userName: { fontSize: 24, fontWeight: '700' as const, color: Colors.text, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: Colors.primary },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' as const, color: '#000' },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  badge: { position: 'absolute' as const, top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' as const, color: '#fff' },
  syncRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  // Subject cards
  subjectsList: { gap: 12, marginBottom: 24 },
  subjectCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  subjectCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  subjectCardLeft: { flexDirection: 'row', flex: 1, gap: 12 },
  subjectIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.successSoft, justifyContent: 'center', alignItems: 'center' },
  subjectInfo: { flex: 1 },
  subjectName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  subjectTeacher: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  subjectMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectCodeBadge: { backgroundColor: Colors.primary + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  subjectCodeText: { fontSize: 11, fontWeight: '700' as const, color: Colors.primary },
  subjectStatusText: { fontSize: 11, color: Colors.textMuted },

  // Announcement tabs
  annTabsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  annTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  annTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  annTabText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' as const },
  annTabTextActive: { color: '#000' },
  // Date filter
  dateFilterRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' as const },
  dateFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dateFilterChipActive: { backgroundColor: Colors.accent + '20', borderColor: Colors.accent },
  dateFilterText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' as const },
  dateFilterTextActive: { color: Colors.accent, fontWeight: '600' as const },
  // Announcement cards
  annList: { gap: 10, marginBottom: 20 },
  // Pinned announcements
  pinnedSection: { marginBottom: 16, gap: 8 },
  pinnedHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  pinnedHeaderText: { fontSize: 12, fontWeight: '700' as const, color: Colors.warning, letterSpacing: 0.5 },
  annCardPinned: { borderLeftWidth: 3, borderLeftColor: Colors.warning, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.warning + '40' },
  annPinnedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  annCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  annCardGlobal: { borderLeftColor: Colors.accent },
  annCardAdmin: { borderLeftColor: Colors.primary },
  annCardImportant: { borderLeftColor: Colors.error, borderWidth: 1, borderColor: Colors.error + '40' },
  annCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  annTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, flex: 1 },
  annBadgesRow: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  annPriorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  annPriorityText: { fontSize: 9, color: '#000', fontWeight: '700' as const },
  annScopeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  annScopeText: { fontSize: 9, color: Colors.accent, fontWeight: '600' as const },
  annScopeBadgeAdmin: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  annScopeAdminText: { fontSize: 9, color: Colors.primary, fontWeight: '600' as const },
  annScopeBadgeDirect: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  annScopeDirectText: { fontSize: 9, color: Colors.warning, fontWeight: '600' as const },
  annMsg: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  annAttachment: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  annAttachmentText: { fontSize: 12, color: Colors.accent, flex: 1 },
  annFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  annAuthor: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' as const },
  annDate: { fontSize: 11, color: Colors.textMuted },
  // Notifications modal
  notifOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' as const },
  notifCard: { backgroundColor: Colors.surface, borderRadius: 24, maxHeight: '80%', overflow: 'hidden' as const },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  notifHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  notifBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  notifBadgeText: { fontSize: 11, fontWeight: '700' as const, color: '#fff' },
  notifHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifMarkAllBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  notifMarkAllText: { fontSize: 12, color: Colors.primary, fontWeight: '500' as const },
  notifCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  notifScroll: { paddingHorizontal: 20, paddingTop: 12, maxHeight: 400 },
  notifEmpty: { alignItems: 'center', paddingVertical: 40 },
  notifEmptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  notifItemUnread: { backgroundColor: 'transparent' },
  notifIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  notifIconWrapUnread: { backgroundColor: Colors.successSoft },
  notifItemInfo: { flex: 1 },
  notifItemTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  notifItemMsg: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16, marginTop: 2 },
  notifItemDate: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  notifUnreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
  notifDeleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.errorSoft, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  // Reminder popup
  reminderOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  reminderCard: { backgroundColor: Colors.surface, borderRadius: 20, width: '100%', maxHeight: '70%', overflow: 'hidden' as const, borderWidth: 1, borderColor: Colors.border },
  reminderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  reminderHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  reminderIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  reminderTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  reminderSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reminderCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  reminderScroll: { paddingHorizontal: 20, paddingTop: 12, maxHeight: 280 },
  reminderItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 8 },
  reminderItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  reminderItemInfo: { flex: 1 },
  reminderItemTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  reminderItemMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  reminderMoreText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingVertical: 8 },
  reminderDismissBtn: { marginHorizontal: 20, marginBottom: 18, marginTop: 8, backgroundColor: Colors.surfaceLight, borderRadius: 12, height: 46, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  reminderDismissText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  // Ann popup
  annPopupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  annPopupCard: { backgroundColor: Colors.surface, borderRadius: 20, width: '100%', maxHeight: '70%', overflow: 'hidden' as const, borderWidth: 1, borderColor: Colors.border },
  annPopupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  annPopupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  annPopupTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  annPopupCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  annPopupScroll: { paddingHorizontal: 20, paddingTop: 12, maxHeight: 320 },
  annPopupItem: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  annPopupItemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  annPopupItemTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, flex: 1 },
  annPopupItemMsg: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  annPopupItemDate: { fontSize: 11, color: Colors.textMuted, marginTop: 8 },
  annPopupDismissBtn: { marginHorizontal: 20, marginBottom: 18, marginTop: 8, backgroundColor: Colors.primary, borderRadius: 12, height: 46, justifyContent: 'center', alignItems: 'center' },
  annPopupDismissText: { fontSize: 15, fontWeight: '700' as const, color: '#000' },
});
