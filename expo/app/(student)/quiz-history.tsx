import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ClipboardList, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Award, TrendingUp, BookOpen, Eye, X, ArrowRight,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTheme } from '@/contexts/ThemeContext';
import EmptyState from '@/components/EmptyState';
import type { QuizAttempt } from '@/types';

function formatDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function QuizHistoryScreen() {
  const { currentUser, subjects } = useAuth();
  const {
    getStudentQuizAttempts, getLOQuiz, getQuizQuestions, learningOutcomes,
  } = useData();
  const { colors } = useTheme();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null);

  const enrolledSubjects = useMemo(() => {
    if (!currentUser) return [];
    const enrolledIds = currentUser.subjectIds || [];
    return subjects.filter(s => enrolledIds.includes(s.id) && !s.archived);
  }, [currentUser, subjects]);

  const allAttempts = useMemo(() => {
    if (!currentUser) return [];
    return getStudentQuizAttempts(currentUser.id).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [currentUser, getStudentQuizAttempts]);

  const filteredAttempts = useMemo(() => {
    if (!selectedSubjectId) return allAttempts;
    return allAttempts.filter(a => a.subjectId === selectedSubjectId);
  }, [allAttempts, selectedSubjectId]);

  const stats = useMemo(() => {
    if (allAttempts.length === 0) return { total: 0, passed: 0, avgScore: 0, bestScore: 0 };
    const passed = allAttempts.filter(a => a.isPassed).length;
    const avgPct = allAttempts.reduce((sum, a) => sum + (a.score / Math.max(a.totalItems, 1)) * 100, 0) / allAttempts.length;
    const bestPct = Math.max(...allAttempts.map(a => (a.score / Math.max(a.totalItems, 1)) * 100));
    return { total: allAttempts.length, passed, avgScore: Math.round(avgPct), bestScore: Math.round(bestPct) };
  }, [allAttempts]);

  const getSubjectName = (subjectId: string): string => {
    return subjects.find(s => s.id === subjectId)?.name ?? 'Unknown Subject';
  };

  const getLOTitle = (loId: string): string => {
    const lo = learningOutcomes.find(l => l.id === loId);
    return lo ? `LO ${lo.order}: ${lo.title}` : 'Unknown LO';
  };

  const getQuizTitle = (loId: string): string => {
    const quiz = getLOQuiz(loId);
    return quiz?.title ?? 'Quiz';
  };

  const getAttemptReviewData = (attempt: QuizAttempt) => {
    const quiz = getLOQuiz(attempt.loId);
    if (!quiz) return null;
    const questions = getQuizQuestions(quiz.id);
    return questions.map(q => {
      const studentAnswer = attempt.answers?.[q.id] ?? null;
      const isCorrect = studentAnswer === q.correctAnswer;
      return {
        questionId: q.id,
        questionText: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        studentAnswer,
        isCorrect,
      };
    });
  };

  if (!currentUser) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.headerRow}>
            <ClipboardList size={24} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>Quiz History</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Complete record of all your quiz attempts
          </Text>

          {/* Stats Summary */}
          {allAttempts.length > 0 && (
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ClipboardList size={16} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Attempts</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <CheckCircle size={16} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.passed}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Passed</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TrendingUp size={16} color={colors.accent} />
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.avgScore}%</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg Score</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Award size={16} color={colors.warning} />
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.bestScore}%</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Best</Text>
              </View>
            </View>
          )}

          {/* Subject Filter */}
          {enrolledSubjects.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedSubjectId && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setSelectedSubjectId(null)}
              >
                <Text style={[styles.filterChipText, !selectedSubjectId && { color: '#000' }]}>All Subjects</Text>
              </TouchableOpacity>
              {enrolledSubjects.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.filterChip, { backgroundColor: colors.surface, borderColor: colors.border }, selectedSubjectId === s.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setSelectedSubjectId(s.id)}
                >
                  <Text style={[styles.filterChipText, { color: colors.text }, selectedSubjectId === s.id && { color: '#000' }]}>
                    {s.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Quiz Attempt Cards */}
          {filteredAttempts.length > 0 ? (
            filteredAttempts.map((attempt) => {
              const pct = Math.round((attempt.score / Math.max(attempt.totalItems, 1)) * 100);
              const isExpanded = expandedAttempt === attempt.id;
              const reviewData = getAttemptReviewData(attempt);
              const canReview = reviewData !== null && reviewData.length > 0;

              return (
                <View key={attempt.id} style={[styles.attemptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {/* Card Header */}
                  <TouchableOpacity
                    style={styles.attemptCardHeader}
                    onPress={() => setExpandedAttempt(isExpanded ? null : attempt.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.attemptIcon, { backgroundColor: attempt.isPassed ? colors.successSoft : colors.errorSoft }]}>
                      {attempt.isPassed
                        ? <CheckCircle size={18} color={colors.primary} />
                        : <XCircle size={18} color={colors.error} />}
                    </View>
                    <View style={styles.attemptInfo}>
                      <Text style={[styles.attemptQuizTitle, { color: colors.text }]} numberOfLines={1}>
                        {getQuizTitle(attempt.loId)}
                      </Text>
                      <Text style={[styles.attemptSubjectName, { color: colors.textSecondary }]} numberOfLines={1}>
                        {getSubjectName(attempt.subjectId)}
                      </Text>
                      <View style={styles.attemptMetaRow}>
                        <View style={[styles.attemptStatusBadge, { backgroundColor: attempt.isPassed ? colors.successSoft : colors.errorSoft }]}>
                          <Text style={[styles.attemptStatusText, { color: attempt.isPassed ? colors.primary : colors.error }]}>
                            {attempt.isPassed ? 'PASSED' : 'FAILED'}
                          </Text>
                        </View>
                        <Text style={[styles.attemptMetaText, { color: colors.textMuted }]}>
                          Attempt #{attempt.attemptCount}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.attemptScoreColumn}>
                      <Text style={[styles.attemptScoreValue, { color: attempt.isPassed ? colors.primary : colors.error }]}>
                        {pct}%
                      </Text>
                      <Text style={[styles.attemptScoreDetail, { color: colors.textMuted }]}>
                        {attempt.score}/{attempt.totalItems}
                      </Text>
                    </View>
                    {isExpanded
                      ? <ChevronUp size={18} color={colors.textMuted} />
                      : <ChevronDown size={18} color={colors.textMuted} />}
                  </TouchableOpacity>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <View style={[styles.attemptDetails, { borderTopColor: colors.border }]}>
                      <View style={styles.detailRow}>
                        <BookOpen size={14} color={colors.textMuted} />
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Lesson:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{getLOTitle(attempt.loId)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Clock size={14} color={colors.textMuted} />
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Date:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {formatDate(attempt.createdAt)} at {formatTime(attempt.createdAt)}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Award size={14} color={colors.textMuted} />
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Time Taken:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{formatDuration(attempt.timeTakenMs)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <ClipboardList size={14} color={colors.textMuted} />
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Score:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {attempt.score} out of {attempt.totalItems} ({pct}%)
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <CheckCircle size={14} color={colors.textMuted} />
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status:</Text>
                        <Text style={[styles.detailValue, { color: attempt.isPassed ? colors.primary : colors.error }]}>
                          {attempt.isPassed ? 'Completed — Passed' : 'Completed — Did Not Pass'}
                        </Text>
                      </View>

                      {/* Review Button */}
                      {canReview && (
                        <TouchableOpacity
                          style={[styles.reviewBtn, { backgroundColor: colors.primary }]}
                          onPress={() => setReviewAttempt(attempt)}
                        >
                          <Eye size={14} color="#000" />
                          <Text style={styles.reviewBtnText}>Review Answers</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <EmptyState
              icon={<ClipboardList size={40} color={colors.textMuted} />}
              title="No Quiz History Yet"
              message="Your quiz attempts will appear here once you start taking quizzes."
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Answer Review Modal */}
      <Modal visible={!!reviewAttempt} transparent animationType="slide" onRequestClose={() => setReviewAttempt(null)}>
        <View style={[styles.reviewOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.reviewHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.reviewHeaderLeft}>
                <Eye size={20} color={colors.primary} />
                <Text style={[styles.reviewTitle, { color: colors.text }]}>Quiz Review</Text>
              </View>
              <TouchableOpacity onPress={() => setReviewAttempt(null)} style={styles.reviewCloseBtn}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.reviewScroll} showsVerticalScrollIndicator={false}>
              {reviewAttempt && getAttemptReviewData(reviewAttempt)?.map((q, idx) => (
                <View key={q.questionId} style={[styles.reviewQuestion, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.reviewQuestionNum, { color: colors.textMuted }]}>Question {idx + 1}</Text>
                  <Text style={[styles.reviewQuestionText, { color: colors.text }]}>{q.questionText}</Text>
                  <View style={styles.reviewOptions}>
                    {q.options.map((opt, optIdx) => {
                      const isCorrectAns = optIdx === q.correctAnswer;
                      const isStudentAns = optIdx === q.studentAnswer;
                      const showCorrect = isCorrectAns;
                      const showWrong = isStudentAns && !isCorrectAns;
                      return (
                        <View
                          key={optIdx}
                          style={[
                            styles.reviewOption,
                            showCorrect && { backgroundColor: colors.successSoft, borderColor: colors.primary },
                            showWrong && { backgroundColor: colors.errorSoft, borderColor: colors.error },
                            !showCorrect && !showWrong && { backgroundColor: colors.surface, borderColor: colors.border },
                          ]}
                        >
                          <Text style={[styles.reviewOptionText, { color: colors.text }]}>
                            {opt}
                          </Text>
                          {showCorrect && <CheckCircle size={14} color={colors.primary} />}
                          {showWrong && <XCircle size={14} color={colors.error} />}
                        </View>
                      );
                    })}
                  </View>
                  <View style={[styles.reviewResultRow, { borderTopColor: colors.border }]}>
                    {q.isCorrect ? (
                      <><CheckCircle size={12} color={colors.primary} /><Text style={[styles.reviewResultText, { color: colors.primary }]}>Correct</Text></>
                    ) : q.studentAnswer === null ? (
                      <><Clock size={12} color={colors.textMuted} /><Text style={[styles.reviewResultText, { color: colors.textMuted }]}>Not Answered</Text></>
                    ) : (
                      <><XCircle size={12} color={colors.error} /><Text style={[styles.reviewResultText, { color: colors.error }]}>Incorrect</Text></>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  title: { fontSize: 26, fontWeight: '800' as const },
  subtitle: { fontSize: 14, marginBottom: 20, marginTop: 4 },
  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700' as const },
  statLabel: { fontSize: 10, textAlign: 'center' as const },
  // Filter
  filterRow: { marginBottom: 16, flexGrow: 0 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  filterChipText: { fontSize: 13, fontWeight: '600' as const },
  // Attempt cards
  attemptCard: { borderRadius: 14, marginBottom: 10, borderWidth: 1, overflow: 'hidden' as const },
  attemptCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  attemptIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  attemptInfo: { flex: 1, gap: 3 },
  attemptQuizTitle: { fontSize: 14, fontWeight: '600' as const },
  attemptSubjectName: { fontSize: 12 },
  attemptMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  attemptStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  attemptStatusText: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.5 },
  attemptMetaText: { fontSize: 11 },
  attemptScoreColumn: { alignItems: 'center', minWidth: 50 },
  attemptScoreValue: { fontSize: 20, fontWeight: '800' as const },
  attemptScoreDetail: { fontSize: 11 },
  // Expanded details
  attemptDetails: { padding: 14, borderTopWidth: 1, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 13, fontWeight: '500' as const },
  detailValue: { fontSize: 13, flex: 1 },
  // Review button
  reviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, height: 40, marginTop: 8 },
  reviewBtnText: { fontSize: 14, fontWeight: '600' as const, color: '#000' },
  // Review modal
  reviewOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  reviewCard: { borderRadius: 16, maxHeight: '85%', overflow: 'hidden' as const },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1 },
  reviewHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewTitle: { fontSize: 18, fontWeight: '700' as const },
  reviewCloseBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  reviewScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  reviewQuestion: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  reviewQuestionNum: { fontSize: 11, fontWeight: '700' as const, marginBottom: 6 },
  reviewQuestionText: { fontSize: 14, fontWeight: '500' as const, marginBottom: 10 },
  reviewOptions: { gap: 6 },
  reviewOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  reviewOptionText: { fontSize: 13, flex: 1 },
  reviewResultRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1 },
  reviewResultText: { fontSize: 12, fontWeight: '600' as const },
});
