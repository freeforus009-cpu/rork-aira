import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  COC, LearningOutcome, Content, Quiz, Question, StudentProgress, Submission,
  LOStatus, QuizResult, Subject, Announcement, AdminProgressCheck, AnnouncementTargetType,
  Activity, QuizAttempt, Quarter, AnnouncementScope, GradeLevel,
  ContentType, VideoMetadata, QuizSchedule, QuizScheduleStatus,
  QuizViolation, QuizViolationType, DocumentProgress, QuizLock,
  AppNotification, NotificationType, UserActivityLog, QuizDisplayStatus,
} from '@/types';
import { useAuth } from './AuthContext';
import { generateId, getDefaultCOCs, getDefaultLOs, getDefaultContents, getDefaultQuizzes, getDefaultQuestions } from '@/mocks/data';
import { openCloudRealtime, pullCloudScope, pushCloudScope } from '@/services/cloudSync';
import { enqueueSync } from '@/services/syncQueue';
import { useConnectivity } from './ConnectivityContext';

const COCS_KEY = 'aira_cocs_v4';
const LOS_KEY = 'aira_los_v4';
const CONTENTS_KEY = 'aira_contents_v4';
const QUIZZES_KEY = 'aira_quizzes_v4';
const QUESTIONS_KEY = 'aira_questions_v4';
const PROGRESS_KEY = 'aira_progress_v4';
const SUBMISSIONS_KEY = 'aira_submissions_v4';
const ACTIVE_SUBJECT_KEY = 'aira_active_subject';
const ANNOUNCEMENTS_KEY = 'aira_announcements';
const ADMIN_CHECKS_KEY = 'aira_admin_checks';
const DISMISSED_ANN_KEY = 'aira_dismissed_announcements';
const ACTIVITIES_KEY = 'aira_activities_v1';
const QUIZ_ATTEMPTS_KEY = 'aira_quiz_attempts_v1';
const QUIZ_VIOLATIONS_KEY = 'aira_quiz_violations_v1';
const DOC_PROGRESS_KEY = 'aira_doc_progress_v1';
const QUIZ_LOCKS_KEY = 'aira_quiz_locks_v1';
const NOTIFICATIONS_KEY = 'aira_notifications_v1';
const ACTIVITY_LOGS_KEY = 'aira_activity_logs_v1';

const MAX_ATTEMPTS_BEFORE_COOLDOWN = 3;
const COOLDOWN_MINUTES = 10;
type DataSnapshot = { cocs: COC[]; learningOutcomes: LearningOutcome[]; contents: Content[]; quizzes: Quiz[]; questions: Question[]; progress: StudentProgress[]; submissions: Submission[]; announcements: Announcement[]; adminChecks: AdminProgressCheck[]; activities: Activity[]; quizAttempts: QuizAttempt[]; dismissedAnnIds: string[]; quizViolations?: QuizViolation[]; docProgress?: DocumentProgress[] };

export const [DataProvider, useData] = createContextHook(() => {
  const { currentUser, subjects: authSubjects } = useAuth();
  const { isOnline } = useConnectivity();
  const queryClient = useQueryClient();

  const [cocs, setCocs] = useState<COC[]>([]);
  const [learningOutcomes, setLearningOutcomes] = useState<LearningOutcome[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<StudentProgress[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeSubjectId, setActiveSubjectIdState] = useState<string | null>(null);
  const [cloudDataReady, setCloudDataReady] = useState<boolean>(false);
  const cloudDataUserRef = useRef<string | null>(null);

  const cocsQuery = useQuery({
    queryKey: ['cocs_v4'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(COCS_KEY);
      if (stored) return JSON.parse(stored) as COC[];
      const defaults = getDefaultCOCs();
      await AsyncStorage.setItem(COCS_KEY, JSON.stringify(defaults));
      return defaults;
    },
  });

  const losQuery = useQuery({
    queryKey: ['los_v4'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(LOS_KEY);
      if (stored) return JSON.parse(stored) as LearningOutcome[];
      const defaults = getDefaultLOs();
      await AsyncStorage.setItem(LOS_KEY, JSON.stringify(defaults));
      return defaults;
    },
  });

  const contentsQuery = useQuery({
    queryKey: ['contents_v4'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(CONTENTS_KEY);
      if (stored) return JSON.parse(stored) as Content[];
      const defaults = getDefaultContents();
      await AsyncStorage.setItem(CONTENTS_KEY, JSON.stringify(defaults));
      return defaults;
    },
  });

  const quizzesQuery = useQuery({
    queryKey: ['quizzes_v4'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(QUIZZES_KEY);
      if (stored) return JSON.parse(stored) as Quiz[];
      const defaults = getDefaultQuizzes();
      await AsyncStorage.setItem(QUIZZES_KEY, JSON.stringify(defaults));
      return defaults;
    },
  });

  const questionsQuery = useQuery({
    queryKey: ['questions_v4'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(QUESTIONS_KEY);
      if (stored) return JSON.parse(stored) as Question[];
      const defaults = getDefaultQuestions();
      await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(defaults));
      return defaults;
    },
  });

  const progressQuery = useQuery({
    queryKey: ['progress_v4'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(PROGRESS_KEY);
      if (stored) return JSON.parse(stored) as StudentProgress[];
      return [] as StudentProgress[];
    },
  });

  const submissionsQuery = useQuery({
    queryKey: ['submissions_v4'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(SUBMISSIONS_KEY);
      if (stored) return JSON.parse(stored) as Submission[];
      return [] as Submission[];
    },
  });

  const activeSubjectQuery = useQuery({
    queryKey: ['activeSubject'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(ACTIVE_SUBJECT_KEY);
      return stored || null;
    },
  });

  const announcementsQuery = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(ANNOUNCEMENTS_KEY);
      if (stored) return JSON.parse(stored) as Announcement[];
      return [] as Announcement[];
    },
  });

  const adminChecksQuery = useQuery({
    queryKey: ['adminChecks'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(ADMIN_CHECKS_KEY);
      if (stored) return JSON.parse(stored) as AdminProgressCheck[];
      return [] as AdminProgressCheck[];
    },
  });

  useEffect(() => { if (cocsQuery.data) setCocs(cocsQuery.data); }, [cocsQuery.data]);
  useEffect(() => { if (losQuery.data) setLearningOutcomes(losQuery.data); }, [losQuery.data]);
  useEffect(() => { if (contentsQuery.data) setContents(contentsQuery.data); }, [contentsQuery.data]);
  useEffect(() => { if (quizzesQuery.data) setQuizzes(quizzesQuery.data); }, [quizzesQuery.data]);
  useEffect(() => { if (questionsQuery.data) setQuestions(questionsQuery.data); }, [questionsQuery.data]);
  useEffect(() => { if (progressQuery.data) setProgress(progressQuery.data); }, [progressQuery.data]);
  useEffect(() => { if (submissionsQuery.data) setSubmissions(submissionsQuery.data); }, [submissionsQuery.data]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [adminChecks, setAdminChecks] = useState<AdminProgressCheck[]>([]);
  const [dismissedAnnIds, setDismissedAnnIds] = useState<string[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [quizViolations, setQuizViolations] = useState<QuizViolation[]>([]);
  const [docProgress, setDocProgress] = useState<DocumentProgress[]>([]);
  const [quizLocks, setQuizLocks] = useState<QuizLock[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);

  const activitiesQuery = useQuery({
    queryKey: ['activities_v1'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(ACTIVITIES_KEY);
      if (stored) return JSON.parse(stored) as Activity[];
      return [] as Activity[];
    },
  });

  const quizAttemptsQuery = useQuery({
    queryKey: ['quiz_attempts_v1'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(QUIZ_ATTEMPTS_KEY);
      if (stored) return JSON.parse(stored) as QuizAttempt[];
      return [] as QuizAttempt[];
    },
  });

  const dismissedAnnQuery = useQuery({
    queryKey: ['dismissedAnnouncements'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(DISMISSED_ANN_KEY);
      if (stored) return JSON.parse(stored) as string[];
      return [] as string[];
    },
  });

  const quizViolationsQuery = useQuery({
    queryKey: ['quiz_violations_v1'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(QUIZ_VIOLATIONS_KEY);
      if (stored) return JSON.parse(stored) as QuizViolation[];
      return [] as QuizViolation[];
    },
  });

  const docProgressQuery = useQuery({
    queryKey: ['doc_progress_v1'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(DOC_PROGRESS_KEY);
      if (stored) return JSON.parse(stored) as DocumentProgress[];
      return [] as DocumentProgress[];
    },
  });

  const quizLocksQuery = useQuery({
    queryKey: ['quiz_locks_v1'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(QUIZ_LOCKS_KEY);
      if (stored) return JSON.parse(stored) as QuizLock[];
      return [] as QuizLock[];
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications_v1'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (stored) return JSON.parse(stored) as AppNotification[];
      return [] as AppNotification[];
    },
  });

  const activityLogsQuery = useQuery({
    queryKey: ['activity_logs_v1'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(ACTIVITY_LOGS_KEY);
      if (stored) return JSON.parse(stored) as UserActivityLog[];
      return [] as UserActivityLog[];
    },
  });

  useEffect(() => { if (dismissedAnnQuery.data) setDismissedAnnIds(dismissedAnnQuery.data); }, [dismissedAnnQuery.data]);
  useEffect(() => { if (activitiesQuery.data) setActivities(activitiesQuery.data); }, [activitiesQuery.data]);
  useEffect(() => { if (quizAttemptsQuery.data) setQuizAttempts(quizAttemptsQuery.data); }, [quizAttemptsQuery.data]);
  useEffect(() => { if (quizViolationsQuery.data) setQuizViolations(quizViolationsQuery.data); }, [quizViolationsQuery.data]);
  useEffect(() => { if (docProgressQuery.data) setDocProgress(docProgressQuery.data); }, [docProgressQuery.data]);
  useEffect(() => { if (quizLocksQuery.data) setQuizLocks(quizLocksQuery.data); }, [quizLocksQuery.data]);
  useEffect(() => { if (notificationsQuery.data) setNotifications(notificationsQuery.data); }, [notificationsQuery.data]);
  useEffect(() => { if (activityLogsQuery.data) setActivityLogs(activityLogsQuery.data); }, [activityLogsQuery.data]);

  useEffect(() => { if (activeSubjectQuery.data) setActiveSubjectIdState(activeSubjectQuery.data); }, [activeSubjectQuery.data]);
  useEffect(() => { if (announcementsQuery.data) setAnnouncements(announcementsQuery.data); }, [announcementsQuery.data]);
  useEffect(() => { if (adminChecksQuery.data) setAdminChecks(adminChecksQuery.data); }, [adminChecksQuery.data]);

  useEffect(() => {
    if (currentUser?.role === 'student' && authSubjects.length > 0 && !activeSubjectId) {
      const studentSubjectIds = currentUser.subjectIds || [];
      if (studentSubjectIds.length > 0) {
        setActiveSubjectId(studentSubjectIds[0]);
      }
    }
  }, [currentUser, authSubjects, activeSubjectId]);

  // Save helpers
  const saveCocs = useCallback(async (updated: COC[]) => {
    setCocs(updated);
    await AsyncStorage.setItem(COCS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['cocs_v4'], updated);
  }, [queryClient]);

  const saveLOs = useCallback(async (updated: LearningOutcome[]) => {
    setLearningOutcomes(updated);
    await AsyncStorage.setItem(LOS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['los_v4'], updated);
  }, [queryClient]);

  const saveContents = useCallback(async (updated: Content[]) => {
    setContents(updated);
    await AsyncStorage.setItem(CONTENTS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['contents_v4'], updated);
  }, [queryClient]);

  const saveQuizzes = useCallback(async (updated: Quiz[]) => {
    setQuizzes(updated);
    await AsyncStorage.setItem(QUIZZES_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['quizzes_v4'], updated);
  }, [queryClient]);

  const saveQuestions = useCallback(async (updated: Question[]) => {
    setQuestions(updated);
    await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['questions_v4'], updated);
  }, [queryClient]);

  const saveProgress = useCallback(async (updated: StudentProgress[]) => {
    setProgress(updated);
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['progress_v4'], updated);
  }, [queryClient]);

  const saveSubmissions = useCallback(async (updated: Submission[]) => {
    setSubmissions(updated);
    await AsyncStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['submissions_v4'], updated);
  }, [queryClient]);

  const setActiveSubjectId = useCallback(async (subjectId: string | null) => {
    setActiveSubjectIdState(subjectId);
    if (subjectId) {
      await AsyncStorage.setItem(ACTIVE_SUBJECT_KEY, subjectId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_SUBJECT_KEY);
    }
    queryClient.setQueryData(['activeSubject'], subjectId);
  }, [queryClient]);

  const saveAnnouncements = useCallback(async (updated: Announcement[]) => {
    setAnnouncements(updated);
    await AsyncStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['announcements'], updated);
  }, [queryClient]);

  const saveAdminChecks = useCallback(async (updated: AdminProgressCheck[]) => {
    setAdminChecks(updated);
    await AsyncStorage.setItem(ADMIN_CHECKS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['adminChecks'], updated);
  }, [queryClient]);

  const saveActivities = useCallback(async (updated: Activity[]) => {
    setActivities(updated);
    await AsyncStorage.setItem(ACTIVITIES_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['activities_v1'], updated);
  }, [queryClient]);

  const saveQuizAttempts = useCallback(async (updated: QuizAttempt[]) => {
    setQuizAttempts(updated);
    await AsyncStorage.setItem(QUIZ_ATTEMPTS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['quiz_attempts_v1'], updated);
  }, [queryClient]);

  const saveQuizViolations = useCallback(async (updated: QuizViolation[]) => {
    setQuizViolations(updated);
    await AsyncStorage.setItem(QUIZ_VIOLATIONS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['quiz_violations_v1'], updated);
  }, [queryClient]);

  const saveDocProgress = useCallback(async (updated: DocumentProgress[]) => {
    setDocProgress(updated);
    await AsyncStorage.setItem(DOC_PROGRESS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['doc_progress_v1'], updated);
  }, [queryClient]);

  const saveQuizLocks = useCallback(async (updated: QuizLock[]) => {
    setQuizLocks(updated);
    await AsyncStorage.setItem(QUIZ_LOCKS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['quiz_locks_v1'], updated);
  }, [queryClient]);

  const saveNotifications = useCallback(async (updated: AppNotification[]) => {
    setNotifications(updated);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['notifications_v1'], updated);
  }, [queryClient]);

  const saveActivityLogs = useCallback(async (updated: UserActivityLog[]) => {
    setActivityLogs(updated);
    await AsyncStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['activity_logs_v1'], updated);
  }, [queryClient]);

  useEffect(() => {
    if (!currentUser) {
      cloudDataUserRef.current = null;
      setCloudDataReady(false);
      return;
    }
    if (cloudDataUserRef.current === currentUser.id) return;
    cloudDataUserRef.current = currentUser.id;
    setCloudDataReady(false);
    let cancelled = false;
    void pullCloudScope<DataSnapshot>(currentUser.id, 'data').then(async snapshot => {
      if (cancelled || !snapshot) return;
      if (snapshot.cocs) await saveCocs(snapshot.cocs);
      if (snapshot.learningOutcomes) await saveLOs(snapshot.learningOutcomes);
      if (snapshot.contents) await saveContents(snapshot.contents);
      if (snapshot.quizzes) await saveQuizzes(snapshot.quizzes);
      if (snapshot.questions) await saveQuestions(snapshot.questions);
      if (snapshot.progress) await saveProgress(snapshot.progress);
      if (snapshot.submissions) await saveSubmissions(snapshot.submissions);
      if (snapshot.announcements) await saveAnnouncements(snapshot.announcements);
      if (snapshot.adminChecks) await saveAdminChecks(snapshot.adminChecks);
      if (snapshot.activities) await saveActivities(snapshot.activities);
      if (snapshot.quizAttempts) await saveQuizAttempts(snapshot.quizAttempts);
      if (snapshot.dismissedAnnIds) {
        setDismissedAnnIds(snapshot.dismissedAnnIds);
        await AsyncStorage.setItem(DISMISSED_ANN_KEY, JSON.stringify(snapshot.dismissedAnnIds));
      }
    }).catch(() => undefined).finally(() => {
      if (!cancelled) setCloudDataReady(true);
    });
    return () => { cancelled = true; };
  }, [currentUser, saveCocs, saveLOs, saveContents, saveQuizzes, saveQuestions, saveProgress, saveSubmissions, saveAnnouncements, saveAdminChecks, saveActivities, saveQuizAttempts]);

  const cloudSnapshot: DataSnapshot = useMemo(() => ({ cocs, learningOutcomes, contents, quizzes, questions, progress, submissions, announcements, adminChecks, activities, quizAttempts, dismissedAnnIds }), [cocs, learningOutcomes, contents, quizzes, questions, progress, submissions, announcements, adminChecks, activities, quizAttempts, dismissedAnnIds]);

  useEffect(() => {
    if (!currentUser || !cloudDataReady) return;
    void pushCloudScope(currentUser.id, 'data', cloudSnapshot).catch(() => undefined);
  }, [currentUser?.id, cloudDataReady, cloudSnapshot]);

  useEffect(() => {
    if (!currentUser || !cloudDataReady) return;
    let socket: WebSocket | null = null;
    let cancelled = false;
    void openCloudRealtime(currentUser.id, 'data', (incoming, revision) => {
      if (cancelled || !incoming || typeof incoming !== 'object') return;
      const snapshot = incoming as DataSnapshot;
      if (snapshot.cocs) setCocs(snapshot.cocs);
      if (snapshot.learningOutcomes) setLearningOutcomes(snapshot.learningOutcomes);
      if (snapshot.contents) setContents(snapshot.contents);
      if (snapshot.quizzes) setQuizzes(snapshot.quizzes);
      if (snapshot.questions) setQuestions(snapshot.questions);
      if (snapshot.progress) setProgress(snapshot.progress);
      if (snapshot.submissions) setSubmissions(snapshot.submissions);
      if (snapshot.announcements) setAnnouncements(snapshot.announcements);
      if (snapshot.adminChecks) setAdminChecks(snapshot.adminChecks);
      if (snapshot.activities) setActivities(snapshot.activities);
      if (snapshot.quizAttempts) setQuizAttempts(snapshot.quizAttempts);
      void AsyncStorage.setItem('aira_cloud_revision_data', String(revision));
    }).then(result => { if (!cancelled) socket = result; }).catch(() => undefined);
    return () => { cancelled = true; socket?.close(); };
  }, [currentUser?.id, cloudDataReady]);

  /**
   * Manually pull the latest data snapshot from the cloud and refresh
   * all local state + React Query caches. Returns true on success.
   * When offline or no session, falls back to refetching local queries.
   */
  const refreshFromCloud = useCallback(async (): Promise<boolean> => {
    if (!currentUser) {
      // Still refetch local queries even without a user
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['cocs_v4'] }),
        queryClient.refetchQueries({ queryKey: ['los_v4'] }),
        queryClient.refetchQueries({ queryKey: ['contents_v4'] }),
        queryClient.refetchQueries({ queryKey: ['quizzes_v4'] }),
        queryClient.refetchQueries({ queryKey: ['questions_v4'] }),
        queryClient.refetchQueries({ queryKey: ['progress_v4'] }),
        queryClient.refetchQueries({ queryKey: ['submissions_v4'] }),
        queryClient.refetchQueries({ queryKey: ['announcements'] }),
        queryClient.refetchQueries({ queryKey: ['activities_v1'] }),
        queryClient.refetchQueries({ queryKey: ['quiz_attempts_v1'] }),
        queryClient.refetchQueries({ queryKey: ['notifications_v1'] }),
      ]);
      return true;
    }

    // Invalidate AuthContext queries so users/subjects/sections refresh
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['users'] }),
      queryClient.refetchQueries({ queryKey: ['subjects'] }),
      queryClient.refetchQueries({ queryKey: ['sections'] }),
      queryClient.refetchQueries({ queryKey: ['announcements'] }),
    ]);

    // Try pulling from cloud
    try {
      const snapshot = await pullCloudScope<DataSnapshot>(currentUser.id, 'data');
      if (snapshot) {
        if (snapshot.cocs) await saveCocs(snapshot.cocs);
        if (snapshot.learningOutcomes) await saveLOs(snapshot.learningOutcomes);
        if (snapshot.contents) await saveContents(snapshot.contents);
        if (snapshot.quizzes) await saveQuizzes(snapshot.quizzes);
        if (snapshot.questions) await saveQuestions(snapshot.questions);
        if (snapshot.progress) await saveProgress(snapshot.progress);
        if (snapshot.submissions) await saveSubmissions(snapshot.submissions);
        if (snapshot.announcements) await saveAnnouncements(snapshot.announcements);
        if (snapshot.adminChecks) await saveAdminChecks(snapshot.adminChecks);
        if (snapshot.activities) await saveActivities(snapshot.activities);
        if (snapshot.quizAttempts) await saveQuizAttempts(snapshot.quizAttempts);
        if (snapshot.dismissedAnnIds) {
          setDismissedAnnIds(snapshot.dismissedAnnIds);
          await AsyncStorage.setItem(DISMISSED_ANN_KEY, JSON.stringify(snapshot.dismissedAnnIds));
        }
      } else {
        // No cloud session — refetch local queries
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['cocs_v4'] }),
          queryClient.refetchQueries({ queryKey: ['los_v4'] }),
          queryClient.refetchQueries({ queryKey: ['contents_v4'] }),
          queryClient.refetchQueries({ queryKey: ['quizzes_v4'] }),
          queryClient.refetchQueries({ queryKey: ['questions_v4'] }),
          queryClient.refetchQueries({ queryKey: ['progress_v4'] }),
          queryClient.refetchQueries({ queryKey: ['submissions_v4'] }),
          queryClient.refetchQueries({ queryKey: ['activities_v1'] }),
          queryClient.refetchQueries({ queryKey: ['quiz_attempts_v1'] }),
          queryClient.refetchQueries({ queryKey: ['notifications_v1'] }),
        ]);
      }
      return true;
    } catch (error) {
      console.log('[DataContext] refreshFromCloud failed, refetching local');
      // Fallback: refetch local queries even if cloud pull fails
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['cocs_v4'] }),
        queryClient.refetchQueries({ queryKey: ['los_v4'] }),
        queryClient.refetchQueries({ queryKey: ['contents_v4'] }),
        queryClient.refetchQueries({ queryKey: ['quizzes_v4'] }),
        queryClient.refetchQueries({ queryKey: ['questions_v4'] }),
        queryClient.refetchQueries({ queryKey: ['progress_v4'] }),
        queryClient.refetchQueries({ queryKey: ['submissions_v4'] }),
      ]);
      return false;
    }
  }, [currentUser, queryClient, saveCocs, saveLOs, saveContents, saveQuizzes, saveQuestions, saveProgress, saveSubmissions, saveAnnouncements, saveAdminChecks, saveActivities, saveQuizAttempts]);

  const canManageSubject = useCallback((subjectId: string): boolean => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) return false;
    if (currentUser.role === 'super_admin') return true;
    const subject = authSubjects.find(item => item.id === subjectId);
    return Boolean(subject && subject.adminId === currentUser.id && subject.subjectType !== 'global' && subject.subjectType !== 'generic' && !subject.isGlobal);
  }, [currentUser, authSubjects]);

  const assertCanManageSubject = useCallback((subjectId: string): void => {
    if (!canManageSubject(subjectId)) throw new Error('This is a read-only master subject. Adopt it to create an editable copy.');
  }, [canManageSubject]);

  // === GETTERS ===

  const getSubjectCOCs = useCallback((subjectId: string) => {
    return cocs
      .filter(c => c.subjectId === subjectId && !c.archived)
      .sort((a, b) => a.order - b.order);
  }, [cocs]);

  const getCOCLOs = useCallback((cocId: string) => {
    return learningOutcomes
      .filter(lo => lo.cocId === cocId && !lo.archived)
      .sort((a, b) => a.order - b.order);
  }, [learningOutcomes]);

  const getSubjectLOs = useCallback((subjectId: string) => {
    const subjectCOCs = getSubjectCOCs(subjectId);
    const allLOs: LearningOutcome[] = [];
    subjectCOCs.forEach(coc => {
      const cocLOs = getCOCLOs(coc.id);
      allLOs.push(...cocLOs);
    });
    return allLOs;
  }, [getSubjectCOCs, getCOCLOs]);

  const getLOContents = useCallback((loId: string) => {
    return contents
      .filter(c => c.loId === loId && !c.archived)
      .sort((a, b) => a.order - b.order);
  }, [contents]);

  const getLOQuiz = useCallback((loId: string) => {
    return quizzes.find(q => q.loId === loId && !q.archived);
  }, [quizzes]);

  const getQuizQuestions = useCallback((quizId: string) => {
    return questions
      .filter(q => q.quizId === quizId && !q.archived)
      .sort((a, b) => a.order - b.order);
  }, [questions]);

  // === STATUS & UNLOCKING ===

  const getLOStatus = useCallback((userId: string, loId: string, subject: Subject): LOStatus => {
    const lo = learningOutcomes.find(l => l.id === loId);
    if (!lo) return 'locked';

    const loProg = progress.find(p => p.userId === userId && p.loId === loId && p.subjectId === subject.id);
    if (loProg?.passed) return 'completed';

    if (subject.unlockType === 'sequential') {
      const subjectCOCsList = getSubjectCOCs(subject.id);
      const allLOs: LearningOutcome[] = [];
      subjectCOCsList.forEach(coc => {
        const cocLOs = getCOCLOs(coc.id);
        allLOs.push(...cocLOs);
      });

      const loIndex = allLOs.findIndex(l => l.id === loId);
      if (loIndex === 0) {
        return loProg ? 'in_progress' : 'available';
      }

      const prevLO = allLOs[loIndex - 1];
      if (!prevLO) return 'locked';

      const prevProg = progress.find(p => p.userId === userId && p.loId === prevLO.id && p.subjectId === subject.id);
      if (!prevProg?.passed) return 'locked';

      return loProg ? 'in_progress' : 'available';
    }

    return loProg ? 'in_progress' : 'available';
  }, [learningOutcomes, progress, getSubjectCOCs, getCOCLOs]);

  const isLOLocked = useCallback((userId: string, loId: string, subject: Subject): boolean => {
    return getLOStatus(userId, loId, subject) === 'locked';
  }, [getLOStatus]);

  const isLOCompleted = useCallback((userId: string, loId: string, subjectId: string): boolean => {
    const loProg = progress.find(p => p.userId === userId && p.loId === loId && p.subjectId === subjectId);
    return loProg?.passed || false;
  }, [progress]);

  const isLessonMarkedDone = useCallback((userId: string, loId: string, subjectId: string): boolean => {
    const loProg = progress.find(p => p.userId === userId && p.loId === loId && p.subjectId === subjectId);
    return loProg?.lessonMarkedDone || false;
  }, [progress]);

  const markLessonDone = useCallback(async (userId: string, loId: string, subjectId: string): Promise<void> => {
    const lo = learningOutcomes.find(l => l.id === loId);
    const cocId = lo?.cocId ?? '';
    const existing = progress.find(p => p.userId === userId && p.loId === loId && p.subjectId === subjectId);
    const now = new Date().toISOString();
    const updatedProg: StudentProgress = existing
      ? { ...existing, lessonMarkedDone: true, lessonDoneAt: now, lessonUndoneAt: undefined }
      : {
          userId, loId, cocId, subjectId,
          score: 0, passed: false, attempts: 0,
          status: 'available',
          lessonMarkedDone: true, lessonDoneAt: now,
        };
    const updated = existing
      ? progress.map(p => (p.userId === userId && p.loId === loId && p.subjectId === subjectId) ? updatedProg : p)
      : [...progress, updatedProg];
    await saveProgress(updated);
    await enqueueSync('progress', 'update', `${userId}_${loId}_${subjectId}`, updatedProg);
    console.log('[Data] Lesson marked done:', loId, 'by user', userId);
  }, [learningOutcomes, progress, saveProgress]);

  const markLessonUndone = useCallback(async (userId: string, loId: string, subjectId: string): Promise<void> => {
    const existing = progress.find(p => p.userId === userId && p.loId === loId && p.subjectId === subjectId);
    if (!existing) return;
    const now = new Date().toISOString();
    const updatedProg: StudentProgress = {
      ...existing,
      lessonMarkedDone: false,
      lessonDoneAt: undefined,
      lessonUndoneAt: now,
    };
    const updated = progress.map(p => (p.userId === userId && p.loId === loId && p.subjectId === subjectId) ? updatedProg : p);
    await saveProgress(updated);
    await enqueueSync('progress', 'update', `${userId}_${loId}_${subjectId}`, updatedProg);
    console.log('[Data] Lesson marked undone:', loId, 'by user', userId);
  }, [progress, saveProgress]);

  const isQuizUnlocked = useCallback((userId: string, loId: string, subjectId: string): boolean => {
    return isLessonMarkedDone(userId, loId, subjectId);
  }, [isLessonMarkedDone]);

  // === QUIZ ===

  const getCooldownRemaining = useCallback((userId: string, loId: string): number => {
    const prog = progress.find(p => p.userId === userId && p.loId === loId);
    if (!prog || prog.passed) return 0;
    if (prog.attempts > 0 && prog.attempts % MAX_ATTEMPTS_BEFORE_COOLDOWN === 0 && prog.lastAttemptDate) {
      const lastAttempt = new Date(prog.lastAttemptDate).getTime();
      const cooldownEnd = lastAttempt + COOLDOWN_MINUTES * 60 * 1000;
      const remaining = cooldownEnd - Date.now();
      return remaining > 0 ? remaining : 0;
    }
    return 0;
  }, [progress]);

  const submitQuiz = useCallback(async (
    userId: string,
    loId: string,
    subjectId: string,
    answers: Record<string, number>,
    timeTakenMs?: number,
  ): Promise<QuizResult> => {
    const quiz = quizzes.find(q => q.loId === loId);
    if (!quiz) throw new Error('Quiz not found');

    const lo = learningOutcomes.find(l => l.id === loId);
    const cocId = lo?.cocId ?? '';

    const quizQs = getQuizQuestions(quiz.id);
    let correct = 0;
    for (const q of quizQs) {
      if (answers[q.id] === q.correctAnswer) correct++;
    }
    const total = quizQs.length;
    const percentage = total > 0 ? correct / total : 0;
    const passed = percentage >= (quiz.passingScore / 100);

    const existing = progress.find(p => p.userId === userId && p.loId === loId && p.subjectId === subjectId);
    const updatedProg: StudentProgress = {
      userId,
      loId,
      cocId,
      subjectId,
      score: correct,
      passed,
      attempts: (existing?.attempts ?? 0) + 1,
      lastAttemptDate: new Date().toISOString(),
      completionDate: passed ? new Date().toISOString() : existing?.completionDate,
      status: passed ? 'completed' : 'in_progress',
      totalItems: total,
    };

    const updated = existing
      ? progress.map(p => (p.userId === userId && p.loId === loId && p.subjectId === subjectId) ? updatedProg : p)
      : [...progress, updatedProg];

    await saveProgress(updated);

    const newAttempt: QuizAttempt = {
      id: generateId(),
      studentId: userId,
      quizId: quiz.id,
      loId,
      subjectId,
      score: correct,
      totalItems: total,
      attemptCount: updatedProg.attempts,
      isPassed: passed,
      createdAt: new Date().toISOString(),
      timeTakenMs: timeTakenMs,
      answers: { ...answers },
      reviewed: false,
    };
    await saveQuizAttempts([...quizAttempts, newAttempt]);

    return { score: correct, total, passed, percentage: percentage * 100 };
  }, [quizzes, learningOutcomes, progress, saveProgress, getQuizQuestions, quizAttempts, saveQuizAttempts]);

  // === SUBMISSIONS ===

  const getStudentSubmissions = useCallback((userId: string, subjectId?: string) => {
    if (subjectId) {
      return submissions.filter(s => s.userId === userId && s.subjectId === subjectId);
    }
    return submissions.filter(s => s.userId === userId);
  }, [submissions]);

  const getLOSubmissions = useCallback((userId: string, loId: string) => {
    return submissions.filter(s => s.userId === userId && s.loId === loId);
  }, [submissions]);

  const hasSubmissions = useCallback((userId: string, loId: string) => {
    return submissions.some(s => s.userId === userId && s.loId === loId);
  }, [submissions]);

  const isLOValidated = useCallback((userId: string, loId: string) => {
    const loSubs = submissions.filter(s => s.userId === userId && s.loId === loId);
    return loSubs.length > 0 && loSubs.every(s => s.validated);
  }, [submissions]);

  const addSubmission = useCallback(async (submission: Omit<Submission, 'id' | 'submittedAt' | 'validated' | 'validatedAt' | 'validatedBy'>) => {
    const newSub: Submission = {
      ...submission,
      id: generateId(),
      submittedAt: new Date().toISOString(),
      validated: false,
    };
    const updated = [...submissions, newSub];
    await saveSubmissions(updated);
  }, [submissions, saveSubmissions]);

  const deleteSubmission = useCallback(async (submissionId: string) => {
    const updated = submissions.filter(s => s.id !== submissionId);
    await saveSubmissions(updated);
  }, [submissions, saveSubmissions]);

  const validateSubmission = useCallback(async (submissionId: string, adminId: string) => {
    const updated = submissions.map(s =>
      s.id === submissionId ? {
        ...s,
        validated: true,
        validatedAt: new Date().toISOString(),
        validatedBy: adminId,
      } : s
    );
    await saveSubmissions(updated);
  }, [submissions, saveSubmissions]);

  const toggleValidation = useCallback(async (submissionId: string, adminId: string) => {
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return;
    const updated = submissions.map(s =>
      s.id === submissionId ? {
        ...s,
        validated: !s.validated,
        validatedAt: !s.validated ? new Date().toISOString() : undefined,
        validatedBy: !s.validated ? adminId : undefined,
      } : s
    );
    await saveSubmissions(updated);
  }, [submissions, saveSubmissions]);

  // === PROGRESS CALCULATIONS ===

  const getCOCProgress = useCallback((userId: string, cocId: string) => {
    const cocLOs = getCOCLOs(cocId);
    const completed = cocLOs.filter(lo => {
      const prog = progress.find(p => p.userId === userId && p.loId === lo.id);
      return prog?.passed;
    }).length;
    return {
      total: cocLOs.length,
      completed,
      percentage: cocLOs.length > 0 ? (completed / cocLOs.length) * 100 : 0,
    };
  }, [getCOCLOs, progress]);

  const getSubjectProgress = useCallback((userId: string, subjectId: string, _unlockType?: 'sequential' | 'flexible') => {
    const allLOs = getSubjectLOs(subjectId);
    const completed = allLOs.filter(lo => {
      const prog = progress.find(p => p.userId === userId && p.loId === lo.id && p.subjectId === subjectId);
      return prog?.passed;
    }).length;
    return {
      total: allLOs.length,
      completed,
      percentage: allLOs.length > 0 ? (completed / allLOs.length) * 100 : 0,
    };
  }, [getSubjectLOs, progress]);

  const getStudentProgress = useCallback((userId: string) => {
    return progress.filter(p => p.userId === userId);
  }, [progress]);

  const getOverallProgress = useCallback((userId: string) => {
    const allLOs = learningOutcomes.filter(lo => !lo.archived);
    const completed = allLOs.filter(lo => {
      const prog = progress.find(p => p.userId === userId && p.loId === lo.id);
      return prog?.passed;
    }).length;
    return {
      total: allLOs.length,
      completed,
      percentage: allLOs.length > 0 ? (completed / allLOs.length) * 100 : 0,
    };
  }, [learningOutcomes, progress]);

  const getStudentSubjectProgress = useCallback((userId: string, subjectId: string) => {
    return getSubjectProgress(userId, subjectId);
  }, [getSubjectProgress]);

  const getAdminProgressCheck = useCallback((userId: string, loId: string, subjectId: string) => {
    const prog = progress.find(p => p.userId === userId && p.loId === loId && p.subjectId === subjectId);
    return prog?.passed || false;
  }, [progress]);

  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  const getShuffledQuizQuestions = useCallback((quizId: string) => {
    const qs = questions.filter(q => q.quizId === quizId && !q.archived);
    return shuffleArray(qs).map(q => ({
      ...q,
      options: [...q.options],
    }));
  }, [questions, shuffleArray]);

  // === COC CRUD ===

  const addCOC = useCallback(async (subjectId: string, adminId: string, title: string, description: string) => {
    assertCanManageSubject(subjectId);
    const subjectCOCs = cocs.filter(c => c.subjectId === subjectId);
    const maxOrder = subjectCOCs.length > 0 ? Math.max(...subjectCOCs.map(c => c.order)) : 0;
    const newCOC: COC = {
      id: generateId(),
      subjectId,
      adminId,
      title,
      description,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    await saveCocs([...cocs, newCOC]);
    return newCOC;
  }, [cocs, saveCocs, assertCanManageSubject]);

  const editCOC = useCallback(async (cocId: string, updates: Partial<COC>) => {
    const target = cocs.find(coc => coc.id === cocId);
    if (target) assertCanManageSubject(target.subjectId);
    const updated = cocs.map(c => c.id === cocId ? { ...c, ...updates } : c);
    await saveCocs(updated);
  }, [cocs, saveCocs, assertCanManageSubject]);

  const deleteCOC = useCallback(async (cocId: string) => {
    const target = cocs.find(coc => coc.id === cocId);
    if (target) assertCanManageSubject(target.subjectId);
    await saveCocs(cocs.filter(c => c.id !== cocId));
    const cocLOIds = learningOutcomes.filter(lo => lo.cocId === cocId).map(lo => lo.id);
    await saveLOs(learningOutcomes.filter(lo => lo.cocId !== cocId));
    await saveContents(contents.filter(c => !cocLOIds.includes(c.loId)));
    const quizzesToDelete = quizzes.filter(q => cocLOIds.includes(q.loId));
    await saveQuizzes(quizzes.filter(q => !cocLOIds.includes(q.loId)));
    for (const quiz of quizzesToDelete) {
      await saveQuestions(questions.filter(q => q.quizId !== quiz.id));
    }
  }, [cocs, learningOutcomes, contents, quizzes, questions, saveCocs, saveLOs, saveContents, saveQuizzes, saveQuestions, assertCanManageSubject]);

  const archiveCOC = useCallback(async (cocId: string) => {
    const target = cocs.find(coc => coc.id === cocId);
    if (target) assertCanManageSubject(target.subjectId);
    const updated = cocs.map(c => c.id === cocId ? { ...c, archived: !c.archived } : c);
    await saveCocs(updated);
  }, [cocs, saveCocs, assertCanManageSubject]);

  // === LO CRUD ===

  const addLO = useCallback(async (cocId: string, subjectId: string, adminId: string, title: string, description: string, performanceCriteria: string[] = []) => {
    assertCanManageSubject(subjectId);
    const cocLOs = learningOutcomes.filter(lo => lo.cocId === cocId);
    const maxOrder = cocLOs.length > 0 ? Math.max(...cocLOs.map(lo => lo.order)) : 0;
    const newLO: LearningOutcome = {
      id: generateId(),
      cocId,
      subjectId,
      adminId,
      title,
      description,
      performanceCriteria,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    await saveLOs([...learningOutcomes, newLO]);
    return newLO;
  }, [learningOutcomes, saveLOs, assertCanManageSubject]);

  const editLO = useCallback(async (loId: string, updates: Partial<LearningOutcome>) => {
    const target = learningOutcomes.find(lo => lo.id === loId);
    if (target) assertCanManageSubject(target.subjectId);
    const updated = learningOutcomes.map(lo => lo.id === loId ? { ...lo, ...updates } : lo);
    await saveLOs(updated);
  }, [learningOutcomes, saveLOs, assertCanManageSubject]);

  const deleteLO = useCallback(async (loId: string) => {
    const target = learningOutcomes.find(lo => lo.id === loId);
    if (target) assertCanManageSubject(target.subjectId);
    await saveLOs(learningOutcomes.filter(lo => lo.id !== loId));
    await saveContents(contents.filter(c => c.loId !== loId));
    const quizzesToDelete = quizzes.filter(q => q.loId === loId);
    await saveQuizzes(quizzes.filter(q => q.loId !== loId));
    for (const quiz of quizzesToDelete) {
      await saveQuestions(questions.filter(q => q.quizId !== quiz.id));
    }
  }, [learningOutcomes, contents, quizzes, questions, saveLOs, saveContents, saveQuizzes, saveQuestions, assertCanManageSubject]);

  const archiveLO = useCallback(async (loId: string) => {
    const target = learningOutcomes.find(lo => lo.id === loId);
    if (target) assertCanManageSubject(target.subjectId);
    const updated = learningOutcomes.map(lo => lo.id === loId ? { ...lo, archived: !lo.archived } : lo);
    await saveLOs(updated);
  }, [learningOutcomes, saveLOs, assertCanManageSubject]);

  // === CONTENT CRUD ===

  const addContent = useCallback(async (
    loId: string, cocId: string, subjectId: string, adminId: string,
    type: ContentType, title: string, content: string,
    options?: {
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      fileUrl?: string;
      thumbnailUrl?: string;
      videoMetadata?: VideoMetadata;
    },
  ) => {
    assertCanManageSubject(subjectId);
    const loContents = contents.filter(c => c.loId === loId);
    const maxOrder = loContents.length > 0 ? Math.max(...loContents.map(c => c.order)) : -1;
    const now = new Date().toISOString();
    const newContent: Content = {
      id: generateId(),
      loId, cocId, subjectId, adminId, type, title, content,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      fileName: options?.fileName,
      fileSize: options?.fileSize,
      mimeType: options?.mimeType,
      fileUrl: options?.fileUrl,
      thumbnailUrl: options?.thumbnailUrl,
      videoMetadata: options?.videoMetadata,
    };
    await saveContents([...contents, newContent]);
    await enqueueSync('content', 'create', newContent.id, newContent);
    return newContent;
  }, [contents, saveContents, assertCanManageSubject]);

  const editContent = useCallback(async (contentId: string, updates: Partial<Content>) => {
    const target = contents.find(content => content.id === contentId);
    if (target) assertCanManageSubject(target.subjectId);
    const updated = contents.map(c => c.id === contentId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c);
    await saveContents(updated);
    if (target) await enqueueSync('content', 'update', contentId, updated.find(c => c.id === contentId));
  }, [contents, saveContents, assertCanManageSubject]);

  const deleteContent = useCallback(async (contentId: string) => {
    const target = contents.find(content => content.id === contentId);
    if (target) assertCanManageSubject(target.subjectId);
    await saveContents(contents.filter(c => c.id !== contentId));
    await enqueueSync('content', 'delete', contentId);
  }, [contents, saveContents, assertCanManageSubject]);

  const archiveContent = useCallback(async (contentId: string) => {
    const target = contents.find(content => content.id === contentId);
    if (target) assertCanManageSubject(target.subjectId);
    const updated = contents.map(c => c.id === contentId ? { ...c, archived: !c.archived } : c);
    await saveContents(updated);
  }, [contents, saveContents, assertCanManageSubject]);

  // === QUIZ CRUD ===

  const addQuiz = useCallback(async (loId: string, cocId: string, subjectId: string, adminId: string, title: string, description: string, passingScore: number = 80) => {
    assertCanManageSubject(subjectId);
    const existingQuiz = quizzes.find(q => q.loId === loId);
    if (existingQuiz) {
      await saveQuizzes(quizzes.filter(q => q.id !== existingQuiz.id));
      await saveQuestions(questions.filter(q => q.quizId !== existingQuiz.id));
    }
    const newQuiz: Quiz = {
      id: generateId(),
      loId,
      cocId,
      subjectId,
      adminId,
      title,
      description,
      passingScore,
      createdAt: new Date().toISOString(),
    };
    await saveQuizzes([...quizzes.filter(q => q.loId !== loId), newQuiz]);
    return newQuiz;
  }, [quizzes, questions, saveQuizzes, saveQuestions, assertCanManageSubject]);

  const editQuiz = useCallback(async (quizId: string, updates: Partial<Quiz>) => {
    const target = quizzes.find(quiz => quiz.id === quizId);
    if (target) assertCanManageSubject(target.subjectId);
    const updated = quizzes.map(q => q.id === quizId ? { ...q, ...updates } : q);
    await saveQuizzes(updated);
  }, [quizzes, saveQuizzes, assertCanManageSubject]);

  const deleteQuiz = useCallback(async (quizId: string) => {
    const target = quizzes.find(quiz => quiz.id === quizId);
    if (target) assertCanManageSubject(target.subjectId);
    await saveQuizzes(quizzes.filter(q => q.id !== quizId));
    await saveQuestions(questions.filter(q => q.quizId !== quizId));
  }, [quizzes, questions, saveQuizzes, saveQuestions, assertCanManageSubject]);

  // === QUIZ SCHEDULE (Flexible Subjects Only) ===

  const setQuizSchedule = useCallback(async (quizId: string, schedule: QuizSchedule): Promise<void> => {
    const target = quizzes.find(q => q.id === quizId);
    if (!target) throw new Error('Quiz not found');
    assertCanManageSubject(target.subjectId);
    const updated = quizzes.map(q =>
      q.id === quizId
        ? { ...q, schedule: { ...schedule, updatedAt: new Date().toISOString() } }
        : q
    );
    await saveQuizzes(updated);
    await enqueueSync('quiz', 'update', quizId, updated.find(q => q.id === quizId));
    console.log('[Data] Quiz schedule set for quiz:', quizId);
  }, [quizzes, saveQuizzes, assertCanManageSubject]);

  const clearQuizSchedule = useCallback(async (quizId: string): Promise<void> => {
    const target = quizzes.find(q => q.id === quizId);
    if (!target) return;
    assertCanManageSubject(target.subjectId);
    const updated = quizzes.map(q =>
      q.id === quizId ? { ...q, schedule: undefined } : q
    );
    await saveQuizzes(updated);
    await enqueueSync('quiz', 'update', quizId, updated.find(q => q.id === quizId));
    console.log('[Data] Quiz schedule cleared for quiz:', quizId);
  }, [quizzes, saveQuizzes, assertCanManageSubject]);

  const getQuizSchedule = useCallback((quizId: string): QuizSchedule | undefined => {
    const quiz = quizzes.find(q => q.id === quizId);
    return quiz?.schedule;
  }, [quizzes]);

  const getQuizScheduleStatus = useCallback((quizId: string): QuizScheduleStatus => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz?.schedule) return 'available';
    const now = Date.now();
    const startTime = new Date(quiz.schedule.startDateTime).getTime();
    const endTime = new Date(quiz.schedule.endDateTime).getTime();
    if (now < startTime) return 'upcoming';
    if (now > endTime) return 'closed';
    return 'available';
  }, [quizzes]);

  const isQuizAccessible = useCallback((quizId: string): boolean => {
    const status = getQuizScheduleStatus(quizId);
    return status === 'available';
  }, [getQuizScheduleStatus]);

  const getQuizTimeUntilStart = useCallback((quizId: string): number => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz?.schedule) return 0;
    const now = Date.now();
    const startTime = new Date(quiz.schedule.startDateTime).getTime();
    return Math.max(0, startTime - now);
  }, [quizzes]);

  const getQuizTimeUntilEnd = useCallback((quizId: string): number => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz?.schedule) return 0;
    const now = Date.now();
    const endTime = new Date(quiz.schedule.endDateTime).getTime();
    return Math.max(0, endTime - now);
  }, [quizzes]);

  const extendQuizSchedule = useCallback(async (quizId: string, newEndDateTime: string): Promise<void> => {
    const target = quizzes.find(q => q.id === quizId);
    if (!target?.schedule) throw new Error('No schedule to extend');
    if (!target.schedule.isExtendable) throw new Error('This quiz schedule is not extendable');
    assertCanManageSubject(target.subjectId);
    const updatedSchedule: QuizSchedule = {
      ...target.schedule,
      endDateTime: newEndDateTime,
      updatedAt: new Date().toISOString(),
    };
    const updated = quizzes.map(q =>
      q.id === quizId ? { ...q, schedule: updatedSchedule } : q
    );
    await saveQuizzes(updated);
    await enqueueSync('quiz', 'update', quizId, updated.find(q => q.id === quizId));
    console.log('[Data] Quiz schedule extended for quiz:', quizId, 'to', newEndDateTime);
  }, [quizzes, saveQuizzes, assertCanManageSubject]);

  // === QUESTION CRUD ===

  const addQuestion = useCallback(async (quizId: string, loId: string, subjectId: string, question: string, options: string[], correctAnswer: number, image?: string) => {
    assertCanManageSubject(subjectId);
    const quizQs = questions.filter(q => q.quizId === quizId);
    const newQuestion: Question = {
      id: generateId(),
      quizId,
      loId,
      subjectId,
      question,
      options,
      correctAnswer,
      image,
      order: quizQs.length,
      createdAt: new Date().toISOString(),
    };
    await saveQuestions([...questions, newQuestion]);
    return newQuestion;
  }, [questions, saveQuestions, assertCanManageSubject]);

  const editQuestion = useCallback(async (questionId: string, updates: Partial<Question>) => {
    const target = questions.find(question => question.id === questionId);
    if (target) assertCanManageSubject(target.subjectId);
    const updated = questions.map(q => q.id === questionId ? { ...q, ...updates } : q);
    await saveQuestions(updated);
  }, [questions, saveQuestions, assertCanManageSubject]);

  const deleteQuestion = useCallback(async (questionId: string) => {
    const target = questions.find(question => question.id === questionId);
    if (target) assertCanManageSubject(target.subjectId);
    await saveQuestions(questions.filter(q => q.id !== questionId));
  }, [questions, saveQuestions, assertCanManageSubject]);

  // === ANNOUNCEMENTS ===

  const addAnnouncement = useCallback(async (
    adminId: string,
    title: string,
    message: string,
    targetType: AnnouncementTargetType = 'my_students',
    targetIds: string[] = [],
    isSuperAdmin: boolean = false,
    extra?: {
      targetStudentIds?: string[];
      targetSectionIds?: string[];
      targetGradeLevels?: GradeLevel[];
      targetAdminIds?: string[];
      priority?: 'normal' | 'important';
    }
  ) => {
    let scope: AnnouncementScope = 'admin_students';
    let targetRole: 'all' | 'admins' | 'students' = 'students';
    if (isSuperAdmin) {
      if (targetType === 'all') {
        scope = 'global';
        targetRole = 'all';
      } else if (targetType === 'admins') {
        scope = 'targeted';
        targetRole = 'admins';
      } else if (targetType === 'students') {
        scope = 'global';
        targetRole = 'students';
      } else if (targetType === 'specific') {
        scope = 'targeted';
        targetRole = 'all';
      } else {
        scope = 'global';
        targetRole = 'all';
      }
    } else {
      const hasSpecificTarget = (extra?.targetStudentIds?.length ?? 0) > 0 ||
        (extra?.targetSectionIds?.length ?? 0) > 0 ||
        (extra?.targetGradeLevels?.length ?? 0) > 0;
      if (hasSpecificTarget) {
        scope = 'targeted';
        targetRole = 'students';
      } else {
        scope = 'admin_students';
        targetRole = 'students';
      }
    }
    const newAnn: Announcement = {
      id: generateId(),
      adminId,
      title,
      message,
      createdAt: new Date().toISOString(),
      targetType,
      targetIds,
      scope,
      targetRole,
      isEditable: true,
      targetStudentIds: extra?.targetStudentIds ?? [],
      targetSectionIds: extra?.targetSectionIds ?? [],
      targetGradeLevels: extra?.targetGradeLevels ?? [],
      targetAdminIds: extra?.targetAdminIds ?? [],
      priority: extra?.priority ?? 'normal',
    };
    await saveAnnouncements([newAnn, ...announcements]);
    console.log('[Data] Announcement created, scope:', scope, 'target:', targetType, 'students:', extra?.targetStudentIds?.length ?? 0, 'sections:', extra?.targetSectionIds?.length ?? 0, 'grades:', extra?.targetGradeLevels?.length ?? 0);
    return newAnn;
  }, [announcements, saveAnnouncements]);

  const editAnnouncement = useCallback(async (annId: string, updates: Partial<Announcement>) => {
    const updated = announcements.map(a => a.id === annId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a);
    await saveAnnouncements(updated);
    console.log('[Data] Announcement edited:', annId);
  }, [announcements, saveAnnouncements]);

  const deleteAnnouncement = useCallback(async (annId: string) => {
    await saveAnnouncements(announcements.filter(a => a.id !== annId));
  }, [announcements, saveAnnouncements]);

  const getAdminAnnouncements = useCallback((adminId: string) => {
    return announcements.filter(a => a.adminId === adminId && !a.archived);
  }, [announcements]);

  const getStudentAnnouncements = useCallback((studentId?: string, studentAdminId?: string, studentSectionId?: string, studentGradeLevel?: GradeLevel) => {
    if (!studentId) return [];
    return announcements.filter(a => {
      if (a.archived) return false;
      const scope = a.scope;
      if (scope === 'global') return true;
      if (scope === 'admin_students') return a.adminId === studentAdminId;
      if (scope === 'targeted') {
        if ((a.targetIds ?? []).includes(studentId)) return true;
        if ((a.targetStudentIds ?? []).includes(studentId)) return true;
        if (studentSectionId && (a.targetSectionIds ?? []).includes(studentSectionId)) return true;
        if (studentGradeLevel && (a.targetGradeLevels ?? []).includes(studentGradeLevel)) return true;
        if (a.adminId === studentAdminId) {
          const hasStudentTargets = (a.targetStudentIds?.length ?? 0) > 0;
          const hasSectionTargets = (a.targetSectionIds?.length ?? 0) > 0;
          const hasGradeTargets = (a.targetGradeLevels?.length ?? 0) > 0;
          if (hasStudentTargets && (a.targetStudentIds ?? []).includes(studentId)) return true;
          if (hasSectionTargets && studentSectionId && (a.targetSectionIds ?? []).includes(studentSectionId)) return true;
          if (hasGradeTargets && studentGradeLevel && (a.targetGradeLevels ?? []).includes(studentGradeLevel)) return true;
        }
        return false;
      }
      const target = a.targetType ?? 'my_students';
      if (target === 'my_students') return a.adminId === studentAdminId;
      if (target === 'all') return true;
      if (target === 'students') return true;
      if (target === 'specific') return (a.targetIds ?? []).includes(studentId);
      return a.adminId === studentAdminId;
    });
  }, [announcements]);

  const getGlobalAnnouncements = useCallback(() => {
    return announcements.filter(a => {
      if (a.archived) return false;
      if (a.scope === 'global') return true;
      const target = a.targetType ?? 'my_students';
      return target === 'all' || target === 'students';
    });
  }, [announcements]);

  const getMyAdminAnnouncements = useCallback((studentAdminId?: string) => {
    if (!studentAdminId) return [];
    return announcements.filter(a => {
      if (a.archived) return false;
      if (a.scope === 'admin_students' && a.adminId === studentAdminId) return true;
      if (!a.scope) {
        const target = a.targetType ?? 'my_students';
        if (target === 'my_students' && a.adminId === studentAdminId) return true;
      }
      return false;
    });
  }, [announcements]);

  const getAdminTargetedAnnouncements = useCallback((adminId: string) => {
    return announcements.filter(a => {
      if (a.archived) return false;
      const target = a.targetType ?? 'my_students';
      if (target === 'all') return true;
      if (target === 'admins') return true;
      if (target === 'specific') return (a.targetIds ?? []).includes(adminId);
      return false;
    });
  }, [announcements]);

  const getUndismissedAnnouncements = useCallback((studentId?: string, studentAdminId?: string, studentSectionId?: string, studentGradeLevel?: GradeLevel) => {
    if (!studentId) return [];
    return announcements.filter(a => {
      if (a.archived) return false;
      if (dismissedAnnIds.includes(a.id)) return false;
      const scope = a.scope;
      if (scope === 'global') return true;
      if (scope === 'admin_students') return a.adminId === studentAdminId;
      if (scope === 'targeted') {
        if ((a.targetIds ?? []).includes(studentId)) return true;
        if ((a.targetStudentIds ?? []).includes(studentId)) return true;
        if (studentSectionId && (a.targetSectionIds ?? []).includes(studentSectionId)) return true;
        if (studentGradeLevel && (a.targetGradeLevels ?? []).includes(studentGradeLevel)) return true;
        if (a.adminId === studentAdminId) {
          const hasStudentTargets = (a.targetStudentIds?.length ?? 0) > 0;
          const hasSectionTargets = (a.targetSectionIds?.length ?? 0) > 0;
          const hasGradeTargets = (a.targetGradeLevels?.length ?? 0) > 0;
          if (hasStudentTargets && (a.targetStudentIds ?? []).includes(studentId)) return true;
          if (hasSectionTargets && studentSectionId && (a.targetSectionIds ?? []).includes(studentSectionId)) return true;
          if (hasGradeTargets && studentGradeLevel && (a.targetGradeLevels ?? []).includes(studentGradeLevel)) return true;
        }
        return false;
      }
      const target = a.targetType ?? 'my_students';
      if (target === 'my_students') return a.adminId === studentAdminId;
      if (target === 'all') return true;
      if (target === 'students') return true;
      if (target === 'specific') return (a.targetIds ?? []).includes(studentId);
      return a.adminId === studentAdminId;
    });
  }, [announcements, dismissedAnnIds]);

  const getUndismissedAdminAnnouncements = useCallback((adminId: string) => {
    return announcements.filter(a => {
      if (a.archived) return false;
      if (dismissedAnnIds.includes(a.id)) return false;
      const target = a.targetType ?? 'my_students';
      if (target === 'all') return true;
      if (target === 'admins') return true;
      if (target === 'specific') return (a.targetIds ?? []).includes(adminId);
      return false;
    });
  }, [announcements, dismissedAnnIds]);

  const dismissAnnouncements = useCallback(async (annIds: string[]) => {
    const updated = [...new Set([...dismissedAnnIds, ...annIds])];
    setDismissedAnnIds(updated);
    await AsyncStorage.setItem(DISMISSED_ANN_KEY, JSON.stringify(updated));
    queryClient.setQueryData(['dismissedAnnouncements'], updated);
    console.log('[Data] Dismissed announcements:', annIds);
  }, [dismissedAnnIds, queryClient]);

  // === ANNOUNCEMENT PINNING ===

  const pinAnnouncement = useCallback(async (annId: string, pinnedBy: string): Promise<void> => {
    const updated = announcements.map(a =>
      a.id === annId
        ? { ...a, pinned: true, pinnedAt: new Date().toISOString(), pinnedBy }
        : a
    );
    await saveAnnouncements(updated);
    console.log('[Data] Announcement pinned:', annId);
  }, [announcements, saveAnnouncements]);

  const unpinAnnouncement = useCallback(async (annId: string): Promise<void> => {
    const updated = announcements.map(a =>
      a.id === annId
        ? { ...a, pinned: false, pinnedAt: undefined, pinnedBy: undefined }
        : a
    );
    await saveAnnouncements(updated);
    console.log('[Data] Announcement unpinned:', annId);
  }, [announcements, saveAnnouncements]);

  const togglePinAnnouncement = useCallback(async (annId: string, pinnedBy: string): Promise<void> => {
    const ann = announcements.find(a => a.id === annId);
    if (ann?.pinned) {
      await unpinAnnouncement(annId);
    } else {
      await pinAnnouncement(annId, pinnedBy);
    }
  }, [announcements, pinAnnouncement, unpinAnnouncement]);

  // === ADMIN PROGRESS CHECKS ===

  const toggleAdminCheck = useCallback(async (adminId: string, userId: string, loId: string, subjectId: string) => {
    const existing = adminChecks.find(c => c.userId === userId && c.loId === loId && c.subjectId === subjectId);
    if (existing) {
      const updated = adminChecks.map(c =>
        c.id === existing.id ? { ...c, checked: !c.checked, checkedAt: new Date().toISOString() } : c
      );
      await saveAdminChecks(updated);
    } else {
      const newCheck: AdminProgressCheck = {
        id: generateId(),
        adminId,
        userId,
        loId,
        subjectId,
        checked: true,
        checkedAt: new Date().toISOString(),
      };
      await saveAdminChecks([...adminChecks, newCheck]);
    }
  }, [adminChecks, saveAdminChecks]);

  const getAdminCheck = useCallback((userId: string, loId: string, subjectId: string): boolean => {
    const check = adminChecks.find(c => c.userId === userId && c.loId === loId && c.subjectId === subjectId);
    return check?.checked || false;
  }, [adminChecks]);

  const getSectionProgressData = useCallback((sectionStudents: { id: string; fullName: string }[], subjectId: string) => {
    const subjectCOCsList = cocs.filter(c => c.subjectId === subjectId && !c.archived).sort((a, b) => a.order - b.order);
    const allLOs: LearningOutcome[] = [];
    subjectCOCsList.forEach(coc => {
      const cocLOs = learningOutcomes.filter(lo => lo.cocId === coc.id && !lo.archived).sort((a, b) => a.order - b.order);
      allLOs.push(...cocLOs);
    });
    return {
      learningOutcomes: allLOs,
      students: sectionStudents.map(student => ({
        ...student,
        checks: allLOs.map(lo => ({
          loId: lo.id,
          passed: progress.find(p => p.userId === student.id && p.loId === lo.id && p.subjectId === subjectId)?.passed || false,
          adminChecked: getAdminCheck(student.id, lo.id, subjectId),
        })),
      })),
    };
  }, [cocs, learningOutcomes, progress, getAdminCheck]);

  const addActivity = useCallback(async (activity: Omit<Activity, 'id' | 'createdAt'>) => {
    const newActivity: Activity = {
      ...activity,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    await saveActivities([...activities, newActivity]);
    console.log('[Data] Activity added for student', activity.studentId);
    return newActivity;
  }, [activities, saveActivities]);

  const editActivity = useCallback(async (activityId: string, updates: Partial<Activity>) => {
    const updated = activities.map(a => a.id === activityId ? { ...a, ...updates } : a);
    await saveActivities(updated);
  }, [activities, saveActivities]);

  const deleteActivity = useCallback(async (activityId: string) => {
    await saveActivities(activities.filter(a => a.id !== activityId));
  }, [activities, saveActivities]);

  const getStudentActivities = useCallback((studentId: string, subjectId?: string) => {
    if (subjectId) return activities.filter(a => a.studentId === studentId && a.subjectId === subjectId);
    return activities.filter(a => a.studentId === studentId);
  }, [activities]);

  const getStudentQuizAttempts = useCallback((studentId: string, subjectId?: string) => {
    if (subjectId) return quizAttempts.filter(a => a.studentId === studentId && a.subjectId === subjectId);
    return quizAttempts.filter(a => a.studentId === studentId);
  }, [quizAttempts]);

  const gradeSubmission = useCallback(async (submissionId: string, grade: number, maxGrade: number, remarks?: string) => {
    const updated = submissions.map(s =>
      s.id === submissionId ? { ...s, grade, maxGrade, gradeRemarks: remarks, validated: true, validatedAt: new Date().toISOString() } : s
    );
    await saveSubmissions(updated);
    console.log('[Data] Submission graded:', submissionId, grade, '/', maxGrade);
  }, [submissions, saveSubmissions]);

  // === QUIZ VIOLATIONS (Tab-Switch / Window-Exit Detection) ===

  const recordQuizViolation = useCallback(async (
    studentId: string,
    studentName: string,
    quizId: string,
    loId: string,
    subjectId: string,
    type: QuizViolationType,
    questionIndex: number,
  ): Promise<void> => {
    const violation: QuizViolation = {
      id: generateId(),
      studentId,
      studentName,
      quizId,
      loId,
      subjectId,
      type,
      questionIndex,
      timestamp: new Date().toISOString(),
    };
    await saveQuizViolations([...quizViolations, violation]);
    await enqueueSync('quizViolation', 'create', violation.id, violation);
    const newCount = quizViolations.filter(v => v.studentId === studentId && v.quizId === quizId).length + 1;
    if (newCount >= 3) {
      const lock: QuizLock = {
        id: generateId(),
        studentId,
        quizId,
        loId,
        subjectId,
        lockedAt: new Date().toISOString(),
        unlockAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        violationCount: newCount,
      };
      await saveQuizLocks([...quizLocks.filter(l => !(l.studentId === studentId && l.quizId === quizId)), lock]);
      console.log('[Data] Quiz auto-locked for student', studentName, 'until', lock.unlockAt);
    }
    console.log('[Data] Quiz violation recorded:', type, 'for student', studentName, 'count:', newCount);
  }, [quizViolations, saveQuizViolations, quizLocks, saveQuizLocks]);

  const getQuizViolations = useCallback((quizId?: string, subjectId?: string): QuizViolation[] => {
    return quizViolations.filter(v => {
      if (quizId && v.quizId !== quizId) return false;
      if (subjectId && v.subjectId !== subjectId) return false;
      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [quizViolations]);

  const getStudentQuizViolations = useCallback((studentId: string, subjectId?: string): QuizViolation[] => {
    return quizViolations.filter(v => {
      if (v.studentId !== studentId) return false;
      if (subjectId && v.subjectId !== subjectId) return false;
      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [quizViolations]);

  const acknowledgeViolation = useCallback(async (violationId: string): Promise<void> => {
    const updated = quizViolations.map(v => v.id === violationId ? { ...v, acknowledged: true } : v);
    await saveQuizViolations(updated);
  }, [quizViolations, saveQuizViolations]);

  const getViolationCount = useCallback((studentId: string, quizId: string): number => {
    return quizViolations.filter(v => v.studentId === studentId && v.quizId === quizId).length;
  }, [quizViolations]);

  // === QUIZ AUTO-LOCK (after 3 violations) ===

  const getQuizLock = useCallback((studentId: string, quizId: string): QuizLock | null => {
    const lock = quizLocks.find(l => l.studentId === studentId && l.quizId === quizId);
    if (!lock) return null;
    if (new Date(lock.unlockAt).getTime() <= Date.now()) return null;
    return lock;
  }, [quizLocks]);

  const getQuizLockRemaining = useCallback((studentId: string, quizId: string): number => {
    const lock = getQuizLock(studentId, quizId);
    if (!lock) return 0;
    return Math.max(0, new Date(lock.unlockAt).getTime() - Date.now());
  }, [getQuizLock]);

  const isQuizViolationLocked = useCallback((studentId: string, quizId: string): boolean => {
    return getQuizLock(studentId, quizId) !== null;
  }, [getQuizLock]);

  const clearQuizLock = useCallback(async (studentId: string, quizId: string): Promise<void> => {
    const updated = quizLocks.filter(l => !(l.studentId === studentId && l.quizId === quizId));
    await saveQuizLocks(updated);
  }, [quizLocks, saveQuizLocks]);

  // === LESSON CONTENT COMPLETION TRACKING ===

  const getLOIncompleteContents = useCallback((loId: string, userId: string): { docs: number; videos: number; total: number } => {
    const loContents = contents.filter(c => c.loId === loId);
    const docs = loContents.filter(c => ['pdf', 'ppt', 'doc', 'image'].includes(c.type));
    const videos = loContents.filter(c => c.type === 'video');
    const total = docs.length + videos.length;
    if (total === 0) return { docs: 0, videos: 0, total: 0 };
    const readDocIds = new Set(docProgress.filter(p => p.userId === userId && p.isRead).map(p => p.contentId));
    const watchedVideoIds = new Set<string>();
    const incompleteDocs = docs.filter(d => !readDocIds.has(d.id)).length;
    const incompleteVideos = videos.filter(v => !watchedVideoIds.has(v.id)).length;
    return { docs: incompleteDocs, videos: incompleteVideos, total: incompleteDocs + incompleteVideos };
  }, [contents, docProgress]);

  const getStudentPendingReminders = useCallback((userId: string, subjectIds: string[]): { loId: string; loTitle: string; subjectCode: string; incomplete: number }[] => {
    const userLOs = learningOutcomes.filter(lo => subjectIds.includes(lo.subjectId) && !lo.archived);
    const reminders: { loId: string; loTitle: string; subjectCode: string; incomplete: number }[] = [];
    for (const lo of userLOs) {
      const subj = authSubjects.find(s => s.id === lo.subjectId);
      if (!subj) continue;
      const prog = progress.find(p => p.userId === userId && p.loId === lo.id);
      // Skip if quiz already passed
      if (prog?.passed) continue;
      // Only include if lesson is marked done but quiz not yet passed
      if (!prog?.lessonMarkedDone) continue;
      // Must have a quiz attached
      const hasQuiz = quizzes.some(q => q.loId === lo.id && !q.archived);
      if (!hasQuiz) continue;
      const inc = getLOIncompleteContents(lo.id, userId);
      reminders.push({ loId: lo.id, loTitle: lo.title, subjectCode: subj.code, incomplete: inc.total });
    }
    return reminders;
  }, [learningOutcomes, authSubjects, progress, getLOIncompleteContents, quizzes]);

  // === DOCUMENT PROGRESS TRACKING ===

  const updateDocProgress = useCallback(async (userId: string, contentId: string, scrollPercent: number, isRead: boolean): Promise<void> => {
    const existing = docProgress.find(p => p.userId === userId && p.contentId === contentId);
    const now = new Date().toISOString();
    if (existing) {
      const updated = docProgress.map(p =>
        p.userId === userId && p.contentId === contentId
          ? { ...p, scrollPercent: Math.max(p.scrollPercent, scrollPercent), isRead: isRead || p.isRead, updatedAt: now }
          : p
      );
      await saveDocProgress(updated);
    } else {
      const newProgress: DocumentProgress = { userId, contentId, scrollPercent, isRead, updatedAt: now };
      await saveDocProgress([...docProgress, newProgress]);
    }
  }, [docProgress, saveDocProgress]);

  const getDocProgress = useCallback((userId: string, contentId: string): { scrollPercent: number; isRead: boolean } | null => {
    const found = docProgress.find(p => p.userId === userId && p.contentId === contentId);
    return found ? { scrollPercent: found.scrollPercent, isRead: found.isRead } : null;
  }, [docProgress]);

  // === LESSON REORDERING (Flexible Subjects) ===

  const reorderLOs = useCallback(async (cocId: string, newOrder: string[]): Promise<void> => {
    const cocLOs = learningOutcomes.filter(lo => lo.cocId === cocId);
    const reordered = newOrder.map((loId, idx) => {
      const lo = cocLOs.find(l => l.id === loId);
      return lo ? { ...lo, order: idx } : null;
    }).filter((lo): lo is LearningOutcome => lo !== null);
    const otherLOs = learningOutcomes.filter(lo => lo.cocId !== cocId);
    await saveLOs([...otherLOs, ...reordered]);
    const coc = cocs.find(c => c.id === cocId);
    if (coc) await enqueueSync('lo', 'update', cocId, reordered);
    console.log('[Data] LOs reordered for COC:', cocId);
  }, [learningOutcomes, cocs, saveLOs]);

  // === QUIZ DISPLAY STATUS ===

  const getQuizDisplayStatus = useCallback((userId: string, loId: string, subjectId: string): QuizDisplayStatus => {
    const prog = progress.find(p => p.userId === userId && p.loId === loId && p.subjectId === subjectId);
    if (prog?.passed) return 'completed';
    if (prog && prog.attempts > 0 && !prog.passed) return 'in_progress';
    const subj = authSubjects.find(s => s.id === subjectId);
    if (subj?.unlockType === 'flexible') {
      const quiz = quizzes.find(q => q.loId === loId && !q.archived);
      if (quiz?.schedule) {
        const now = Date.now();
        const endTime = new Date(quiz.schedule.endDateTime).getTime();
        if (now > endTime && !prog?.passed) return 'missed';
      }
    }
    return 'not_started';
  }, [progress, authSubjects, quizzes]);

  const getStudentQuizStats = useCallback((userId: string, subjectIds: string[]): { completed: number; pending: number; inProgress: number; missed: number } => {
    let completed = 0, pending = 0, inProgress = 0, missed = 0;
    const userLOs = learningOutcomes.filter(lo => subjectIds.includes(lo.subjectId) && !lo.archived);
    for (const lo of userLOs) {
      const hasQuiz = quizzes.some(q => q.loId === lo.id && !q.archived);
      if (!hasQuiz) continue;
      const status = getQuizDisplayStatus(userId, lo.id, lo.subjectId);
      if (status === 'completed') completed++;
      else if (status === 'in_progress') inProgress++;
      else if (status === 'missed') missed++;
      else pending++;
    }
    return { completed, pending, inProgress, missed };
  }, [learningOutcomes, quizzes, getQuizDisplayStatus]);

  const getLessonsCompleted = useCallback((userId: string, subjectIds?: string[]): number => {
    if (subjectIds) {
      const userLOs = learningOutcomes.filter(lo => subjectIds.includes(lo.subjectId) && !lo.archived);
      return userLOs.filter(lo => {
        const prog = progress.find(p => p.userId === userId && p.loId === lo.id);
        return prog?.passed;
      }).length;
    }
    return progress.filter(p => p.userId === userId && p.passed).length;
  }, [learningOutcomes, progress]);

  // === NOTIFICATIONS ===

  const createNotification = useCallback(async (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): Promise<void> => {
    const newNotif: AppNotification = {
      ...notif,
      id: generateId(),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    await saveNotifications([newNotif, ...notifications]);
  }, [notifications, saveNotifications]);

  const getStudentNotifications = useCallback((userId: string): AppNotification[] => {
    return notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications]);

  const getUnreadNotificationCount = useCallback((userId: string): number => {
    return notifications.filter(n => n.userId === userId && !n.isRead).length;
  }, [notifications]);

  const markNotificationRead = useCallback(async (notifId: string): Promise<void> => {
    const updated = notifications.map(n => n.id === notifId ? { ...n, isRead: true } : n);
    await saveNotifications(updated);
  }, [notifications, saveNotifications]);

  const markAllNotificationsRead = useCallback(async (userId: string): Promise<void> => {
    const updated = notifications.map(n => n.userId === userId ? { ...n, isRead: true } : n);
    await saveNotifications(updated);
  }, [notifications, saveNotifications]);

  const deleteNotification = useCallback(async (notifId: string): Promise<void> => {
    await saveNotifications(notifications.filter(n => n.id !== notifId));
  }, [notifications, saveNotifications]);

  // Auto-generate notifications when announcements are created (for enrolled students)
  const notifyStudentsForAnnouncement = useCallback(async (ann: Announcement, studentIds: string[]): Promise<void> => {
    const notifs = studentIds.map(sid => ({
      id: generateId(),
      userId: sid,
      type: 'announcement' as NotificationType,
      title: `New announcement: ${ann.title}`,
      message: ann.message.slice(0, 100),
      isRead: false,
      createdAt: new Date().toISOString(),
      relatedId: ann.id,
      actorId: ann.adminId,
    }));
    if (notifs.length > 0) {
      await saveNotifications([...notifs, ...notifications]);
    }
  }, [notifications, saveNotifications]);

  // === PENDING QUIZ NOTIFICATIONS ===

  /**
   * Creates a pending-quiz notification for a student if all conditions are met:
   * - Lesson is marked as done
   * - A quiz exists for the LO
   * - Quiz has not been passed yet
   * - No duplicate notification already exists
   */
  const createPendingQuizNotification = useCallback(async (userId: string, loId: string, subjectId: string): Promise<void> => {
    const lo = learningOutcomes.find(l => l.id === loId);
    if (!lo) return;
    const subj = authSubjects.find(s => s.id === subjectId);
    if (!subj) return;
    const quiz = quizzes.find(q => q.loId === loId && !q.archived);
    if (!quiz) return; // no quiz → no pending notification
    const prog = progress.find(p => p.userId === userId && p.loId === loId && p.subjectId === subjectId);
    if (prog?.passed) return; // already completed → no notification
    if (!prog?.lessonMarkedDone) return; // lesson not marked done → no notification
    // Prevent duplicates: only one pending-quiz notification per student per LO
    const existing = notifications.find(
      n => n.userId === userId && n.type === 'quiz_available' && n.relatedId === loId,
    );
    if (existing) return;
    await createNotification({
      userId,
      type: 'quiz_available',
      title: `Pending Quiz: ${lo.title}`,
      message: `You marked this lesson as done but haven't taken the quiz yet. Subject: ${subj.code}.`,
      relatedId: loId,
      subjectId,
      subjectCode: subj.code,
    });
    console.log('[Data] Pending quiz notification created for LO:', loId, 'user:', userId);
  }, [learningOutcomes, authSubjects, quizzes, progress, notifications, createNotification]);

  /**
   * Removes any pending-quiz notification for a student + LO (e.g. when quiz is started or submitted).
   */
  const removePendingQuizNotification = useCallback(async (userId: string, loId: string): Promise<void> => {
    const toRemove = notifications.filter(
      n => n.userId === userId && n.type === 'quiz_available' && n.relatedId === loId,
    );
    if (toRemove.length === 0) return;
    const remaining = notifications.filter(n => !toRemove.includes(n));
    await saveNotifications(remaining);
    console.log('[Data] Pending quiz notification removed for LO:', loId, 'user:', userId);
  }, [notifications, saveNotifications]);

  // === ACTIVITY LOGS ===

  const logActivity = useCallback(async (userId: string, action: string, description: string, entityType?: string, entityId?: string): Promise<void> => {
    const entry: UserActivityLog = {
      id: generateId(),
      userId,
      action,
      description,
      entityType,
      entityId,
      createdAt: new Date().toISOString(),
    };
    await saveActivityLogs([entry, ...activityLogs]);
  }, [activityLogs, saveActivityLogs]);

  const getUserActivityLogs = useCallback((userId: string): UserActivityLog[] => {
    return activityLogs
      .filter(l => l.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activityLogs]);

  const isDataLoading = cocsQuery.isLoading || losQuery.isLoading || contentsQuery.isLoading ||
                        quizzesQuery.isLoading || questionsQuery.isLoading || progressQuery.isLoading || submissionsQuery.isLoading;

  return {
    cocs,
    learningOutcomes,
    contents,
    quizzes,
    questions,
    progress,
    submissions,
    isDataLoading,

    activeSubjectId,
    setActiveSubjectId,

    getSubjectCOCs,
    getCOCLOs,
    getSubjectLOs,
    getLOContents,
    getLOQuiz,
    getQuizQuestions,

    getLOStatus,
    isLOLocked,
    isLOCompleted,
    isLessonMarkedDone,
    markLessonDone,
    markLessonUndone,
    isQuizUnlocked,

    submitQuiz,
    getCooldownRemaining,

    getStudentSubmissions,
    getLOSubmissions,
    hasSubmissions,
    isLOValidated,
    addSubmission,
    deleteSubmission,
    validateSubmission,
    toggleValidation,

    getCOCProgress,
    getSubjectProgress,
    getStudentProgress,
    getOverallProgress,
    getStudentSubjectProgress,
    getAdminProgressCheck,
    getShuffledQuizQuestions,
    shuffleArray,

    addCOC,
    editCOC,
    deleteCOC,
    archiveCOC,

    addLO,
    editLO,
    deleteLO,
    archiveLO,

    addContent,
    editContent,
    deleteContent,
    archiveContent,
    isOnline,

    addQuiz,
    editQuiz,
    deleteQuiz,
    setQuizSchedule,
    clearQuizSchedule,
    getQuizSchedule,
    getQuizScheduleStatus,
    isQuizAccessible,
    getQuizTimeUntilStart,
    getQuizTimeUntilEnd,
    extendQuizSchedule,

    addQuestion,
    editQuestion,
    deleteQuestion,

    announcements,
    addAnnouncement,
    editAnnouncement,
    deleteAnnouncement,
    getAdminAnnouncements,
    getStudentAnnouncements,
    getGlobalAnnouncements,
    getMyAdminAnnouncements,
    getAdminTargetedAnnouncements,
    getUndismissedAnnouncements,
    getUndismissedAdminAnnouncements,
    dismissAnnouncements,
    pinAnnouncement,
    unpinAnnouncement,
    togglePinAnnouncement,

    adminChecks,
    toggleAdminCheck,
    getAdminCheck,
    getSectionProgressData,

    activities,
    addActivity,
    editActivity,
    deleteActivity,
    getStudentActivities,
    getStudentQuizAttempts,
    gradeSubmission,
    quizAttempts,

    // Quiz Violations
    quizViolations,
    recordQuizViolation,
    getQuizViolations,
    getStudentQuizViolations,
    acknowledgeViolation,
    getViolationCount,

    // Quiz Auto-Lock (after 3 violations)
    quizLocks,
    getQuizLock,
    getQuizLockRemaining,
    isQuizViolationLocked,
    clearQuizLock,

    // Document Progress
    docProgress,
    updateDocProgress,
    getDocProgress,

    // Lesson Content Completion + Reminders
    getLOIncompleteContents,
    getStudentPendingReminders,

    // Pending Quiz Notifications
    createPendingQuizNotification,
    removePendingQuizNotification,

    // Lesson Reordering
    reorderLOs,

    // Quiz Display Status
    getQuizDisplayStatus,
    getStudentQuizStats,
    getLessonsCompleted,

    // Notifications
    notifications,
    createNotification,
    getStudentNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    notifyStudentsForAnnouncement,

    // Activity Logs
    activityLogs,
    logActivity,
    getUserActivityLogs,

    // Manual Refresh (pull-to-refresh)
    refreshFromCloud,
  };
});
