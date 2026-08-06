import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera, Edit3, LogOut, Lock, Save, User, Mail, Users, ChevronDown,
  History, BookOpen, ClipboardCheck, Sun, Moon, Monitor,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import EmptyState from '@/components/EmptyState';
import { uploadLocalFile } from '@/services/cloudSync';

const themeOptions: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'auto', icon: Monitor, label: 'Auto' },
];

export default function StudentProfileScreen() {
  const router = useRouter();
  const { currentUser, updateProfile, logout, sections } = useAuth();
  const { getUserActivityLogs, getStudentQuizAttempts, getLessonsCompleted } = useData();
  const { colors, themePreference, setTheme, isDark } = useTheme();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>(currentUser?.fullName ?? '');
  const [username, setUsername] = useState<string>(currentUser?.username ?? '');
  const [email, setEmail] = useState<string>(currentUser?.email ?? '');
  const [showPasswordForm, setShowPasswordForm] = useState<boolean>(false);
  const [showSectionPicker, setShowSectionPicker] = useState<boolean>(false);
  const [showActivityHistory, setShowActivityHistory] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const activityLogs = useMemo(() => {
    if (!currentUser) return [];
    return getUserActivityLogs(currentUser.id);
  }, [currentUser, getUserActivityLogs]);

  const quizAttempts = useMemo(() => {
    if (!currentUser) return [];
    return getStudentQuizAttempts(currentUser.id);
  }, [currentUser, getStudentQuizAttempts]);

  const lessonsDone = useMemo(() => {
    if (!currentUser) return 0;
    return getLessonsCompleted(currentUser.id);
  }, [currentUser, getLessonsCompleted]);

  if (!currentUser) return null;

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
          Alert.alert('Invalid File', 'Only image files are allowed for profile pictures.');
          return;
        }
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Profile image must be under 5MB. Please choose a smaller image.');
          return;
        }
        const uploaded = currentUser ? await uploadLocalFile(asset.uri, `profile-${currentUser.id}.jpg`, asset.mimeType ?? 'image/jpeg', currentUser.id).catch(() => null) : null;
        await updateProfile({ profileImage: uploaded?.url ?? asset.uri });
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (err) { console.log('[Profile] Image picker error', err); }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim() || !username.trim() || !email.trim()) { Alert.alert('Error', 'All fields are required.'); return; }
    if (fullName.trim().length < 2) { Alert.alert('Error', 'Full name must be at least 2 characters.'); return; }
    if (username.trim().length < 3) { Alert.alert('Error', 'Username must be at least 3 characters.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { Alert.alert('Error', 'Please enter a valid email address.'); return; }
    await updateProfile({ fullName: fullName.trim(), username: username.trim(), email: email.trim() });
    setIsEditing(false);
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match.'); return; }
    await updateProfile({ password: newPassword });
    setShowPasswordForm(false); setNewPassword(''); setConfirmPassword('');
    Alert.alert('Success', 'Password changed successfully!');
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            // RouteGuard in _layout.tsx will redirect to /login automatically
            // when currentUser becomes null — no manual router.replace needed
          } catch (err) {
            console.log('[StudentProfile] Logout error', err);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
              {currentUser.profileImage ? (
                <Image source={{ uri: currentUser.profileImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>{currentUser.fullName.charAt(0).toUpperCase()}</Text></View>
              )}
              <View style={[styles.cameraIcon, { backgroundColor: colors.accent, borderColor: colors.background }]}><Camera size={14} color="#fff" /></View>
            </TouchableOpacity>
            <Text style={[styles.profileName, { color: colors.text }]}>{currentUser.fullName}</Text>
            <Text style={[styles.profileRole, { color: colors.textSecondary }]}>Student</Text>
            {currentUser.gradeLevel && (
              <View style={[styles.gradeBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.gradeBadgeText, { color: colors.accent }]}>{currentUser.gradeLevel}</Text>
              </View>
            )}
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStatsRow}>
            <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <BookOpen size={16} color={colors.primary} />
              <Text style={[styles.quickStatValue, { color: colors.text }]}>{lessonsDone}</Text>
              <Text style={[styles.quickStatLabel, { color: colors.textMuted }]}>Lessons</Text>
            </View>
            <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ClipboardCheck size={16} color={colors.accent} />
              <Text style={[styles.quickStatValue, { color: colors.text }]}>{quizAttempts.length}</Text>
              <Text style={[styles.quickStatLabel, { color: colors.textMuted }]}>Quiz Attempts</Text>
            </View>
          </View>

          {/* Appearance / Theme Settings */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
            </View>
            <Text style={[styles.themeSubtitle, { color: colors.textMuted, marginBottom: 12 }]}>
              Choose your preferred theme. Auto follows your system setting.
            </Text>
            <View style={styles.themeToggleRow}>
              {themeOptions.map(opt => {
                const Icon = opt.icon;
                const isActive = themePreference === opt.mode;
                return (
                  <TouchableOpacity
                    key={opt.mode}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: isActive ? colors.primary : colors.inputBg,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setTheme(opt.mode)}
                    activeOpacity={0.7}
                  >
                    <Icon size={16} color={isActive ? '#000' : colors.textSecondary} />
                    <Text style={[
                      styles.themeOptionText,
                      { color: isActive ? '#000' : colors.textSecondary },
                    ]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.themeStatusRow, { marginTop: 10 }]}>
              <Text style={[styles.themeStatusText, { color: colors.textMuted }]}>
                Current: {isDark ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
          </View>

          {/* Personal Information */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
              {!isEditing ? (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtn}><Edit3 size={14} color={colors.primary} /><Text style={[styles.editBtnText, { color: colors.primary }]}>Edit</Text></TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleSaveProfile} style={[styles.saveEditBtn, { backgroundColor: colors.primary }]}><Save size={14} color="#000" /><Text style={styles.saveEditBtnText}>Save</Text></TouchableOpacity>
              )}
            </View>
            <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}><User size={16} color={colors.textMuted} /><View style={styles.fieldContent}><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Full Name</Text>{isEditing ? <TextInput style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={fullName} onChangeText={setFullName} /> : <Text style={[styles.fieldValue, { color: colors.text }]}>{currentUser.fullName}</Text>}</View></View>
            <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}><User size={16} color={colors.textMuted} /><View style={styles.fieldContent}><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Username</Text>{isEditing ? <TextInput style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={username} onChangeText={setUsername} autoCapitalize="none" /> : <Text style={[styles.fieldValue, { color: colors.text }]}>{currentUser.username}</Text>}</View></View>
            <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}><Mail size={16} color={colors.textMuted} /><View style={styles.fieldContent}><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Email</Text>{isEditing ? <TextInput style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /> : <Text style={[styles.fieldValue, { color: colors.text }]}>{currentUser.email}</Text>}</View></View>
            <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
              <Users size={16} color={colors.textMuted} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Section</Text>
                {isEditing ? (
                  <View>
                    <TouchableOpacity
                      style={[styles.sectionPickerBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                      onPress={() => setShowSectionPicker(!showSectionPicker)}
                    >
                      <Text style={[styles.sectionPickerText, { color: colors.text }]}>
                        {sections.find(s => s.id === currentUser.sectionId)?.name ?? 'Select Section'}
                      </Text>
                      <ChevronDown size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    {showSectionPicker && (
                      <View style={[styles.sectionDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {sections.filter(s => !s.archived).map(section => (
                          <TouchableOpacity
                            key={section.id}
                            style={[styles.sectionOption, { borderBottomColor: colors.border }, currentUser.sectionId === section.id && { backgroundColor: colors.primarySoft }]}
                            onPress={async () => {
                              await updateProfile({ sectionId: section.id });
                              setShowSectionPicker(false);
                            }}
                          >
                            <Text style={[styles.sectionOptionText, { color: colors.text }, currentUser.sectionId === section.id && { color: colors.primary, fontWeight: '600' as const }]}>{section.name}</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={[styles.sectionOption, { borderBottomWidth: 0 }]}
                          onPress={async () => {
                            await updateProfile({ sectionId: undefined });
                            setShowSectionPicker(false);
                          }}
                        >
                          <Text style={[styles.sectionOptionText, { color: colors.error }]}>Remove Section</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={[styles.fieldValue, { color: colors.text }]}>
                    {sections.find(s => s.id === currentUser.sectionId)?.name ?? 'No section assigned'}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Change Password */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowPasswordForm(!showPasswordForm)}>
              <Lock size={18} color={colors.accent} /><Text style={[styles.menuText, { color: colors.text }]}>Change Password</Text>
            </TouchableOpacity>
            {showPasswordForm && (
              <View style={styles.passwordForm}>
                <TextInput style={[styles.passInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="New Password" placeholderTextColor={colors.textMuted} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                <TextInput style={[styles.passInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Confirm Password" placeholderTextColor={colors.textMuted} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
                <TouchableOpacity style={[styles.changePassBtn, { backgroundColor: colors.primary }]} onPress={handleChangePassword}><Text style={styles.changePassText}>Update Password</Text></TouchableOpacity>
              </View>
            )}
          </View>

          {/* Activity History */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowActivityHistory(!showActivityHistory)}
            >
              <History size={18} color={colors.warning} />
              <Text style={[styles.menuText, { color: colors.text }]}>View Activity History</Text>
              {activityLogs.length > 0 && (
                <View style={[styles.activityBadge, { backgroundColor: colors.warningSoft }]}>
                  <Text style={[styles.activityBadgeText, { color: colors.warning }]}>{activityLogs.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            {showActivityHistory && (
              <ScrollView style={styles.activityList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {activityLogs.length === 0 ? (
                  <EmptyState
                    icon={<History size={28} color={colors.textMuted} />}
                    title="No Activity Yet"
                    message="Your learning activities will be recorded here."
                  />
                ) : (
                  activityLogs.slice(0, 20).map((log) => (
                    <View key={log.id} style={[styles.activityItem, { borderBottomColor: colors.border }]}>
                      <View style={[styles.activityDot, { backgroundColor: colors.primary }]} />
                      <View style={styles.activityInfo}>
                        <Text style={[styles.activityAction, { color: colors.text }]}>{log.description}</Text>
                        <Text style={[styles.activityDate, { color: colors.textMuted }]}>
                          {new Date(log.createdAt).toLocaleDateString()} · {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>

          {/* Logout */}
          <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.errorSoft, borderColor: colors.error + '30' }]} onPress={handleLogout}>
            <LogOut size={18} color={colors.error} /><Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 20, marginTop: 16 },
  avatarContainer: { position: 'relative' as const },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#00C9A7' },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 36, fontWeight: '700' as const, color: '#000' },
  cameraIcon: { position: 'absolute' as const, bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  profileName: { fontSize: 20, fontWeight: '700' as const, marginTop: 12 },
  profileRole: { fontSize: 13, marginTop: 2 },
  gradeBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  gradeBadgeText: { fontSize: 12, fontWeight: '600' as const },
  quickStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickStatCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, gap: 4 },
  quickStatValue: { fontSize: 20, fontWeight: '700' as const },
  quickStatLabel: { fontSize: 10, textAlign: 'center' as const },
  overviewCard: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1 },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  overviewTitle: { fontSize: 16, fontWeight: '600' as const },
  overviewStats: { fontSize: 13, marginTop: 10 },
  section: { borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const },
  themeSubtitle: { fontSize: 13, lineHeight: 18 },
  themeToggleRow: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  themeOptionText: { fontSize: 13, fontWeight: '600' as const },
  themeStatusRow: { alignItems: 'center' as const },
  themeStatusText: { fontSize: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 13, fontWeight: '500' as const },
  saveEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  saveEditBtnText: { fontSize: 13, color: '#000', fontWeight: '600' as const },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 11, marginBottom: 2 },
  fieldValue: { fontSize: 15 },
  fieldInput: { fontSize: 15, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  menuText: { fontSize: 15, flex: 1 },
  activityBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  activityBadgeText: { fontSize: 11, fontWeight: '600' as const },
  passwordForm: { paddingLeft: 30, paddingBottom: 10 },
  passInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  changePassBtn: { borderRadius: 10, height: 42, justifyContent: 'center', alignItems: 'center' },
  changePassText: { color: '#000', fontSize: 14, fontWeight: '600' as const },
  activityList: { marginTop: 8, maxHeight: 300 },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  activityInfo: { flex: 1 },
  activityAction: { fontSize: 13, fontWeight: '500' as const },
  activityDate: { fontSize: 11, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16, marginTop: 8, borderWidth: 1 },
  logoutText: { fontSize: 16, fontWeight: '600' as const },
  sectionPickerBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1 },
  sectionPickerText: { fontSize: 15 },
  sectionDropdown: { borderRadius: 10, borderWidth: 1, marginTop: 6, overflow: 'hidden' as const },
  sectionOption: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  sectionOptionText: { fontSize: 14 },
});
