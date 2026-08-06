import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Modal,
  ActivityIndicator, Image as RNImage, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import {
  BookOpen, PlayCircle, FileText, ExternalLink, ClipboardList, Upload,
  CheckCircle, Circle, Lock, Download, Image as ImageIcon, Presentation,
  FileType, Video, Youtube, ArrowRight, RotateCcw,
  Calendar, CalendarClock, CalendarX, Timer, Eye,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useConnectivity } from '@/contexts/ConnectivityContext';
import { useToast } from '@/contexts/ToastContext';
import StatusBadge from '@/components/StatusBadge';
import VideoPlayer from '@/components/VideoPlayer';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import OfflineBanner from '@/components/OfflineBanner';
import DocumentPreview from '@/components/DocumentPreview';
import SkeletonLoader from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import Colors from '@/constants/colors';
import type { Content, ContentType, QuizScheduleStatus } from '@/types';

const contentTypeConfig: Record<ContentType, { icon: typeof FileText; color: string; label: string }> = {
  text: { icon: FileText, color: Colors.primary, label: 'Text' },
  youtube: { icon: Youtube, color: '#FF0000', label: 'YouTube' },
  pdf: { icon: FileType, color: '#FF6B6B', label: 'PDF' },
  ppt: { icon: Presentation, color: '#FF8C42', label: 'PowerPoint' },
  doc: { icon: FileText, color: '#5BA4CF', label: 'Document' },
  image: { icon: ImageIcon, color: '#A78BFA', label: 'Image' },
  video: { icon: Video, color: '#FF6B6B', label: 'Video' },
};

export default function LODetailScreen() {
  const { loId } = useLocalSearchParams<{ loId: string }>();
  const router = useRouter();
  const { currentUser, subjects } = useAuth();
  const {
    learningOutcomes, getLOContents, getQuizQuestions, getLOQuiz,
    getLOStatus, getStudentProgress, hasSubmissions, isLOValidated, getCooldownRemaining,
    isLessonMarkedDone, markLessonDone, markLessonUndone, isQuizUnlocked,
    getQuizScheduleStatus, getQuizSchedule, isQuizAccessible, getQuizTimeUntilStart,
    updateDocProgress, getDocProgress,
    createPendingQuizNotification,
  } = useData();
  const { isOnline } = useConnectivity();
  const { success: showSuccess, info: showInfo } = useToast();

  const [showCompletionDialog, setShowCompletionDialog] = useState<boolean>(false);
  const [markingDone, setMarkingDone] = useState<boolean>(false);
  const [showDocPreview, setShowDocPreview] = useState<boolean>(false);
  const [docPreviewIndex, setDocPreviewIndex] = useState<number>(0);
  const [scheduleCountdown, setScheduleCountdown] = useState<string>('');
  const [isLessonLoading, setIsLessonLoading] = useState<boolean>(true);
  const navigatedToQuizRef = useRef<boolean>(false);

  const lo = useMemo(() => learningOutcomes.find(l => l.id === loId), [learningOutcomes, loId]);

  const subject = useMemo(() => {
    if (!lo) return null;
    return subjects.find(s => s.id === lo.subjectId) ?? null;
  }, [lo, subjects]);

  const loMaterials = useMemo(() => getLOContents(loId ?? ''), [getLOContents, loId]);
  const quiz = useMemo(() => getLOQuiz(loId ?? ''), [getLOQuiz, loId]);
  const loQuestions = useMemo(() => quiz ? getQuizQuestions(quiz.id) : [], [quiz, getQuizQuestions]);

  const status = useMemo(() => {
    if (!currentUser || !loId || !subject) return 'locked' as const;
    return getLOStatus(currentUser.id, loId, subject);
  }, [currentUser, loId, subject, getLOStatus]);

  const progressData = useMemo(() => {
    if (!currentUser) return null;
    return getStudentProgress(currentUser.id).find(p => p.loId === loId);
  }, [currentUser, loId, getStudentProgress]);

  const lessonDone = useMemo(() => {
    if (!currentUser || !loId || !subject) return false;
    return isLessonMarkedDone(currentUser.id, loId, subject.id);
  }, [currentUser, loId, subject, isLessonMarkedDone]);

  const quizUnlocked = useMemo(() => {
    if (!currentUser || !loId || !subject) return false;
    return isQuizUnlocked(currentUser.id, loId, subject.id);
  }, [currentUser, loId, subject, isQuizUnlocked]);

  const hasSubs = useMemo(() => {
    if (!currentUser || !loId) return false;
    return hasSubmissions(currentUser.id, loId);
  }, [currentUser, loId, hasSubmissions]);

  const validated = useMemo(() => {
    if (!currentUser || !loId) return false;
    return isLOValidated(currentUser.id, loId);
  }, [currentUser, loId, isLOValidated]);

  const cooldown = useMemo(() => {
    if (!currentUser || !loId) return 0;
    return getCooldownRemaining(currentUser.id, loId);
  }, [currentUser, loId, getCooldownRemaining]);

  // === Schedule state for flexible quizzes ===
  const isFlexibleSubject = subject?.unlockType === 'flexible';

  const quizScheduleStatus = useMemo<QuizScheduleStatus>(() => {
    if (!quiz || !isFlexibleSubject) return 'available';
    return getQuizScheduleStatus(quiz.id);
  }, [quiz, isFlexibleSubject, getQuizScheduleStatus]);

  const quizSchedule = useMemo(() => {
    if (!quiz) return undefined;
    return getQuizSchedule(quiz.id);
  }, [quiz, getQuizSchedule]);

  const quizScheduleAccessible = useMemo(() => {
    if (!quiz || !isFlexibleSubject) return true;
    return isQuizAccessible(quiz.id);
  }, [quiz, isFlexibleSubject, isQuizAccessible]);

  // Live countdown for upcoming scheduled quiz
  useEffect(() => {
    if (!quiz || !isFlexibleSubject || quizScheduleStatus !== 'upcoming') {
      setScheduleCountdown('');
      return;
    }
    const updateCountdown = () => {
      const ms = getQuizTimeUntilStart(quiz.id);
      if (ms <= 0) { setScheduleCountdown(''); return; }
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      if (days > 0) setScheduleCountdown(`${days}d ${hours}h ${mins}m`);
      else if (hours > 0) setScheduleCountdown(`${hours}h ${mins}m ${secs}s`);
      else setScheduleCountdown(`${mins}m ${secs}s`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [quiz, isFlexibleSubject, quizScheduleStatus, getQuizTimeUntilStart]);

  // Simulate loading state for skeleton
  useEffect(() => {
    setIsLessonLoading(true);
    const timer = setTimeout(() => setIsLessonLoading(false), 400);
    return () => clearTimeout(timer);
  }, [loId]);

  // Create pending quiz notification when student leaves the lesson without taking the quiz
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // On screen blur (leaving the lesson)
        if (!currentUser || !loId || !subject) return;
        if (navigatedToQuizRef.current) {
          navigatedToQuizRef.current = false;
          return; // student went to take the quiz — no notification
        }
        // If lesson is marked done but quiz not passed, create pending notification
        const prog = progressData;
        if (prog?.lessonMarkedDone && !prog?.passed) {
          void createPendingQuizNotification(currentUser.id, loId, subject.id);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, loId, subject, progressData, createPendingQuizNotification]),
  );

  // Previewable files for DocumentPreview modal
  const previewableFiles = useMemo(() => {
    return loMaterials.filter(m => ['pdf', 'ppt', 'doc', 'image'].includes(m.type));
  }, [loMaterials]);

  if (!lo || !currentUser || !subject) return null;

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const isSequential = subject.unlockType === 'sequential';
  const isFlexible = subject.unlockType === 'flexible';
  const isQuizLocked = progressData?.passed && isFlexible;
  const canTakeQuiz = !isQuizLocked && cooldown === 0 && status !== 'locked' && quizUnlocked && (isFlexible ? quizScheduleAccessible : true);

  const openYouTube = (url: string) => {
    if (!isOnline) {
      showInfo('YouTube requires an internet connection');
      return;
    }
    Linking.openURL(url).catch(err => console.log('[LO] Failed to open URL', err));
  };

  const openFile = (content: Content) => {
    if (content.fileUrl) {
      Linking.openURL(content.fileUrl).catch(err => console.log('[LO] Failed to open file', err));
    } else if (content.content) {
      Linking.openURL(content.content).catch(err => console.log('[LO] Failed to open URL', err));
    }
  };

  const openDocPreview = (content: Content) => {
    const idx = previewableFiles.findIndex(f => f.id === content.id);
    if (idx >= 0) {
      setDocPreviewIndex(idx);
      setShowDocPreview(true);
    } else {
      openFile(content);
    }
  };

  const handleMarkDone = async () => {
    if (!currentUser || !loId || !subject) return;
    setMarkingDone(true);
    try {
      await markLessonDone(currentUser.id, loId, subject.id);
      const hasQuiz = quiz && loQuestions.length > 0;
      const quizPassed = progressData?.passed;
      const quizAttempted = progressData && progressData.attempts > 0;
      if (hasQuiz && !quizPassed && !quizAttempted) {
        setShowCompletionDialog(true);
      } else if (quizPassed) {
        showSuccess('Lesson completed successfully.');
      } else if (quizAttempted && !quizPassed) {
        setShowCompletionDialog(true);
      } else {
        showSuccess('Lesson completed successfully.');
      }
    } catch {
      showInfo('Could not mark lesson as done');
    } finally {
      setMarkingDone(false);
    }
  };

  const handleMarkUndone = async () => {
    if (!currentUser || !loId || !subject) return;
    setMarkingDone(true);
    try {
      await markLessonUndone(currentUser.id, loId, subject.id);
      showInfo('Lesson marked as undone. Quiz is now locked.');
    } catch {
      showInfo('Could not update lesson status');
    } finally {
      setMarkingDone(false);
    }
  };

  const renderMaterial = (mat: Content) => {
    const config = contentTypeConfig[mat.type] ?? contentTypeConfig.text;
    const Icon = config.icon;

    if (mat.type === 'text') {
      return (
        <View key={mat.id} style={styles.materialCard}>
          <View style={styles.materialHeader}>
            <Icon size={18} color={config.color} />
            <Text style={styles.materialTitle}>{mat.title}</Text>
          </View>
          <Text style={styles.materialContent}>{mat.content}</Text>
        </View>
      );
    }

    if (mat.type === 'youtube') {
      return (
        <TouchableOpacity key={mat.id} style={styles.materialCard} onPress={() => openYouTube(mat.content)} disabled={!isOnline}>
          <View style={styles.materialHeader}>
            <Icon size={18} color={config.color} />
            <Text style={styles.materialTitle}>{mat.title}</Text>
          </View>
          <View style={styles.youtubeLink}>
            <ExternalLink size={14} color={isOnline ? Colors.accent : Colors.textMuted} />
            <Text style={[styles.youtubeLinkText, !isOnline && styles.youtubeLinkDisabled]}>
              {isOnline ? 'Watch on YouTube' : 'Requires Internet'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (mat.type === 'video' && mat.fileUrl) {
      return (
        <View key={mat.id} style={styles.materialCard}>
          <View style={styles.materialHeader}>
            <Icon size={18} color={config.color} />
            <Text style={styles.materialTitle}>{mat.title}</Text>
          </View>
          <VideoPlayer uri={mat.fileUrl} contentId={mat.id} thumbnail={mat.thumbnailUrl} />
          {mat.videoMetadata?.duration ? (
            <Text style={styles.videoMeta}>Duration: {Math.floor(mat.videoMetadata.duration / 60)}:{String(Math.floor(mat.videoMetadata.duration % 60)).padStart(2, '0')}</Text>
          ) : null}
        </View>
      );
    }

    if (mat.type === 'image' && (mat.fileUrl || mat.content)) {
      const imageUrl = mat.fileUrl ?? mat.content;
      return (
        <TouchableOpacity key={mat.id} style={styles.materialCard} onPress={() => openDocPreview(mat)} activeOpacity={0.9}>
          <View style={styles.materialHeader}>
            <Icon size={18} color={config.color} />
            <Text style={styles.materialTitle}>{mat.title}</Text>
            <View style={styles.previewBadge}>
              <Eye size={12} color={Colors.primary} />
              <Text style={styles.previewBadgeText}>Preview</Text>
            </View>
          </View>
          <RNImage source={{ uri: imageUrl }} style={styles.imageContent} resizeMode="contain" />
        </TouchableOpacity>
      );
    }

    if (mat.type === 'pdf' || mat.type === 'ppt' || mat.type === 'doc') {
      return (
        <View key={mat.id} style={styles.materialCard}>
          <View style={styles.materialHeader}>
            <Icon size={18} color={config.color} />
            <Text style={styles.materialTitle}>{mat.title}</Text>
          </View>
          <View style={styles.fileActionRow}>
            <TouchableOpacity style={styles.previewBtn} onPress={() => openDocPreview(mat)} activeOpacity={0.8}>
              <Eye size={16} color={Colors.primary} />
              <Text style={styles.previewBtnText}>Quick Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadBtn} onPress={() => openFile(mat)} activeOpacity={0.8}>
              <Download size={16} color={Colors.accent} />
              <Text style={styles.downloadBtnText}>Download</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fileMetaText}>
            {mat.fileName ?? mat.title} · {config.label}
            {mat.fileSize ? ` · ${(mat.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}
          </Text>
        </View>
      );
    }

    return (
      <View key={mat.id} style={styles.materialCard}>
        <View style={styles.materialHeader}>
          <Icon size={18} color={config.color} />
          <Text style={styles.materialTitle}>{mat.title}</Text>
        </View>
        <Text style={styles.materialContent}>{mat.content}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `LO ${lo.order}`,
          headerRight: () => <SyncStatusIndicator />,
        }}
      />
      <OfflineBanner />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.loOrder}>Learning Outcome {lo.order}</Text>
            {!isAdmin && <StatusBadge status={status} size="medium" />}
          </View>
          <Text style={styles.loTitle}>{lo.title}</Text>
          <Text style={styles.loDescription}>{lo.description}</Text>

          {lo.performanceCriteria.length > 0 && (
            <View style={styles.criteriaSection}>
              <Text style={styles.criteriaTitle}>Performance Criteria:</Text>
              {lo.performanceCriteria.map((pc, idx) => (
                <View key={idx} style={styles.criteriaItem}>
                  <View style={styles.criteriaDot} />
                  <Text style={styles.criteriaText}>{pc}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {isLessonLoading ? (
          <>
            <Text style={styles.sectionTitle}>Learning Materials</Text>
            <SkeletonLoader count={2} height={80} showText textLines={2} />
          </>
        ) : loMaterials.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Learning Materials</Text>
            {loMaterials.map(renderMaterial)}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Learning Materials</Text>
            <EmptyState
              icon={<BookOpen size={36} color={Colors.textMuted} />}
              title="No Materials Yet"
              message="Learning materials will appear here once the instructor adds them."
            />
          </>
        )}

        {!isAdmin && (
          <View style={styles.actionsSection}>
            {/* Mark as Done / Undone Toggle */}
            <View style={styles.lessonDoneSection}>
              {lessonDone ? (
                <TouchableOpacity
                  style={[styles.doneButton, styles.undoneButton]}
                  onPress={handleMarkUndone}
                  disabled={markingDone}
                >
                  {markingDone ? (
                    <ActivityIndicator size="small" color={Colors.text} />
                  ) : (
                    <>
                      <RotateCcw size={18} color={Colors.text} />
                      <Text style={styles.undoneButtonText}>Mark as Undone</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={handleMarkDone}
                  disabled={markingDone}
                >
                  {markingDone ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <CheckCircle size={18} color="#000" />
                      <Text style={styles.doneButtonText}>Mark as Done</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {lessonDone && (
                <Text style={styles.doneTimestamp}>
                  Completed on {progressData?.lessonDoneAt ? new Date(progressData.lessonDoneAt).toLocaleDateString() : 'N/A'}
                </Text>
              )}
            </View>

            {/* Quiz Gating UI */}
            {isSequential && (
              <TouchableOpacity
                style={styles.submissionButton}
                onPress={() => router.push(`/submissions/${loId}` as any)}
              >
                <Upload size={18} color={Colors.accent} />
                <View style={styles.submissionInfo}>
                  <Text style={styles.submissionTitle}>Submissions</Text>
                  <Text style={styles.submissionSubtitle}>
                    {hasSubs ? (validated ? 'Validated' : 'Submitted - Awaiting validation') : 'Submit your work before taking the quiz'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Schedule Status Badge (Flexible Subjects Only) */}
            {isFlexible && quizSchedule && quizUnlocked && !progressData?.passed && (
              <View style={styles.scheduleStatusCard}>
                {quizScheduleStatus === 'upcoming' && (
                  <>
                    <View style={[styles.scheduleStatusBadge, { backgroundColor: Colors.accent + '20' }]}>
                      <Calendar size={12} color={Colors.accent} />
                      <Text style={[styles.scheduleStatusBadgeText, { color: Colors.accent }]}>Upcoming</Text>
                    </View>
                    <Text style={styles.scheduleStatusTitle}>Quiz Opens Soon</Text>
                    <Text style={styles.scheduleStatusTime}>
                      Opens: {new Date(quizSchedule.startDateTime).toLocaleString()}
                    </Text>
                    {scheduleCountdown && (
                      <View style={styles.scheduleCountdownRow}>
                        <Timer size={16} color={Colors.accent} />
                        <Text style={styles.scheduleCountdownText}>Opens in {scheduleCountdown}</Text>
                      </View>
                    )}
                  </>
                )}
                {quizScheduleStatus === 'available' && (
                  <>
                    <View style={[styles.scheduleStatusBadge, { backgroundColor: Colors.success + '20' }]}>
                      <CalendarClock size={12} color={Colors.success} />
                      <Text style={[styles.scheduleStatusBadgeText, { color: Colors.success }]}>Available</Text>
                    </View>
                    <Text style={styles.scheduleStatusTitle}>Quiz Available Now</Text>
                    <Text style={styles.scheduleStatusTime}>
                      Closes: {new Date(quizSchedule.endDateTime).toLocaleString()}
                    </Text>
                  </>
                )}
                {quizScheduleStatus === 'closed' && (
                  <>
                    <View style={[styles.scheduleStatusBadge, { backgroundColor: Colors.error + '20' }]}>
                      <CalendarX size={12} color={Colors.error} />
                      <Text style={[styles.scheduleStatusBadgeText, { color: Colors.error }]}>Closed</Text>
                    </View>
                    <Text style={styles.scheduleStatusTitle}>Quiz Closed</Text>
                    <Text style={styles.scheduleStatusTime}>
                      Closed: {new Date(quizSchedule.endDateTime).toLocaleString()}
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Quiz Button with Gating */}
            {progressData?.passed ? (
              <View style={styles.passedBanner}>
                <Text style={styles.passedEmoji}>🎉</Text>
                <Text style={styles.passedTitle}>Excellent! Keep up the good work. ☺</Text>
                <Text style={styles.passedScore}>
                  Score: {progressData.score}/{loQuestions.length} ({((progressData.score / Math.max(loQuestions.length, 1)) * 100).toFixed(0)}%)
                </Text>
                <Text style={styles.passedAttempts}>Attempts: {progressData.attempts}</Text>
              </View>
            ) : !quizUnlocked ? (
              <View style={styles.quizLockedCard}>
                <View style={styles.quizLockedHeader}>
                  <Lock size={20} color={Colors.textMuted} />
                  <View style={styles.quizLockedInfo}>
                    <Text style={styles.quizLockedTitle}>Quiz Locked</Text>
                    <Text style={styles.quizLockedText}>
                      Mark this lesson as done to unlock the quiz
                    </Text>
                  </View>
                </View>
                {loQuestions.length > 0 && (
                  <Text style={styles.quizLockedQuestions}>{loQuestions.length} questions · 80% to pass</Text>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.quizButton, !canTakeQuiz && styles.quizButtonDisabled]}
                onPress={() => {
                  if (canTakeQuiz && loQuestions.length > 0) {
                    navigatedToQuizRef.current = true;
                    router.push(`/quiz/${loId}` as any);
                  }
                }}
                disabled={!canTakeQuiz || loQuestions.length === 0}
              >
                <ClipboardList size={20} color={canTakeQuiz ? '#000' : Colors.textMuted} />
                <View style={styles.quizButtonInfo}>
                  <Text style={[styles.quizButtonTitle, !canTakeQuiz && styles.quizButtonTitleDisabled]}>
                    Take Quiz
                  </Text>
                  <Text style={[styles.quizButtonSubtitle, !canTakeQuiz && styles.quizButtonSubDisabled]}>
                    {loQuestions.length} questions · 80% to pass
                    {cooldown > 0 ? ` · Cooldown: ${Math.ceil(cooldown / 60000)}min` : ''}
                    {progressData ? ` · Attempts: ${progressData.attempts}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Completion Dialog — Quiz Reminder */}
      <Modal visible={showCompletionDialog} transparent animationType="fade" onRequestClose={() => setShowCompletionDialog(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconWrap}>
              {progressData && progressData.attempts > 0 && !progressData.passed ? (
                <RotateCcw size={48} color={Colors.warning} />
              ) : (
                <CheckCircle size={48} color={Colors.primary} />
              )}
            </View>
            <Text style={styles.dialogTitle}>
              {progressData && progressData.attempts > 0 && !progressData.passed ? 'Quiz Retry Needed' : 'Lesson Completed!'}
            </Text>
            <Text style={styles.dialogMessage}>
              {progressData && progressData.attempts > 0 && !progressData.passed
                ? `You've completed this lesson, but your quiz needs another attempt. Current score: ${progressData.score}/${loQuestions.length}. Please complete the quiz before proceeding.`
                : "You have completed this lesson, but you haven't taken the quiz yet. Please complete the quiz before proceeding."}
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.dialogSecondaryBtn}
                onPress={() => {
                  setShowCompletionDialog(false);
                  // Student chose "Later" — create pending quiz notification
                  if (currentUser && loId && subject) {
                    void createPendingQuizNotification(currentUser.id, loId, subject.id);
                  }
                }}
              >
                <Text style={styles.dialogSecondaryText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogPrimaryBtn}
                onPress={() => {
                  setShowCompletionDialog(false);
                  if (loQuestions.length > 0) {
                    navigatedToQuizRef.current = true;
                    router.push(`/quiz/${loId}` as any);
                  }
                }}
              >
                <Text style={styles.dialogPrimaryText}>Take Quiz Now</Text>
                <ArrowRight size={16} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Document Preview Modal */}
      <DocumentPreview
        visible={showDocPreview}
        files={previewableFiles}
        startIndex={docPreviewIndex}
        onClose={() => setShowDocPreview(false)}
        onProgressUpdate={(contentId, percent, read) => {
          if (currentUser) {
            void updateDocProgress(currentUser.id, contentId, percent, read);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  headerCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  loOrder: { fontSize: 12, fontWeight: '700' as const, color: Colors.primary, letterSpacing: 1 },
  loTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  loDescription: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  criteriaSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  criteriaTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.text, marginBottom: 8 },
  criteriaItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  criteriaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 6 },
  criteriaText: { fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 14 },
  materialCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  materialHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  materialTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, flex: 1 },
  materialContent: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  youtubeLink: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(91,164,207,0.1)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' as const },
  youtubeLinkText: { fontSize: 13, color: Colors.accent, fontWeight: '500' as const },
  youtubeLinkDisabled: { color: Colors.textMuted },
  imageContent: { width: '100%', height: 240, borderRadius: 10, marginTop: 8 },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  fileInfoText: { fontSize: 13, color: Colors.accent, fontWeight: '500' as const },
  videoMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  previewBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: Colors.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  previewBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '600' as const },
  fileActionRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 8 },
  previewBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, backgroundColor: Colors.primary + '15', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flex: 1, justifyContent: 'center' as const },
  previewBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.primary },
  downloadBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, backgroundColor: Colors.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flex: 1, justifyContent: 'center' as const, borderWidth: 1, borderColor: Colors.border },
  downloadBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent },
  fileMetaText: { fontSize: 11, color: Colors.textMuted },
  scheduleStatusCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  scheduleStatusBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, alignSelf: 'flex-start' as const, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  scheduleStatusBadgeText: { fontSize: 11, fontWeight: '700' as const },
  scheduleStatusTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  scheduleStatusTime: { fontSize: 12, color: Colors.textSecondary },
  scheduleCountdownRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 4 },
  scheduleCountdownText: { fontSize: 14, fontWeight: '700' as const, color: Colors.accent },
  actionsSection: { marginTop: 10, gap: 12 },
  lessonDoneSection: { marginBottom: 4 },
  doneButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16 },
  undoneButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  doneButtonText: { fontSize: 15, fontWeight: '700' as const, color: '#000' },
  undoneButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  doneTimestamp: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' as const, marginTop: 8 },
  submissionButton: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  submissionInfo: { flex: 1 },
  submissionTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  submissionSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  quizLockedCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border, opacity: 0.8 },
  quizLockedHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  quizLockedInfo: { flex: 1 },
  quizLockedTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary },
  quizLockedText: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  quizLockedQuestions: { fontSize: 12, color: Colors.textMuted, marginTop: 10 },
  passedBanner: { backgroundColor: 'rgba(0,201,167,0.1)', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,201,167,0.3)' },
  passedEmoji: { fontSize: 40, marginBottom: 8 },
  passedTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.primary, textAlign: 'center' as const },
  passedScore: { fontSize: 14, color: Colors.text, marginTop: 8 },
  passedAttempts: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  quizButton: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.primary, borderRadius: 14, padding: 18 },
  quizButtonDisabled: { backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  quizButtonInfo: { flex: 1 },
  quizButtonTitle: { fontSize: 16, fontWeight: '700' as const, color: '#000' },
  quizButtonTitleDisabled: { color: Colors.textMuted },
  quizButtonSubtitle: { fontSize: 12, color: 'rgba(0,0,0,0.6)', marginTop: 2 },
  quizButtonSubDisabled: { color: Colors.textMuted },
  dialogOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20 },
  dialogCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  dialogIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  dialogTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  dialogMessage: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' as const, lineHeight: 20, marginBottom: 24 },
  dialogActions: { flexDirection: 'row', gap: 12, width: '100%' },
  dialogSecondaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  dialogSecondaryText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary },
  dialogPrimaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary },
  dialogPrimaryText: { fontSize: 15, fontWeight: '700' as const, color: '#000' },
});
