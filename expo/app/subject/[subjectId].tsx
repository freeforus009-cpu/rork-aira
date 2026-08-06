import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  BookOpen, ChevronRight, Lock, CheckCircle, Clock, Circle, RefreshCw,
  AlertCircle, Megaphone, ClipboardList, FileText, Youtube, Video,
  Image as ImageIcon, Presentation, FileType, Download, Layers,
  GraduationCap, Calendar, ShieldX, BookMarked, ChevronLeft,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTheme } from '@/contexts/ThemeContext';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';
import SkeletonLoader from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import type { ContentType, QuizDisplayStatus, Announcement, COC, LearningOutcome } from '@/types';

const contentTypeIcon: Record<ContentType, typeof FileText> = {
  text: FileText,
  youtube: Youtube,
  pdf: FileType,
  ppt: Presentation,
  doc: FileText,
  image: ImageIcon,
  video: Video,
};

const contentTypeColor: Record<ContentType, string> = {
  text: '#00C9A7',
  youtube: '#FF0000',
  pdf: '#FF6B6B',
  ppt: '#FF8C42',
  doc: '#5BA4CF',
  image: '#A78BFA',
  video: '#FF6B6B',
};

const quizStatusConfig: Record<QuizDisplayStatus, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: '#00C9A7', bg: 'rgba(0,201,167,0.12)', label: 'Completed' },
  not_started: { icon: Clock, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Not Started' },
  in_progress: { icon: RefreshCw, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'In Progress' },
  missed: { icon: AlertCircle, color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Missed' },
};

export default function SubjectDetailScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const router = useRouter();
  const { currentUser, subjects, allUsers } = useAuth();
  const {
    getSubjectCOCs, getCOCLOs, getLOContents, getLOQuiz, getQuizQuestions,
    getLOStatus, getCOCProgress, getStudentProgress, getLOIncompleteContents,
    getQuizDisplayStatus, getStudentAnnouncements, isLessonMarkedDone,
    refreshFromCloud, isDataLoading,
  } = useData();
  const { colors } = useTheme();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Simulate brief loading for smooth UX
  useEffect(() => {
    if (!isDataLoading) {
      const timer = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isDataLoading]);

  const subject = useMemo(() => {
    return subjects.find(s => s.id === subjectId) ?? null;
  }, [subjects, subjectId]);

  // === ACCESS CONTROL: Verify enrollment ===
  const isEnrolled = useMemo(() => {
    if (!currentUser || !subject) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') return true;
    const enrolledIds = currentUser.subjectIds || [];
    return enrolledIds.includes(subject.id);
  }, [currentUser, subject]);

  const teacherName = useMemo(() => {
    if (!subject) return '';
    const teacher = allUsers.find(u => u.id === subject.adminId);
    return teacher?.fullName ?? 'Unknown Teacher';
  }, [subject, allUsers]);

  const subjectCOCs = useMemo(() => {
    if (!subjectId) return [];
    return getSubjectCOCs(subjectId);
  }, [getSubjectCOCs, subjectId]);

  const subjectAnnouncements = useMemo(() => {
    if (!currentUser) return [];
    const allAnns = getStudentAnnouncements(
      currentUser.id,
      currentUser.adminId,
      currentUser.sectionId,
      currentUser.gradeLevel,
    );
    // Filter to announcements from this subject's teacher
    if (!subject) return [];
    return allAnns
      .filter(a => a.adminId === subject.adminId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [currentUser, subject, getStudentAnnouncements]);

  const subjectProgress = useMemo(() => {
    if (!currentUser || !subject) return { total: 0, completed: 0, percentage: 0 };
    const allLOs: LearningOutcome[] = [];
    subjectCOCs.forEach(coc => {
      allLOs.push(...getCOCLOs(coc.id));
    });
    if (allLOs.length === 0) return { total: 0, completed: 0, percentage: 0 };
    let completed = 0;
    allLOs.forEach(lo => {
      const status = getLOStatus(currentUser.id, lo.id, subject);
      if (status === 'completed') completed++;
    });
    return {
      total: allLOs.length,
      completed,
      percentage: Math.round((completed / allLOs.length) * 100),
    };
  }, [currentUser, subject, subjectCOCs, getCOCLOs, getLOStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refreshFromCloud(); } finally { setRefreshing(false); }
  };

  const renderBackButton = () => (
    <TouchableOpacity
      onPress={() => {
        if (currentUser?.role === 'student') {
          router.push('/(student)/home' as any);
        } else {
          router.back();
        }
      }}
      style={styles.backBtn}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <ChevronLeft size={22} color={colors.text} />
      <Text style={[styles.backBtnText, { color: colors.text }]}>Back</Text>
    </TouchableOpacity>
  );

  if (!currentUser) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{
          title: 'Subject',
          headerLeft: () => renderBackButton(),
        }} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // === ACCESS DENIED STATE ===
  if (subject && !isEnrolled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{
          title: 'Access Denied',
          headerLeft: () => renderBackButton(),
        }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.accessDeniedWrap}>
            <View style={[styles.accessDeniedIcon, { backgroundColor: colors.errorSoft }]}>
              <ShieldX size={40} color={colors.error} />
            </View>
            <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>
              You are not enrolled in this subject
            </Text>
            <Text style={[styles.accessDeniedMsg, { color: colors.textSecondary }]}>
              Only enrolled students can access subject content. Please enroll in this subject from the Courses tab to view lessons, materials, and quizzes.
            </Text>
            <TouchableOpacity
              style={[styles.accessDeniedBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(student)/my-courses' as any)}
            >
              <BookOpen size={16} color="#000" />
              <Text style={styles.accessDeniedBtnText}>Browse Courses</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // === SUBJECT NOT FOUND STATE ===
  if (!subject && !isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{
          title: 'Not Found',
          headerLeft: () => renderBackButton(),
        }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <EmptyState
            icon={<AlertCircle size={40} color={colors.textMuted} />}
            title="Subject Not Found"
            message="This subject may have been removed or is no longer available."
            actionLabel="Go Home"
            onAction={() => router.push('/(student)/home' as any)}
          />
        </SafeAreaView>
      </View>
    );
  }

  // === LOADING STATE ===
  if (isLoading || !subject) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{
          title: 'Loading...',
          headerLeft: () => renderBackButton(),
        }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.loadingWrap}>
            <View style={[styles.loadingHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.loadingIconBox, { backgroundColor: colors.surfaceLight }]} />
              <View style={styles.loadingHeaderText}>
                <View style={[styles.loadingLine, { backgroundColor: colors.surfaceLight, width: 120 }]} />
                <View style={[styles.loadingLine, { backgroundColor: colors.surfaceLight, width: 200 }]} />
                <View style={[styles.loadingLine, { backgroundColor: colors.surfaceLight, width: 160 }]} />
              </View>
            </View>
            <SkeletonLoader count={3} height={100} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  const renderLO = (lo: LearningOutcome, coc: COC) => {
    const status = isAdmin ? 'available' as const : getLOStatus(currentUser.id, lo.id, subject);
    const isLocked = status === 'locked' && !isAdmin;
    const materials = getLOContents(lo.id);
    const quiz = getLOQuiz(lo.id);
    const quizQuestionCount = quiz ? getQuizQuestions(quiz.id).length : 0;
    const quizStatus = !isAdmin && quiz ? getQuizDisplayStatus(currentUser.id, lo.id, subject.id) : null;
    const incomplete = !isAdmin && !isLocked && status !== 'completed' ? getLOIncompleteContents(lo.id, currentUser.id) : { docs: 0, videos: 0, total: 0 };
    const lessonDone = !isAdmin && isLessonMarkedDone(currentUser.id, lo.id, subject.id);
    const prog = getStudentProgress(currentUser.id).find(p => p.loId === lo.id);
    const QuizIcon = quizStatus ? quizStatusConfig[quizStatus].icon : null;

    // Count material types
    const materialTypes = materials.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {} as Record<ContentType, number>);
    const materialTypeKeys = Object.keys(materialTypes) as ContentType[];

    return (
      <TouchableOpacity
        key={lo.id}
        style={[styles.loCard, { backgroundColor: colors.surface, borderColor: colors.border }, isLocked && styles.loCardLocked]}
        onPress={() => {
          if (!isLocked) {
            router.push(`/lo/${lo.id}` as any);
          }
        }}
        activeOpacity={isLocked ? 1 : 0.7}
        disabled={isLocked}
      >
        <View style={styles.loLeft}>
          <View style={[
            styles.loNumber,
            { backgroundColor: 'rgba(0,201,167,0.15)' },
            isLocked && { backgroundColor: 'rgba(74,85,104,0.2)' },
            status === 'completed' && { backgroundColor: colors.primary },
          ]}>
            {status === 'completed' ? (
              <CheckCircle size={18} color="#fff" />
            ) : isLocked ? (
              <Lock size={16} color={colors.textMuted} />
            ) : (
              <Text style={styles.loNumberText}>{lo.order}</Text>
            )}
          </View>
        </View>
        <View style={styles.loInfo}>
          <View style={styles.loTitleRow}>
            <Text style={[styles.loTitle, { color: colors.text }, isLocked && { color: colors.textMuted }]} numberOfLines={1}>
              LO {lo.order}: {lo.title}
            </Text>
            {incomplete.total > 0 && <View style={styles.incompleteDot} />}
          </View>
          <Text style={[styles.loDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {lo.description}
          </Text>

          {/* Material type indicators */}
          {materialTypeKeys.length > 0 && (
            <View style={styles.materialTypesRow}>
              {materialTypeKeys.map(type => {
                const Icon = contentTypeIcon[type] || FileText;
                return (
                  <View key={type} style={[styles.materialTypeChip, { backgroundColor: colors.surfaceLight }]}>
                    <Icon size={10} color={contentTypeColor[type]} />
                    <Text style={[styles.materialTypeText, { color: colors.textSecondary }]}>
                      {materials.filter(m => m.type === type).length} {type === 'youtube' ? 'Video' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Quiz indicator */}
          {quiz && (
            <View style={[styles.quizRow, { backgroundColor: colors.surfaceLight }]}>
              <ClipboardList size={12} color={colors.accent} />
              <Text style={[styles.quizRowText, { color: colors.textSecondary }]}>
                Quiz: {quiz.title}
              </Text>
              <Text style={[styles.quizQuestions, { color: colors.textMuted }]}>
                {quizQuestionCount} questions
              </Text>
              {lessonDone && (
                <View style={[styles.doneBadge, { backgroundColor: 'rgba(0,201,167,0.15)' }]}>
                  <CheckCircle size={9} color={colors.primary} />
                  <Text style={[styles.doneBadgeText, { color: colors.primary }]}>Done</Text>
                </View>
              )}
            </View>
          )}

          {/* Incomplete badge */}
          {incomplete.total > 0 && (
            <View style={styles.incompleteBadge}>
              <Circle size={8} color={colors.warning} fill={colors.warning} />
              <Text style={[styles.incompleteBadgeText, { color: colors.warning }]}>
                {incomplete.total} pending item{incomplete.total > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Quiz status badge */}
          {quizStatus && QuizIcon && (
            <View style={[styles.quizStatusBadge, { backgroundColor: quizStatusConfig[quizStatus].bg }]}>
              <QuizIcon size={11} color={quizStatusConfig[quizStatus].color} />
              <Text style={[styles.quizStatusText, { color: quizStatusConfig[quizStatus].color }]}>
                {quizStatusConfig[quizStatus].label}
              </Text>
            </View>
          )}

          {/* Score */}
          {prog?.passed && (
            <Text style={[styles.scoreText, { color: colors.primary }]}>
              Score: {prog.score}/{prog.totalItems ?? 20} ({((prog.score / Math.max(prog.totalItems ?? 20, 1)) * 100).toFixed(0)}%)
            </Text>
          )}

          <StatusBadge status={status} />
        </View>
        {!isLocked && <ChevronRight size={18} color={colors.textMuted} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        title: subject.code,
        headerLeft: () => renderBackButton(),
      }} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* === SUBJECT HEADER === */}
          <View style={[styles.subjectHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.subjectHeaderTop}>
              <View style={[styles.subjectIconWrap, { backgroundColor: 'rgba(0,201,167,0.12)' }]}>
                <BookOpen size={24} color={colors.primary} />
              </View>
              <View style={styles.subjectHeaderInfo}>
                <View style={styles.subjectCodeRow}>
                  <View style={[styles.subjectCodeBadge, { backgroundColor: 'rgba(0,201,167,0.15)' }]}>
                    <Text style={[styles.subjectCodeText, { color: colors.primary }]}>{subject.code}</Text>
                  </View>
                  <View style={[styles.unlockBadge, { backgroundColor: colors.surfaceLight }]}>
                    {subject.unlockType === 'sequential'
                      ? <Lock size={10} color={colors.warning} />
                      : <CheckCircle size={10} color={colors.primary} />}
                    <Text style={[styles.unlockText, { color: colors.textSecondary }]}>
                      {subject.unlockType === 'sequential' ? 'Sequential' : 'Flexible'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.subjectName, { color: colors.text }]}>{subject.name}</Text>
                {subject.description ? (
                  <Text style={[styles.subjectDescription, { color: colors.textSecondary }]}>
                    {subject.description}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Teacher & Grade info */}
            <View style={[styles.subjectMetaRow, { borderTopColor: colors.border }]}>
              <View style={styles.subjectMetaItem}>
                <GraduationCap size={14} color={colors.textMuted} />
                <Text style={[styles.subjectMetaText, { color: colors.textSecondary }]}>{teacherName}</Text>
              </View>
              {subject.gradeLevel && (
                <View style={styles.subjectMetaItem}>
                  <BookMarked size={14} color={colors.textMuted} />
                  <Text style={[styles.subjectMetaText, { color: colors.textSecondary }]}>{subject.gradeLevel}</Text>
                </View>
              )}
            </View>

            {/* Progress bar (students only) */}
            {!isAdmin && subjectProgress.total > 0 && (
              <View style={[styles.subjectProgressSection, { borderTopColor: colors.border }]}>
                <View style={styles.subjectProgressHeader}>
                  <Text style={[styles.subjectProgressLabel, { color: colors.textSecondary }]}>
                    Your Progress
                  </Text>
                  <Text style={[styles.subjectProgressValue, { color: colors.primary }]}>
                    {subjectProgress.completed}/{subjectProgress.total} LOs · {subjectProgress.percentage}%
                  </Text>
                </View>
                <ProgressBar percentage={subjectProgress.percentage} height={8} />
              </View>
            )}

            {/* Quick stats */}
            <View style={[styles.subjectStatsRow, { borderTopColor: colors.border }]}>
              <View style={styles.subjectStat}>
                <Layers size={14} color={colors.accent} />
                <Text style={[styles.subjectStatValue, { color: colors.text }]}>{subjectCOCs.length}</Text>
                <Text style={[styles.subjectStatLabel, { color: colors.textMuted }]}>
                  {subject.unlockType === 'flexible' ? 'Topics' : 'COCs'}
                </Text>
              </View>
              <View style={styles.subjectStat}>
                <BookOpen size={14} color={colors.primary} />
                <Text style={[styles.subjectStatValue, { color: colors.text }]}>{subjectProgress.total}</Text>
                <Text style={[styles.subjectStatLabel, { color: colors.textMuted }]}>Lessons</Text>
              </View>
              <View style={styles.subjectStat}>
                <ClipboardList size={14} color={colors.warning} />
                <Text style={[styles.subjectStatValue, { color: colors.text }]}>
                  {subjectCOCs.reduce((count, coc) => {
                    const los = getCOCLOs(coc.id);
                    return count + los.filter(lo => getLOQuiz(lo.id)).length;
                  }, 0)}
                </Text>
                <Text style={[styles.subjectStatLabel, { color: colors.textMuted }]}>Quizzes</Text>
              </View>
            </View>
          </View>

          {/* === ANNOUNCEMENTS === */}
          {subjectAnnouncements.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Megaphone size={16} color={colors.warning} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Announcements</Text>
              </View>
              {subjectAnnouncements.map(ann => {
                const isGlobal = ann.scope === 'global';
                const isTargeted = ann.scope === 'targeted';
                return (
                  <View
                    key={ann.id}
                    style={[
                      styles.annCard,
                      { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: isGlobal ? colors.accent : isTargeted ? colors.warning : colors.primary },
                    ]}
                  >
                    <View style={styles.annTitleRow}>
                      <Text style={[styles.annTitle, { color: colors.text }]} numberOfLines={1}>{ann.title}</Text>
                      {ann.priority === 'important' && (
                        <View style={[styles.annPriorityBadge, { backgroundColor: colors.warning }]}>
                          <Text style={styles.annPriorityText}>Important</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.annMessage, { color: colors.textSecondary }]} numberOfLines={3}>
                      {ann.message}
                    </Text>
                    <Text style={[styles.annDate, { color: colors.textMuted }]}>
                      {formatDate(ann.createdAt)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* === MODULES / COCs === */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Layers size={16} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {subject.unlockType === 'flexible' ? 'Topics' : 'Modules (COCs)'}
              </Text>
            </View>

            {subjectCOCs.length > 0 ? (
              subjectCOCs.map((coc) => {
                const cocLOs = getCOCLOs(coc.id);
                const cocProgress = isAdmin
                  ? { total: cocLOs.length, completed: 0, percentage: 0 }
                  : getCOCProgress(currentUser.id, coc.id);

                return (
                  <View key={coc.id} style={[styles.cocCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {/* COC Header */}
                    <View style={styles.cocHeader}>
                      <View style={styles.cocHeaderLeft}>
                        <View style={[styles.cocNumber, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                          <Text style={[styles.cocNumberText, { color: colors.accent }]}>{coc.order}</Text>
                        </View>
                        <View style={styles.cocHeaderInfo}>
                          <Text style={[styles.cocTitle, { color: colors.text }]} numberOfLines={1}>
                            {subject.unlockType === 'flexible' ? `Topic ${coc.order}` : `COC ${coc.order}`}: {coc.title}
                          </Text>
                          <Text style={[styles.cocDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                            {coc.description}
                          </Text>
                          {!isAdmin && cocProgress.total > 0 && (
                            <View style={styles.cocProgressRow}>
                              <ProgressBar percentage={cocProgress.percentage} height={5} />
                              <Text style={[styles.cocProgressText, { color: colors.textMuted }]}>
                                {cocProgress.completed}/{cocProgress.total} LOs
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* LOs within this COC */}
                    <View style={[styles.cocLOs, { borderTopColor: colors.border }]}>
                      {cocLOs.length > 0 ? (
                        cocLOs.map(lo => renderLO(lo, coc))
                      ) : (
                        <Text style={[styles.noLOsText, { color: colors.textMuted }]}>
                          No lessons in this module yet.
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <EmptyState
                icon={<Layers size={40} color={colors.textMuted} />}
                title="No Content Available"
                message={`This subject doesn't have any ${subject.unlockType === 'flexible' ? 'topics' : 'modules'} yet. Check back later or contact your teacher.`}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Loading state
  loadingWrap: { paddingTop: 16 },
  loadingHeaderCard: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, flexDirection: 'row', gap: 14 },
  loadingIconBox: { width: 48, height: 48, borderRadius: 14 },
  loadingHeaderText: { flex: 1, gap: 8, paddingTop: 4 },
  loadingLine: { height: 12, borderRadius: 6 },

  // Back button
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -4 },
  backBtnText: { fontSize: 16, fontWeight: '600' },

  // Access denied
  accessDeniedWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  accessDeniedIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  accessDeniedTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  accessDeniedMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  accessDeniedBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  accessDeniedBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },

  // Subject header
  subjectHeader: { borderRadius: 18, padding: 20, marginBottom: 24, borderWidth: 1 },
  subjectHeaderTop: { flexDirection: 'row', gap: 14 },
  subjectIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  subjectHeaderInfo: { flex: 1 },
  subjectCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  subjectCodeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  subjectCodeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  unlockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  unlockText: { fontSize: 10, fontWeight: '500' },
  subjectName: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subjectDescription: { fontSize: 13, lineHeight: 19 },

  // Subject meta
  subjectMetaRow: { flexDirection: 'row', gap: 20, paddingTop: 14, marginTop: 14, borderTopWidth: 1 },
  subjectMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subjectMetaText: { fontSize: 12, fontWeight: '500' },

  // Subject progress
  subjectProgressSection: { paddingTop: 14, marginTop: 14, borderTopWidth: 1, gap: 8 },
  subjectProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectProgressLabel: { fontSize: 12, fontWeight: '500' },
  subjectProgressValue: { fontSize: 12, fontWeight: '700' },

  // Subject stats
  subjectStatsRow: { flexDirection: 'row', paddingTop: 14, marginTop: 14, borderTopWidth: 1, gap: 8 },
  subjectStat: { flex: 1, alignItems: 'center', gap: 4 },
  subjectStatValue: { fontSize: 18, fontWeight: '700' },
  subjectStatLabel: { fontSize: 10 },

  // Section
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },

  // Announcements
  annCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderLeftWidth: 3 },
  annTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  annTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  annPriorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  annPriorityText: { fontSize: 9, color: '#000', fontWeight: '700' },
  annMessage: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  annDate: { fontSize: 11 },

  // COC card
  cocCard: { borderRadius: 16, marginBottom: 16, borderWidth: 1, overflow: 'hidden' },
  cocHeader: { padding: 16 },
  cocHeaderLeft: { flexDirection: 'row', gap: 12 },
  cocNumber: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cocNumberText: { fontSize: 14, fontWeight: '700' },
  cocHeaderInfo: { flex: 1 },
  cocTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cocDescription: { fontSize: 12, lineHeight: 16, marginBottom: 8 },
  cocProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cocProgressText: { fontSize: 11, flexShrink: 0 },

  // LOs within COC
  cocLOs: { padding: 12, paddingTop: 8, borderTopWidth: 1, gap: 8 },
  noLOsText: { fontSize: 12, fontStyle: 'italic', paddingVertical: 8, textAlign: 'center' },

  // LO card
  loCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 14, borderWidth: 1 },
  loCardLocked: { opacity: 0.5 },
  loLeft: { marginRight: 12 },
  loNumber: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  loNumberText: { fontSize: 14, fontWeight: '700', color: '#00C9A7' },
  loInfo: { flex: 1, gap: 4 },
  loTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  loDescription: { fontSize: 11, lineHeight: 15 },

  // Material types
  materialTypesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  materialTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  materialTypeText: { fontSize: 9, fontWeight: '500' },

  // Quiz row
  quizRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, marginTop: 2 },
  quizRowText: { fontSize: 11, fontWeight: '500', flex: 1 },
  quizQuestions: { fontSize: 10 },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  doneBadgeText: { fontSize: 9, fontWeight: '700' },

  // Incomplete
  incompleteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B', flexShrink: 0 },
  incompleteBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  incompleteBadgeText: { fontSize: 10, fontWeight: '500', color: '#F59E0B' },

  // Quiz status
  quizStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginTop: 2 },
  quizStatusText: { fontSize: 10, fontWeight: '600' },

  // Score
  scoreText: { fontSize: 11, fontWeight: '600', color: '#00C9A7' },
});
