import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  Platform, AppState, Animated, Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, Clock, CheckCircle, XCircle, AlertTriangle, Lock,
  Calendar, CalendarClock, CalendarX, Timer, EyeOff, ShieldAlert,
  BookOpen, Award, TrendingUp, Users,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import Colors from '@/constants/colors';
import type { QuizScheduleStatus, QuizViolationType } from '@/types';

export default function QuizScreen() {
  const { loId } = useLocalSearchParams<{ loId: string }>();
  const router = useRouter();
  const { currentUser, subjects } = useAuth();
  const { learningOutcomes, getLOQuiz, getShuffledQuizQuestions, submitQuiz, getCooldownRemaining, progress, isLessonMarkedDone, isQuizUnlocked, getQuizScheduleStatus, getQuizSchedule, getQuizTimeUntilStart, getQuizTimeUntilEnd, isQuizAccessible, recordQuizViolation, getViolationCount, isQuizViolationLocked, getQuizLock, getQuizLockRemaining, clearQuizLock, removePendingQuizNotification } = useData();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean; percentage: number } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [lastViolationType, setLastViolationType] = useState<QuizViolationType | null>(null);
  const [violationLocked, setViolationLocked] = useState(false);
  const [violationLockRemaining, setViolationLockRemaining] = useState(0);
  const violationWarnAnim = useRef(new Animated.Value(0)).current;
  const appStateRef = useRef<string>('active');
  const quizStartTime = useRef<number>(Date.now());

  const lo = learningOutcomes.find(l => l.id === loId);
  const subject = useMemo(() => {
    if (!lo) return null;
    return subjects.find(s => s.id === lo.subjectId) ?? null;
  }, [lo, subjects]);

  const quiz = getLOQuiz(loId ?? '');
  const quizQuestions = useMemo(() => {
    if (!quiz) return [];
    return getShuffledQuizQuestions(quiz.id);
  }, [quiz, getShuffledQuizQuestions]);

  const isFlexible = subject?.unlockType === 'flexible';
  const isSequential = subject?.unlockType === 'sequential';

  // === Tab-switch / window-exit violation detection ===
  const recordViolation = useCallback((type: QuizViolationType) => {
    if (!currentUser || !quiz || !lo || showResults || violationLocked) return;
    const count = getViolationCount(currentUser.id, quiz.id);
    const newCount = count + 1;
    setViolationCount(newCount);
    setLastViolationType(type);
    setShowViolationWarning(true);
    Animated.sequence([
      Animated.timing(violationWarnAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(violationWarnAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
      Animated.timing(violationWarnAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setShowViolationWarning(false));
    void recordQuizViolation(
      currentUser.id,
      currentUser.fullName,
      quiz.id,
      lo.id,
      lo.subjectId,
      type,
      currentQuestionIndex,
    );
    if (newCount >= 3) {
      setViolationLocked(true);
      setViolationLockRemaining(10 * 60 * 1000);
    }
  }, [currentUser, quiz, lo, showResults, getViolationCount, recordQuizViolation, currentQuestionIndex, violationWarnAnim, violationLocked]);

  // Check for existing violation lock on mount
  useEffect(() => {
    if (!currentUser || !quiz) return;
    if (isQuizViolationLocked(currentUser.id, quiz.id)) {
      setViolationLocked(true);
      const remaining = getQuizLockRemaining(currentUser.id, quiz.id);
      setViolationLockRemaining(remaining);
    }
    const count = getViolationCount(currentUser.id, quiz.id);
    setViolationCount(count);
  }, [currentUser, quiz, isQuizViolationLocked, getQuizLockRemaining, getViolationCount]);

  // Remove pending quiz notification when student starts the quiz
  useEffect(() => {
    if (currentUser && loId) {
      void removePendingQuizNotification(currentUser.id, loId);
    }
  }, [currentUser, loId, removePendingQuizNotification]);

  // Violation lock countdown
  useEffect(() => {
    if (!violationLocked || !currentUser || !quiz) return;
    const updateLock = () => {
      const remaining = getQuizLockRemaining(currentUser.id, quiz.id);
      if (remaining <= 0) {
        setViolationLocked(false);
        setViolationLockRemaining(0);
        void clearQuizLock(currentUser.id, quiz.id);
      } else {
        setViolationLockRemaining(remaining);
      }
    };
    updateLock();
    const interval = setInterval(updateLock, 1000);
    return () => clearInterval(interval);
  }, [violationLocked, currentUser, quiz, getQuizLockRemaining, clearQuizLock]);

  // Web: visibilitychange + blur detection
  useEffect(() => {
    if (!quiz || showResults || violationLocked || Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) recordViolation('tab_switch');
    };
    const handleBlur = () => recordViolation('window_blur');
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!showResults && Object.keys(answers).length > 0) {
        e.preventDefault();
        e.returnValue = '';
        recordViolation('window_exit');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [quiz, showResults, violationLocked, answers, recordViolation]);

  // Mobile: AppState detection
  useEffect(() => {
    if (!quiz || showResults || violationLocked || Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextState: string) => {
      if (appStateRef.current === 'active' && nextState !== 'active') {
        recordViolation('window_exit');
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [quiz, showResults, recordViolation]);

  const existingProgress = useMemo(() => {
    if (!currentUser || !lo) return null;
    return progress.find(p => p.userId === currentUser.id && p.loId === lo.id && p.subjectId === lo.subjectId);
  }, [currentUser, lo, progress]);

  useEffect(() => {
    if (quiz?.timeLimit && timeRemaining === null) {
      setTimeRemaining(quiz.timeLimit * 60);
    }

    if (timeRemaining !== null && timeRemaining > 0 && !showResults) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            doSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining, showResults, quiz?.timeLimit]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser || !lo) return;
    
    const unanswered = quizQuestions.filter(q => answers[q.id] === undefined).length;
    if (unanswered > 0 && !showResults) {
      Alert.alert(
        'Unanswered Questions',
        `You have ${unanswered} unanswered question(s). Do you want to submit anyway?`,
        [
          { text: 'Review', style: 'cancel' },
          { text: 'Submit', onPress: () => doSubmit() }
        ]
      );
      return;
    }
    
    await doSubmit();
  };

  const doSubmit = async () => {
    if (!currentUser || !lo) return;
    const elapsed = Date.now() - quizStartTime.current;
    setIsSubmitting(true);
    try {
      const quizResult = await submitQuiz(currentUser.id, loId ?? '', lo.subjectId, answers, elapsed);
      // Remove pending quiz notification after submission
      await removePendingQuizNotification(currentUser.id, loId ?? '');
      setResult(quizResult);
      setShowResults(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getResultMessage = useCallback(() => {
    if (!result || !quiz) return { title: '', message: '' };
    const scoreText = `${result.score}/${result.total}`;
    
    if (isSequential) {
      if (result.passed) {
        return {
          title: 'Congratulations!',
          message: `Congratulations! You've obtained a ${scoreText}. Nakuha mo ang ${quiz.passingScore}% Passing Score. Keep up the good work! ☺`,
        };
      } else {
        const attempts = (existingProgress?.attempts ?? 0) + 1;
        if (attempts % 3 === 0) {
          return {
            title: 'Review Time',
            message: `You still need to improve. You have 10 minutes to review the topic again.`,
          };
        }
        return {
          title: 'Keep Going!',
          message: `You have obtained a ${scoreText}, even if you did not meet the passing score, you can still get it.`,
        };
      }
    } else {
      if (result.passed) {
        return {
          title: 'Congratulations!',
          message: `Congratulations! You've obtained a ${scoreText}. Nakuha mo ang ${quiz.passingScore}% Passing Score. Keep up the good work! ☺`,
        };
      } else {
        return {
          title: 'Quiz Completed',
          message: `You have obtained a ${scoreText}, even if you did not meet the passing score, you can still get it.`,
        };
      }
    }
  }, [result, isSequential, existingProgress, quiz]);

  const currentQuestion = quizQuestions[currentQuestionIndex];

  const isQuizLocked = useMemo(() => {
    if (!currentUser || !lo) return false;
    if (isFlexible && existingProgress && existingProgress.attempts > 0) return true;
    if (isSequential && existingProgress?.passed) return true;
    return false;
  }, [currentUser, lo, isFlexible, isSequential, existingProgress]);

  const cooldownMs = useMemo(() => {
    if (!currentUser || !loId) return 0;
    return getCooldownRemaining(currentUser.id, loId);
  }, [currentUser, loId, getCooldownRemaining]);

  const [cooldownDisplay, setCooldownDisplay] = useState<string>('');

  useEffect(() => {
    if (cooldownMs <= 0) {
      setCooldownDisplay('');
      return;
    }
    const updateCooldown = () => {
      const remaining = getCooldownRemaining(currentUser?.id ?? '', loId ?? '');
      if (remaining <= 0) {
        setCooldownDisplay('');
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCooldownDisplay(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [cooldownMs, currentUser, loId, getCooldownRemaining]);

  const lessonCompleted = useMemo(() => {
    if (!currentUser || !lo) return false;
    return isLessonMarkedDone(currentUser.id, lo.id, lo.subjectId);
  }, [currentUser, lo, isLessonMarkedDone]);

  const quizGateUnlocked = useMemo(() => {
    if (!currentUser || !lo) return false;
    return isQuizUnlocked(currentUser.id, lo.id, lo.subjectId);
  }, [currentUser, lo, isQuizUnlocked]);

  // === Scheduled Quiz Access (Flexible Subjects Only) ===
  const quizSchedule = useMemo(() => {
    if (!quiz) return undefined;
    return getQuizSchedule(quiz.id);
  }, [quiz, getQuizSchedule]);

  const quizScheduleStatus = useMemo<QuizScheduleStatus>(() => {
    if (!quiz) return 'available';
    return getQuizScheduleStatus(quiz.id);
  }, [quiz, getQuizScheduleStatus]);

  const quizScheduleAccessible = useMemo(() => {
    if (!quiz) return true;
    return isQuizAccessible(quiz.id);
  }, [quiz, isQuizAccessible]);

  // Live countdown for upcoming quizzes
  const [scheduleCountdown, setScheduleCountdown] = useState<string>('');
  const [scheduleEndCountdown, setScheduleEndCountdown] = useState<string>('');

  useEffect(() => {
    if (!quiz || quizScheduleStatus !== 'upcoming') {
      setScheduleCountdown('');
      return;
    }
    const updateCountdown = () => {
      const ms = getQuizTimeUntilStart(quiz.id);
      if (ms <= 0) {
        setScheduleCountdown('');
        return;
      }
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      if (days > 0) {
        setScheduleCountdown(`${days}d ${hours}h ${mins}m`);
      } else if (hours > 0) {
        setScheduleCountdown(`${hours}h ${mins}m ${secs}s`);
      } else {
        setScheduleCountdown(`${mins}m ${secs}s`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [quiz, quizScheduleStatus, getQuizTimeUntilStart]);

  // Live countdown for end time when quiz is available
  useEffect(() => {
    if (!quiz || quizScheduleStatus !== 'available' || !quizSchedule) {
      setScheduleEndCountdown('');
      return;
    }
    const updateEndCountdown = () => {
      const ms = getQuizTimeUntilEnd(quiz.id);
      if (ms <= 0) {
        setScheduleEndCountdown('');
        return;
      }
      const hours = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setScheduleEndCountdown(`${hours}h ${mins}m ${secs}s`);
    };
    updateEndCountdown();
    const interval = setInterval(updateEndCountdown, 1000);
    return () => clearInterval(interval);
  }, [quiz, quizScheduleStatus, quizSchedule, getQuizTimeUntilEnd]);

  const formatScheduleDateTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderScheduleBadge = (status: QuizScheduleStatus) => {
    const config = {
      upcoming: { icon: Calendar, color: Colors.accent, bg: Colors.accent + '20', label: 'Upcoming' },
      available: { icon: CalendarClock, color: Colors.success, bg: Colors.success + '20', label: 'Available' },
      closed: { icon: CalendarX, color: Colors.error, bg: Colors.error + '20', label: 'Closed' },
    };
    const cfg = config[status];
    const Icon = cfg.icon;
    return (
      <View style={[styles.scheduleBadge, { backgroundColor: cfg.bg }]}>
        <Icon size={12} color={cfg.color} />
        <Text style={[styles.scheduleBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    );
  };

  // === Scheduled Quiz Access Gate (Flexible Subjects Only) ===
  if (isFlexible && quizSchedule && !quizScheduleAccessible && !showResults && quizGateUnlocked) {
    if (quizScheduleStatus === 'upcoming') {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.resultsContainer}>
            {renderScheduleBadge('upcoming')}
            <View style={[styles.resultIcon, { backgroundColor: Colors.accent }]}>
              <Calendar size={48} color="#FFF" />
            </View>
            <Text style={styles.resultTitle}>Quiz Opens Soon</Text>
            <Text style={styles.resultMessage}>
              This quiz is scheduled to open at{'\n'}{formatScheduleDateTime(quizSchedule.startDateTime)}
            </Text>
            <View style={styles.countdownCard}>
              <Timer size={20} color={Colors.accent} />
              <Text style={styles.countdownLabel}>Opens in</Text>
              <Text style={styles.countdownTimer}>{scheduleCountdown}</Text>
            </View>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Back to Lesson</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    if (quizScheduleStatus === 'closed') {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.resultsContainer}>
            {renderScheduleBadge('closed')}
            <View style={[styles.resultIcon, { backgroundColor: Colors.error }]}>
              <CalendarX size={48} color="#FFF" />
            </View>
            <Text style={styles.resultTitle}>Quiz Closed</Text>
            <Text style={styles.resultMessage}>
              This quiz closed on{'\n'}{formatScheduleDateTime(quizSchedule.endDateTime)}
            </Text>
            {existingProgress && (
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Your Score</Text>
                <Text style={[styles.scoreValue, existingProgress.passed ? styles.scorePassed : styles.scoreFailed]}>
                  {existingProgress.score}/{existingProgress.totalItems ?? 20}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Back to Lesson</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
  }

  // === Quiz Auto-Lock Screen (after 3 violations) ===
  if (violationLocked && !showResults && currentUser && quiz) {
    const lockInfo = getQuizLock(currentUser.id, quiz.id);
    const mins = Math.floor(violationLockRemaining / 60000);
    const secs = Math.floor((violationLockRemaining % 60000) / 1000);
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.resultsContainer}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.error }]}>
            <ShieldAlert size={48} color="#FFF" />
          </View>
          <Text style={styles.resultTitle}>Quiz Locked</Text>
          <Text style={styles.resultMessage}>
            You exceeded 3 violation warnings. The quiz has been locked for 10 minutes to prevent cheating.
          </Text>
          <View style={styles.cooldownCard}>
            <ShieldAlert size={20} color={Colors.error} />
            <Text style={styles.cooldownLabel}>Time Remaining</Text>
            <Text style={[styles.cooldownTimer, { color: Colors.error }]}>
              {mins}:{secs.toString().padStart(2, '0')}
            </Text>
          </View>
          {lockInfo && (
            <Text style={styles.violationLockCount}>
              Violations detected: {lockInfo.violationCount}
            </Text>
          )}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to Lesson</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!quizGateUnlocked && !showResults) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.resultsContainer}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.locked }]}>
            <Lock size={48} color="#FFF" />
          </View>
          <Text style={styles.resultTitle}>Quiz Locked</Text>
          <Text style={styles.resultMessage}>
            Please mark the lesson as done before taking the quiz.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to Lesson</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isQuizLocked && !showResults) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.resultsContainer}>
          <View style={[styles.resultIcon, existingProgress?.passed ? styles.resultIconPassed : styles.resultIconFailed]}>
            {existingProgress?.passed ? <CheckCircle size={48} color="#FFF" /> : <AlertTriangle size={48} color="#FFF" />}
          </View>
          <Text style={styles.resultTitle}>{isFlexible ? 'Quiz Locked' : 'Quiz Passed'}</Text>
          <Text style={styles.resultMessage}>
            {isFlexible
              ? 'In flexible mode, you can only take this quiz once. Your score is saved.'
              : 'You have already passed this quiz. Great job!'}
          </Text>
          {existingProgress && (
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Your Score</Text>
              <Text style={[styles.scoreValue, existingProgress.passed ? styles.scorePassed : styles.scoreFailed]}>
                {existingProgress.score}/{existingProgress.totalItems ?? 20}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (cooldownDisplay && !showResults) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.resultsContainer}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.warning }]}>
            <Clock size={48} color="#FFF" />
          </View>
          <Text style={styles.resultTitle}>Cooldown Active</Text>
          <Text style={styles.resultMessage}>
            You still need to improve. Please review the topic and try again after the cooldown.
          </Text>
          <View style={styles.cooldownCard}>
            <Text style={styles.cooldownLabel}>Time Remaining</Text>
            <Text style={styles.cooldownTimer}>{cooldownDisplay}</Text>
          </View>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!quiz || quizQuestions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Quiz not available</Text>
          <TouchableOpacity style={styles.backButtonAlt} onPress={() => router.back()}>
            <Text style={styles.backButtonAltText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showResults && result) {
    const resultMsg = getResultMessage();
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.resultsContainer}>
          <View style={[styles.resultIcon, result.passed ? styles.resultIconPassed : styles.resultIconFailed]}>
            {result.passed ? (
              <CheckCircle size={48} color="#FFF" />
            ) : (
              <XCircle size={48} color="#FFF" />
            )}
          </View>
          
          <Text style={styles.resultTitle}>{resultMsg.title}</Text>
          <Text style={styles.resultMessage}>{resultMsg.message}</Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Your Score</Text>
            <Text style={[styles.scoreValue, result.passed ? styles.scorePassed : styles.scoreFailed]}>
              {result.score}/{result.total}
            </Text>
            <Text style={styles.scorePercent}>{Math.round(result.percentage)}%</Text>
            <Text style={styles.passingScore}>Passing: {quiz.passingScore}%</Text>
          </View>

          {isFlexible && (
            <View style={styles.flexibleNote}>
              <AlertTriangle size={16} color={Colors.warning} />
              <Text style={styles.flexibleNoteText}>
                Flexible mode: This quiz is now locked. No re-attempts allowed.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back to Learning Outcome</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Alert.alert('Leave Quiz', 'Are you sure? Your progress will be lost.', [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => router.back() },
          ]);
        }} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Quiz</Text>
          <Text style={styles.questionCounter}>
            Question {currentQuestionIndex + 1} of {quizQuestions.length}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {violationCount > 0 && (
            <View style={styles.violationIndicator}>
              <ShieldAlert size={14} color={Colors.warning} />
              <Text style={styles.violationIndicatorText}>{violationCount}</Text>
            </View>
          )}
          {timeRemaining !== null && (
            <View style={[styles.timer, timeRemaining < 60 && styles.timerWarning]}>
              <Clock size={16} color={timeRemaining < 60 ? Colors.error : Colors.text} />
              <Text style={[styles.timerText, timeRemaining < 60 && styles.timerTextWarning]}>
                {formatTime(timeRemaining)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }]} />
      </View>

      {/* Violation warning overlay */}
      {showViolationWarning && (
        <Animated.View
          style={[
            styles.violationWarning,
            {
              opacity: violationWarnAnim,
              transform: [{
                translateY: violationWarnAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 0],
                }),
              }],
            },
          ]}
        >
          <ShieldAlert size={22} color={Colors.warning} />
          <View style={styles.violationWarningText}>
            <Text style={styles.violationWarningTitle}>
              {lastViolationType === 'tab_switch' ? 'Tab Switch Detected'
                : lastViolationType === 'window_blur' ? 'Window Lost Focus'
                : 'Left Quiz Window'}
            </Text>
            <Text style={styles.violationWarningMsg}>
              Your teacher has been notified. Violation #{violationCount}{violationCount >= 3 ? ' — Quiz locked!' : ` of 3`}
            </Text>
          </View>
        </Animated.View>
      )}

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {currentQuestion && (
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>

            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    answers[currentQuestion.id] === index && styles.optionSelected
                  ]}
                  onPress={() => handleSelectAnswer(currentQuestion.id, index)}
                >
                  <View style={[
                    styles.optionCircle,
                    answers[currentQuestion.id] === index && styles.optionCircleSelected
                  ]}>
                    <Text style={[
                      styles.optionLetter,
                      answers[currentQuestion.id] === index && styles.optionLetterSelected
                    ]}>
                      {String.fromCharCode(65 + index)}
                    </Text>
                  </View>
                  <Text style={[
                    styles.optionText,
                    answers[currentQuestion.id] === index && styles.optionTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, currentQuestionIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          <Text style={[styles.navButtonText, currentQuestionIndex === 0 && styles.navButtonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        {currentQuestionIndex < quizQuestions.length - 1 ? (
          <TouchableOpacity
            style={styles.navButton}
            onPress={handleNext}
          >
            <Text style={styles.navButtonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Quiz</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.navigator}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {quizQuestions.map((q, index) => (
            <TouchableOpacity
              key={q.id}
              style={[
                styles.navDot,
                index === currentQuestionIndex && styles.navDotActive,
                answers[q.id] !== undefined && styles.navDotAnswered
              ]}
              onPress={() => setCurrentQuestionIndex(index)}
            >
              <Text style={[
                styles.navDotText,
                index === currentQuestionIndex && styles.navDotTextActive
              ]}>
                {index + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  questionCounter: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  headerRight: { minWidth: 60, alignItems: 'flex-end' as const },
  timer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  timerWarning: { backgroundColor: Colors.error + '15' },
  timerText: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  timerTextWarning: { color: Colors.error },
  progressBarContainer: { height: 4, backgroundColor: Colors.border, marginHorizontal: 20, borderRadius: 2, marginBottom: 20 },
  progressBar: { height: '100%' as const, backgroundColor: Colors.primary, borderRadius: 2 },
  scrollArea: { flex: 1, paddingHorizontal: 20 },
  questionCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  questionText: { fontSize: 18, fontWeight: '600' as const, color: Colors.text, lineHeight: 26, marginBottom: 20 },
  optionsContainer: { gap: 12 },
  optionButton: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.surfaceLight, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  optionCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: Colors.border },
  optionCircleSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionLetter: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  optionLetterSelected: { color: '#000' },
  optionText: { flex: 1, fontSize: 15, color: Colors.text },
  optionTextSelected: { fontWeight: '500' as const },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, gap: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  navButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  navButtonDisabled: { opacity: 0.5 },
  navButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  navButtonTextDisabled: { color: Colors.textMuted },
  submitButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { fontSize: 15, fontWeight: '700' as const, color: '#000' },
  navigator: { paddingHorizontal: 20, paddingBottom: 20 },
  navDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  navDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  navDotAnswered: { backgroundColor: Colors.success + '20', borderColor: Colors.success },
  navDotText: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },
  navDotTextActive: { color: '#000', fontWeight: '700' as const },
  resultsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  resultIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  resultIconPassed: { backgroundColor: Colors.success },
  resultIconFailed: { backgroundColor: Colors.error },
  resultTitle: { fontSize: 28, fontWeight: '700' as const, color: Colors.text, marginBottom: 12 },
  resultMessage: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' as const, lineHeight: 24, marginBottom: 30 },
  scoreCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 30, alignItems: 'center', width: '100%' as const, borderWidth: 1, borderColor: Colors.border },
  scoreLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  scoreValue: { fontSize: 48, fontWeight: '800' as const, marginBottom: 4 },
  scorePassed: { color: Colors.success },
  scoreFailed: { color: Colors.error },
  scorePercent: { fontSize: 20, fontWeight: '600' as const, color: Colors.text },
  passingScore: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  flexibleNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warning + '15', padding: 14, borderRadius: 10, marginTop: 20, width: '100%' as const },
  flexibleNoteText: { fontSize: 13, color: Colors.warning, flex: 1 },
  backButton: { marginTop: 30, backgroundColor: Colors.primary, paddingHorizontal: 40, paddingVertical: 16, borderRadius: 12 },
  backButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#000' },
  backButtonAlt: { marginTop: 20, backgroundColor: Colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  backButtonAltText: { fontSize: 14, fontWeight: '600' as const, color: '#000' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: Colors.textMuted },
  cooldownCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 30, alignItems: 'center', width: '100%' as const, borderWidth: 1, borderColor: Colors.border, marginTop: 20 },
  cooldownLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  cooldownTimer: { fontSize: 48, fontWeight: '800' as const, color: Colors.warning },
  scheduleBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, marginBottom: 16 },
  scheduleBadgeText: { fontSize: 12, fontWeight: '700' as const },
  countdownCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: Colors.surface, borderRadius: 16, padding: 24, width: '100%' as const, borderWidth: 1, borderColor: Colors.border, marginTop: 20 },
  countdownLabel: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  countdownTimer: { fontSize: 28, fontWeight: '800' as const, color: Colors.accent },
  violationIndicator: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, backgroundColor: Colors.warningSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginRight: 6 },
  violationIndicatorText: { fontSize: 12, fontWeight: '700' as const, color: Colors.warning },
  violationWarning: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: 'rgba(255,217,61,0.95)', paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 16, borderRadius: 14, marginTop: 4, marginBottom: 8 },
  violationWarningText: { flex: 1 },
  violationWarningTitle: { fontSize: 14, fontWeight: '800' as const, color: '#1A1A00' },
  violationWarningMsg: { fontSize: 12, color: '#4A4A00', marginTop: 2 },
  violationLockCount: { fontSize: 13, color: Colors.textMuted, marginTop: 12 },
});
