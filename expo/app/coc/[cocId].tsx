import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronRight, Lock, CheckCircle, Clock, Circle, RefreshCw, AlertCircle,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import Colors from '@/constants/colors';
import type { QuizDisplayStatus } from '@/types';

const quizStatusBadge: Record<QuizDisplayStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: Colors.primary, bg: Colors.successSoft, label: '✅ Completed' },
  not_started: { icon: Clock, color: Colors.accent, bg: Colors.accentSoft, label: '⏳ Not Started' },
  in_progress: { icon: RefreshCw, color: Colors.warning, bg: Colors.warningSoft, label: '🔄 In Progress' },
  missed: { icon: AlertCircle, color: Colors.error, bg: Colors.errorSoft, label: '❌ Missed' },
};

export default function COCDetailScreen() {
  const { cocId } = useLocalSearchParams<{ cocId: string }>();
  const router = useRouter();
  const { currentUser, subjects } = useAuth();
  const { cocs, getCOCLOs, getCOCProgress, getLOStatus, getStudentProgress, getLOIncompleteContents, getQuizDisplayStatus, getLOQuiz } = useData();

  const coc = useMemo(() => cocs.find(c => c.id === cocId), [cocs, cocId]);

  const subject = useMemo(() => {
    if (!coc) return null;
    return subjects.find(s => s.id === coc.subjectId) ?? null;
  }, [coc, subjects]);

  const cocLOs = useMemo(() => getCOCLOs(cocId ?? ''), [getCOCLOs, cocId]);

  const cocProgress = useMemo(() => {
    if (!currentUser) return { total: 0, completed: 0, percentage: 0 };
    return getCOCProgress(currentUser.id, cocId ?? '');
  }, [currentUser, getCOCProgress, cocId]);

  const studentProgressData = useMemo(() => {
    if (!currentUser) return [];
    return getStudentProgress(currentUser.id);
  }, [currentUser, getStudentProgress]);

  if (!coc || !currentUser || !subject) return null;

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `COC ${coc.order}` }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.cocOrder}>COC {coc.order}</Text>
          <Text style={styles.cocTitle}>{coc.title}</Text>
          <Text style={styles.cocDescription}>{coc.description}</Text>
          {!isAdmin && (
            <View style={styles.progressSection}>
              <ProgressBar percentage={cocProgress.percentage} height={8} />
              <Text style={styles.progressText}>
                {cocProgress.completed} of {cocProgress.total} Learning Outcomes completed
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Learning Outcomes</Text>

        {cocLOs.map((lo) => {
          const status = isAdmin ? 'available' as const : getLOStatus(currentUser.id, lo.id, subject);
          const isLocked = status === 'locked' && !isAdmin;
          const prog = studentProgressData.find(p => p.loId === lo.id);
          const incomplete = !isAdmin && !isLocked && status !== 'completed' ? getLOIncompleteContents(lo.id, currentUser.id) : { docs: 0, videos: 0, total: 0 };
          const hasQuiz = !!getLOQuiz(lo.id);
          const quizStatus = !isAdmin && hasQuiz ? getQuizDisplayStatus(currentUser.id, lo.id, subject.id) : null;
          const QuizIcon = quizStatus ? quizStatusBadge[quizStatus].icon : null;

          return (
            <TouchableOpacity
              key={lo.id}
              style={[styles.loCard, isLocked && styles.loCardLocked]}
              onPress={() => {
                if (!isLocked) {
                  router.push(`/lo/${lo.id}` as any);
                }
              }}
              activeOpacity={isLocked ? 1 : 0.7}
              disabled={isLocked}
            >
              <View style={styles.loLeft}>
                <View style={[styles.loNumber, isLocked && styles.loNumberLocked, status === 'completed' && styles.loNumberCompleted]}>
                  {status === 'completed' ? (
                    <CheckCircle size={18} color="#fff" />
                  ) : isLocked ? (
                    <Lock size={16} color={Colors.textMuted} />
                  ) : (
                    <Text style={styles.loNumberText}>{lo.order}</Text>
                  )}
                </View>
              </View>
              <View style={styles.loInfo}>
                <View style={styles.loTitleRow}>
                  <Text style={[styles.loTitle, isLocked && styles.loTitleLocked]} numberOfLines={1}>
                    LO {lo.order}: {lo.title}
                  </Text>
                  {incomplete.total > 0 && (
                    <View style={styles.incompleteDot} />
                  )}
                </View>
                <Text style={styles.loDescription} numberOfLines={2}>{lo.description}</Text>
                {incomplete.total > 0 && (
                  <View style={styles.incompleteBadge}>
                    <Circle size={8} color={Colors.warning} fill={Colors.warning} />
                    <Text style={styles.incompleteBadgeText}>
                      {incomplete.total} pending item{incomplete.total > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                {prog?.passed && (
                  <Text style={styles.scoreText}>Score: {prog.score}/{prog.totalItems ?? 20} ({((prog.score / Math.max(prog.totalItems ?? 20, 1)) * 100).toFixed(0)}%)</Text>
                )}
                {/* Quiz Status Indicator */}
                {quizStatus && QuizIcon && (
                  <View style={[styles.quizStatusBadge, { backgroundColor: quizStatusBadge[quizStatus].bg }]}>
                    <QuizIcon size={11} color={quizStatusBadge[quizStatus].color} />
                    <Text style={[styles.quizStatusText, { color: quizStatusBadge[quizStatus].color }]}>
                      {quizStatusBadge[quizStatus].label}
                    </Text>
                  </View>
                )}
                <StatusBadge status={status} />
              </View>
              {!isLocked && <ChevronRight size={18} color={Colors.textMuted} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  headerCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  cocOrder: { fontSize: 12, fontWeight: '700' as const, color: Colors.primary, letterSpacing: 1, marginBottom: 6 },
  cocTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  cocDescription: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  progressSection: { marginTop: 16, gap: 6 },
  progressText: { fontSize: 12, color: Colors.textMuted },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 14 },
  loCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  loCardLocked: { opacity: 0.5 },
  loLeft: { marginRight: 14 },
  loNumber: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,201,167,0.15)', justifyContent: 'center', alignItems: 'center' },
  loNumberLocked: { backgroundColor: 'rgba(74,85,104,0.2)' },
  loNumberCompleted: { backgroundColor: Colors.primary },
  loNumberText: { fontSize: 16, fontWeight: '700' as const, color: Colors.primary },
  loInfo: { flex: 1, gap: 4 },
  loTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  loTitleLocked: { color: Colors.textMuted },
  loDescription: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  scoreText: { fontSize: 11, color: Colors.primary, fontWeight: '600' as const },
  loTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incompleteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning, flexShrink: 0 },
  incompleteBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  incompleteBadgeText: { fontSize: 11, color: Colors.warning, fontWeight: '500' as const },
  quizStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginTop: 2 },
  quizStatusText: { fontSize: 10, fontWeight: '600' as const },
});
