import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckSquare, Square, BarChart3, ClipboardList, Award, Lock, Unlock } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import ProgressBar from '@/components/ProgressBar';
import Colors from '@/constants/colors';

export default function MyProgressScreen() {
  const { currentUser, subjects } = useAuth();
  const {
    getSubjectCOCs, getCOCLOs, getSubjectProgress, progress, isLOValidated,
    getStudentActivities, getStudentQuizAttempts,
  } = useData();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const enrolledSubjects = useMemo(() => {
    if (!currentUser) return [];
    const enrolledIds = currentUser.subjectIds || [];
    return subjects.filter(s => enrolledIds.includes(s.id) && !s.archived);
  }, [currentUser, subjects]);

  const activeSubject = useMemo(() => {
    if (selectedSubjectId) return enrolledSubjects.find(s => s.id === selectedSubjectId) || enrolledSubjects[0];
    return enrolledSubjects[0];
  }, [selectedSubjectId, enrolledSubjects]);

  const subjectCOCs = useMemo(() => {
    if (!activeSubject) return [];
    return getSubjectCOCs(activeSubject.id);
  }, [activeSubject, getSubjectCOCs]);

  const subjectProg = useMemo(() => {
    if (!activeSubject || !currentUser) return { total: 0, completed: 0, percentage: 0 };
    return getSubjectProgress(currentUser.id, activeSubject.id, activeSubject.unlockType);
  }, [activeSubject, currentUser, getSubjectProgress]);

  const quizAttempts = useMemo(() => {
    if (!currentUser || !activeSubject) return [];
    return getStudentQuizAttempts(currentUser.id, activeSubject.id);
  }, [currentUser, activeSubject, getStudentQuizAttempts]);

  const activities = useMemo(() => {
    if (!currentUser || !activeSubject) return [];
    return getStudentActivities(currentUser.id, activeSubject.id);
  }, [currentUser, activeSubject, getStudentActivities]);

  if (!currentUser) return null;

  const getCheckStatus = (loId: string): boolean => {
    if (!activeSubject) return false;
    const loProg = progress.find(
      p => p.userId === currentUser.id && p.loId === loId && p.subjectId === activeSubject.id
    );

    if (activeSubject.unlockType === 'sequential') {
      const validated = isLOValidated(currentUser.id, loId);
      return validated && (loProg?.passed || false);
    }

    return loProg?.passed || false;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>Track your learning journey</Text>

          {enrolledSubjects.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {enrolledSubjects.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, activeSubject?.id === s.id && styles.chipActive]}
                  onPress={() => setSelectedSubjectId(s.id)}
                >
                  <Text style={[styles.chipText, activeSubject?.id === s.id && styles.chipTextActive]}>{s.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {activeSubject && (
            <>
              <View style={styles.overviewCard}>
                <View style={styles.overviewHeader}>
                  <BarChart3 size={20} color={Colors.primary} />
                  <Text style={styles.overviewTitle}>{activeSubject.name}</Text>
                </View>
                {activeSubject.gradeLevel && (
                  <Text style={styles.overviewMeta}>{activeSubject.gradeLevel}{activeSubject.semester ? ` · ${activeSubject.semester}` : ''}</Text>
                )}
                <ProgressBar percentage={subjectProg.percentage} height={10} />
                <Text style={styles.overviewStats}>
                  {subjectProg.completed} of {subjectProg.total} topics completed ({subjectProg.percentage.toFixed(0)}%)
                </Text>
                <View style={styles.unlockInfo}>
                  <View style={styles.unlockInfoRow}>
                    {activeSubject.unlockType === 'sequential' ? <Lock size={12} color={Colors.warning} /> : <Unlock size={12} color={Colors.primary} />}
                    <Text style={styles.unlockInfoText}>
                      {activeSubject.unlockType === 'sequential'
                        ? 'Sequential: Progress checks require admin validation'
                        : 'Flexible: Progress reflects automatically'}
                    </Text>
                  </View>
                </View>
              </View>

              {subjectCOCs.map((coc) => {
                const cocLOs = getCOCLOs(coc.id);
                const completedCount = cocLOs.filter(lo => getCheckStatus(lo.id)).length;

                return (
                  <View key={coc.id} style={styles.cocCard}>
                    <View style={styles.cocHeader}>
                      <Text style={styles.cocTitle}>
                        {activeSubject.unlockType === 'flexible' ? `Topic ${coc.order}` : `COC ${coc.order}`}: {coc.title}
                      </Text>
                      <Text style={styles.cocProgress}>{completedCount}/{cocLOs.length}</Text>
                    </View>
                    <ProgressBar percentage={cocLOs.length > 0 ? (completedCount / cocLOs.length) * 100 : 0} height={4} />
                    <View style={styles.loList}>
                      {cocLOs.map((lo) => {
                        const loProg = progress.find(
                          p => p.userId === currentUser.id && p.loId === lo.id && p.subjectId === activeSubject.id
                        );
                        const isChecked = getCheckStatus(lo.id);
                        const loQuizAttempts = quizAttempts.filter(a => a.loId === lo.id);
                        const loActivities = activities.filter(a => a.loId === lo.id);
                        const latestAttempt = loQuizAttempts.length > 0 ? loQuizAttempts[loQuizAttempts.length - 1] : null;

                        return (
                          <View key={lo.id} style={styles.loRow}>
                            <View style={styles.loNumber}>
                              <Text style={styles.loNumberText}>{lo.order}</Text>
                            </View>
                            <View style={styles.loInfo}>
                              <Text style={styles.loTitle} numberOfLines={1}>{lo.title}</Text>
                              {loProg && (
                                <Text style={styles.loScore}>
                                  {isChecked ? `Passed · Score: ${loProg.score}/${loProg.totalItems ?? 20}` : `Attempts: ${loProg.attempts}`}
                                </Text>
                              )}
                              {(latestAttempt || loActivities.length > 0) && (
                                <View style={styles.loScoreDetails}>
                                  {latestAttempt && (
                                    <View style={styles.scoreTag}>
                                      <ClipboardList size={10} color={Colors.primary} />
                                      <Text style={styles.scoreTagText}>
                                        Quiz: {latestAttempt.score}/{latestAttempt.totalItems}
                                      </Text>
                                    </View>
                                  )}
                                  {loActivities.length > 0 && (
                                    <View style={[styles.scoreTag, { backgroundColor: Colors.warning + '15' }]}>
                                      <Award size={10} color={Colors.warning} />
                                      <Text style={[styles.scoreTagText, { color: Colors.warning }]}>
                                        Task: {loActivities[loActivities.length - 1].score}/{loActivities[loActivities.length - 1].maxScore}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                            {isChecked ? (
                              <CheckSquare size={18} color={Colors.primary} />
                            ) : (
                              <Square size={18} color={Colors.textMuted} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {enrolledSubjects.length === 0 && (
            <View style={styles.emptyState}>
              <BarChart3 size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No progress data yet</Text>
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
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  chipRow: { marginBottom: 16, flexGrow: 0 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: 8 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 14, color: Colors.text, fontWeight: '500' as const },
  chipTextActive: { color: '#000' },
  overviewCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  overviewTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, flex: 1 },
  overviewMeta: { fontSize: 12, color: Colors.accent, marginBottom: 10, fontWeight: '500' as const },
  overviewStats: { fontSize: 13, color: Colors.textSecondary, marginTop: 10 },
  unlockInfo: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  unlockInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unlockInfoText: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' as const, flex: 1 },
  cocCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  cocHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cocTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.text, flex: 1 },
  cocProgress: { fontSize: 13, fontWeight: '600' as const, color: Colors.primary },
  loList: { marginTop: 12 },
  loRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  loNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  loNumberText: { fontSize: 11, fontWeight: '600' as const, color: Colors.text },
  loInfo: { flex: 1 },
  loTitle: { fontSize: 13, color: Colors.text },
  loScore: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  loScoreDetails: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  scoreTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  scoreTagText: { fontSize: 10, fontWeight: '600' as const, color: Colors.primary },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: Colors.textMuted },
});
