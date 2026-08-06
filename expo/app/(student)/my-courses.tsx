import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, ChevronRight, Lock, Unlock, Plus, MinusCircle, Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import ProgressBar from '@/components/ProgressBar';
import Colors from '@/constants/colors';

export default function MyCoursesScreen() {
  const router = useRouter();
  const { currentUser, subjects, enrollStudentInSubject, removeStudentFromSubject, updateProfile } = useAuth();
  const { getSubjectCOCs, getSubjectProgress, setActiveSubjectId, refreshFromCloud } = useData();
  const [showAvailable, setShowAvailable] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const enrolledSubjects = useMemo(() => {
    if (!currentUser) return [];
    const enrolledIds = currentUser.subjectIds || [];
    return subjects.filter(s => enrolledIds.includes(s.id) && !s.archived);
  }, [currentUser, subjects]);

  const availableSubjects = useMemo(() => {
    if (!currentUser) return [];
    const enrolledIds = currentUser.subjectIds || [];
    return subjects.filter(s => !enrolledIds.includes(s.id) && !s.archived && s.adminId === currentUser.adminId);
  }, [currentUser, subjects]);

  const handleEnroll = useCallback(async (subjectId: string, subjectName: string) => {
    if (!currentUser) return;
    Alert.alert('Enroll in Subject', `Add "${subjectName}" to your courses?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Enroll',
        onPress: async () => {
          try {
            await enrollStudentInSubject(currentUser.id, subjectId);
            const updatedIds = [...(currentUser.subjectIds || []), subjectId];
            await updateProfile({ subjectIds: updatedIds });
            console.log('[Courses] Enrolled in subject', subjectId);
          } catch (err) {
            console.log('[Courses] Enroll error', err);
            Alert.alert('Error', 'Failed to enroll in subject');
          }
        },
      },
    ]);
  }, [currentUser, enrollStudentInSubject, updateProfile]);

  const handleUnenroll = useCallback(async (subjectId: string, subjectName: string) => {
    if (!currentUser) return;
    Alert.alert('Unenroll from Subject', `Remove "${subjectName}" from your courses?\n\nYour progress will be preserved.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unenroll',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeStudentFromSubject(currentUser.id, subjectId);
            const updatedIds = (currentUser.subjectIds || []).filter(id => id !== subjectId);
            await updateProfile({ subjectIds: updatedIds });
            console.log('[Courses] Unenrolled from subject', subjectId);
          } catch (err) {
            console.log('[Courses] Unenroll error', err);
            Alert.alert('Error', 'Failed to unenroll from subject');
          }
        },
      },
    ]);
  }, [currentUser, removeStudentFromSubject, updateProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshFromCloud(); } finally { setRefreshing(false); }
  }, [refreshFromCloud]);

  if (!currentUser) return null;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          <Text style={styles.title}>My Courses</Text>
          <Text style={styles.subtitle}>Your enrolled subjects</Text>

          {enrolledSubjects.map((subject) => {
            const subjectCOCsList = getSubjectCOCs(subject.id);
            const prog = getSubjectProgress(currentUser.id, subject.id, subject.unlockType);
            return (
              <View key={subject.id} style={styles.subjectCard}>
                <TouchableOpacity
                  style={styles.subjectCardContent}
                  onPress={() => {
                    setActiveSubjectId(subject.id);
                    router.push(`/subject/${subject.id}` as any);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.subjectIconContainer}>
                    <BookOpen size={28} color={Colors.primary} />
                  </View>
                  <View style={styles.subjectInfo}>
                    <View style={styles.subjectHeaderRow}>
                      <Text style={styles.subjectCode}>{subject.code}</Text>
                      <View style={styles.unlockBadge}>
                        {subject.unlockType === 'sequential' ? <Lock size={10} color={Colors.warning} /> : <Unlock size={10} color={Colors.primary} />}
                        <Text style={styles.unlockText}>{subject.unlockType === 'sequential' ? 'Sequential' : 'Flexible'}</Text>
                      </View>
                    </View>
                    <Text style={styles.subjectTitle} numberOfLines={2}>{subject.name}</Text>
                    <View style={styles.subjectProgressSection}>
                      <ProgressBar percentage={prog.percentage} height={6} />
                      <View style={styles.subjectProgressRow}>
                        <Text style={styles.subjectProgressText}>{prog.completed}/{prog.total} LOs · {subjectCOCsList.length} COCs</Text>
                        <Text style={styles.subjectPercentText}>{prog.percentage.toFixed(0)}%</Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={20} color={Colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.unenrollBtn}
                  onPress={() => handleUnenroll(subject.id, subject.name)}
                >
                  <MinusCircle size={14} color={Colors.error} />
                  <Text style={styles.unenrollText}>Unenroll</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {enrolledSubjects.length === 0 && !showAvailable && (
            <View style={styles.emptyState}>
              <BookOpen size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No subjects enrolled yet</Text>
              <Text style={styles.emptySubText}>Tap below to browse available subjects</Text>
            </View>
          )}

          {availableSubjects.length > 0 && (
            <View style={styles.availableSection}>
              <TouchableOpacity
                style={styles.showAvailableBtn}
                onPress={() => setShowAvailable(!showAvailable)}
              >
                <Plus size={16} color={showAvailable ? '#000' : Colors.primary} />
                <Text style={[styles.showAvailableBtnText, showAvailable && styles.showAvailableBtnTextActive]}>
                  {showAvailable ? 'Hide Available Subjects' : 'Add More Subjects'}
                </Text>
              </TouchableOpacity>

              {showAvailable && (
                <View style={styles.availableList}>
                  {availableSubjects.map((subject) => (
                    <View key={subject.id} style={styles.availableCard}>
                      <View style={styles.availableInfo}>
                        <View style={styles.availableCodeRow}>
                          <Text style={styles.availableCode}>{subject.code}</Text>
                          <View style={styles.unlockBadge}>
                            {subject.unlockType === 'sequential' ? <Lock size={10} color={Colors.warning} /> : <Unlock size={10} color={Colors.primary} />}
                            <Text style={styles.unlockText}>{subject.unlockType === 'sequential' ? 'Sequential' : 'Flexible'}</Text>
                          </View>
                        </View>
                        <Text style={styles.availableName} numberOfLines={2}>{subject.name}</Text>
                        {subject.description ? <Text style={styles.availableDesc} numberOfLines={2}>{subject.description}</Text> : null}
                      </View>
                      <TouchableOpacity
                        style={styles.enrollBtn}
                        onPress={() => handleEnroll(subject.id, subject.name)}
                      >
                        <Plus size={16} color="#000" />
                        <Text style={styles.enrollBtnText}>Enroll</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  title: { fontSize: 28, fontWeight: '800' as const, color: Colors.text, marginTop: 16 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  subjectCard: { backgroundColor: Colors.surface, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  subjectCardContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  subjectIconContainer: { width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(0,201,167,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  subjectInfo: { flex: 1 },
  subjectHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  subjectCode: { fontSize: 11, fontWeight: '700' as const, color: Colors.primary, textTransform: 'uppercase' as const, letterSpacing: 1 },
  unlockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  unlockText: { fontSize: 9, color: Colors.textSecondary, fontWeight: '500' as const },
  subjectTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 8 },
  subjectProgressSection: { gap: 4 },
  subjectProgressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  subjectProgressText: { fontSize: 11, color: Colors.textMuted },
  subjectPercentText: { fontSize: 11, fontWeight: '600' as const, color: Colors.primary },
  unenrollBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.error + '08' },
  unenrollText: { fontSize: 13, color: Colors.error, fontWeight: '500' as const },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, color: Colors.textMuted },
  emptySubText: { fontSize: 13, color: Colors.textMuted },
  availableSection: { marginTop: 16 },
  showAvailableBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed' as const, marginBottom: 14 },
  showAvailableBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },
  showAvailableBtnTextActive: { color: '#000' },
  availableList: { gap: 10 },
  availableCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  availableInfo: { marginBottom: 12 },
  availableCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  availableCode: { fontSize: 11, fontWeight: '700' as const, color: Colors.accent, textTransform: 'uppercase' as const, letterSpacing: 1 },
  availableName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  availableDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  enrollBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary },
  enrollBtnText: { fontSize: 14, fontWeight: '600' as const, color: '#000' },
});
