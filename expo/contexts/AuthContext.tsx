import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Section, Subject, RegistrationLink, SignupData, AdminSignupData, InviteCode, GradeLevel, Semester, SubjectType, InviteRole, COC, LearningOutcome, Content, Quiz, Question } from '@/types';
import { generateId, DEFAULT_SUBJECTS, DEFAULT_SECTIONS, DEFAULT_SUPER_ADMIN, MOCK_USERS, MOCK_INVITE_CODES } from '@/mocks/data';
import { establishCloudSession, revokeCloudSession, pullCloudScope, pushCloudScope } from '@/services/cloudSync';
import { enqueueSync } from '@/services/syncQueue';

const USERS_KEY = 'aira_users';
const SECTIONS_KEY = 'aira_sections';
const SUBJECTS_KEY = 'aira_subjects';
const REG_LINKS_KEY = 'aira_reg_links';
const CURRENT_USER_KEY = 'aira_current_user';
const INVITE_CODES_KEY = 'aira_invite_codes';
const SESSION_TOKEN_KEY = 'aira_session_token';
const DATA_KEYS = {
  cocs: 'aira_cocs_v4',
  los: 'aira_los_v4',
  contents: 'aira_contents_v4',
  quizzes: 'aira_quizzes_v4',
  questions: 'aira_questions_v4',
} as const;
type AuthSnapshot = { users: User[]; sections: Section[]; subjects: Subject[]; regLinks: RegistrationLink[]; inviteCodes: InviteCode[] };

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

function ensureUserVerified(user: User): User {
  if (user.is_verified === undefined) {
    return { ...user, is_verified: true };
  }
  return user;
}

function ensureUsersVerified(users: User[]): User[] {
  return users.map(ensureUserVerified);
}

function normalizeSubject(subject: Subject): Subject {
  const subjectType: SubjectType = subject.subjectType ?? (subject.isGlobal ? 'global' : subject.createdBy === 'super_admin' ? 'generic' : 'private');
  return {
    ...subject,
    subjectType,
    isGlobal: subjectType === 'global' || subject.isGlobal === true,
    sharedWithAdminIds: subject.sharedWithAdminIds ?? [],
    adoptedBy: subject.adoptedBy ?? [],
  };
}

async function cloneSubjectContent(sourceSubjectId: string, newSubjectId: string, adminId: string): Promise<void> {
  const [cocsRaw, losRaw, contentsRaw, quizzesRaw, questionsRaw] = await Promise.all(
    Object.values(DATA_KEYS).map(key => AsyncStorage.getItem(key)),
  );
  const cocs: COC[] = cocsRaw ? JSON.parse(cocsRaw) : [];
  const learningOutcomes: LearningOutcome[] = losRaw ? JSON.parse(losRaw) : [];
  const contents: Content[] = contentsRaw ? JSON.parse(contentsRaw) : [];
  const quizzes: Quiz[] = quizzesRaw ? JSON.parse(quizzesRaw) : [];
  const questions: Question[] = questionsRaw ? JSON.parse(questionsRaw) : [];

  const cocIdMap = new Map<string, string>();
  const loIdMap = new Map<string, string>();
  const quizIdMap = new Map<string, string>();
  const clonedCocs = cocs.filter(coc => coc.subjectId === sourceSubjectId).map(coc => {
    const id = generateId();
    cocIdMap.set(coc.id, id);
    return { ...coc, id, subjectId: newSubjectId, adminId };
  });
  const clonedLOs = learningOutcomes.filter(lo => lo.subjectId === sourceSubjectId).map(lo => {
    const id = generateId();
    loIdMap.set(lo.id, id);
    return { ...lo, id, cocId: cocIdMap.get(lo.cocId) ?? lo.cocId, subjectId: newSubjectId, adminId };
  });
  const clonedContents = contents.filter(content => content.subjectId === sourceSubjectId).map(content => ({
    ...content,
    id: generateId(),
    loId: loIdMap.get(content.loId) ?? content.loId,
    cocId: cocIdMap.get(content.cocId) ?? content.cocId,
    subjectId: newSubjectId,
    adminId,
  }));
  const clonedQuizzes = quizzes.filter(quiz => quiz.subjectId === sourceSubjectId).map(quiz => {
    const id = generateId();
    quizIdMap.set(quiz.id, id);
    return { ...quiz, id, loId: loIdMap.get(quiz.loId) ?? quiz.loId, cocId: cocIdMap.get(quiz.cocId) ?? quiz.cocId, subjectId: newSubjectId, adminId };
  });
  const clonedQuestions = questions.filter(question => question.subjectId === sourceSubjectId).map(question => ({
    ...question,
    id: generateId(),
    quizId: quizIdMap.get(question.quizId) ?? question.quizId,
    loId: loIdMap.get(question.loId) ?? question.loId,
    subjectId: newSubjectId,
  }));

  await Promise.all([
    AsyncStorage.setItem(DATA_KEYS.cocs, JSON.stringify([...cocs, ...clonedCocs])),
    AsyncStorage.setItem(DATA_KEYS.los, JSON.stringify([...learningOutcomes, ...clonedLOs])),
    AsyncStorage.setItem(DATA_KEYS.contents, JSON.stringify([...contents, ...clonedContents])),
    AsyncStorage.setItem(DATA_KEYS.quizzes, JSON.stringify([...quizzes, ...clonedQuizzes])),
    AsyncStorage.setItem(DATA_KEYS.questions, JSON.stringify([...questions, ...clonedQuestions])),
  ]);
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [cloudAuthReady, setCloudAuthReady] = useState<boolean>(false);
  const cloudAuthUserRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(USERS_KEY);
      if (stored) {
        let users: User[] = JSON.parse(stored);
        users = ensureUsersVerified(users);

        const seedKey = 'aira_users_seed_v3';
        const hasSeeded = await AsyncStorage.getItem(seedKey);
        if (!hasSeeded) {
          const existingIds = new Set(users.map(u => u.id));
          const missingMocks = MOCK_USERS.filter(m => !existingIds.has(m.id));
          if (missingMocks.length > 0) {
            users = [...users, ...missingMocks];
          }
          const hasSuperAdmin = users.some(u => u.id === DEFAULT_SUPER_ADMIN.id);
          if (!hasSuperAdmin) {
            users = [DEFAULT_SUPER_ADMIN, ...users];
          }
          await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
          await AsyncStorage.setItem(seedKey, 'true');
          console.log('[Auth] Seeded mock accounts:', missingMocks.map(u => u.fullName));
          return users;
        }

        const hasSuperAdmin = users.some(u => u.id === DEFAULT_SUPER_ADMIN.id);
        let needsUpdate = false;
        if (!hasSuperAdmin) {
          users = [DEFAULT_SUPER_ADMIN, ...users];
          needsUpdate = true;
        }
        const superAdminUser = users.find(u => u.id === DEFAULT_SUPER_ADMIN.id);
        if (superAdminUser && superAdminUser.role !== 'super_admin') {
          users = users.map(u => u.id === DEFAULT_SUPER_ADMIN.id ? { ...u, role: 'super_admin' as const } : u);
          needsUpdate = true;
        }
        if (needsUpdate) {
          await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
        return users;
      }
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(MOCK_USERS));
      await AsyncStorage.setItem('aira_users_seed_v3', 'true');
      console.log('[Auth] Initialized with all mock accounts');
      return MOCK_USERS;
    },
  });

  // Sections Query - Initialize with default sections
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(SECTIONS_KEY);
      if (stored) {
        const sections: Section[] = JSON.parse(stored);
        // Ensure default sections exist
        const hasDefaultSections = DEFAULT_SECTIONS.every(def => 
          sections.some(s => s.id === def.id)
        );
        if (!hasDefaultSections) {
          const existingIds = new Set(sections.map(s => s.id));
          const missingDefaults = DEFAULT_SECTIONS.filter(def => !existingIds.has(def.id));
          const updated = [...sections, ...missingDefaults];
          await AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(updated));
          return updated;
        }
        return sections;
      }
      // Initialize with default sections
      await AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(DEFAULT_SECTIONS));
      return DEFAULT_SECTIONS;
    },
  });

  // Subjects Query - Initialize with default subjects
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(SUBJECTS_KEY);
      if (stored) {
        const storedSubjects: Subject[] = JSON.parse(stored);
        const subjects = storedSubjects.map(normalizeSubject);
        // Ensure default subjects exist while preserving user-created records.
        const existingCodes = new Set(subjects.map(s => s.code));
        const missingDefaults = DEFAULT_SUBJECTS.filter(def => !existingCodes.has(def.code)).map(normalizeSubject);
        const updated = [...subjects, ...missingDefaults];
        if (missingDefaults.length > 0 || JSON.stringify(updated) !== JSON.stringify(storedSubjects)) {
          await AsyncStorage.setItem(SUBJECTS_KEY, JSON.stringify(updated));
        }
        return updated;
      }
      // Initialize with default subjects
      const defaults = DEFAULT_SUBJECTS.map(normalizeSubject);
      await AsyncStorage.setItem(SUBJECTS_KEY, JSON.stringify(defaults));
      return defaults;
    },
  });

  const regLinksQuery = useQuery({
    queryKey: ['regLinks'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(REG_LINKS_KEY);
      if (stored) {
        const links: RegistrationLink[] = JSON.parse(stored);
        const now = new Date();
        const activeLinks = links.filter(l => {
          if (!l.active) return false;
          if (l.expiresAt && new Date(l.expiresAt) < now) return false;
          if (l.maxUses && l.usedCount >= l.maxUses) return false;
          return true;
        });
        const removedCount = links.length - activeLinks.length;
        if (removedCount > 0) {
          await AsyncStorage.setItem(REG_LINKS_KEY, JSON.stringify(activeLinks));
          console.log(`[Auth] Auto-cleaned ${removedCount} expired/inactive registration links`);
        }
        return activeLinks;
      }
      return [] as RegistrationLink[];
    },
  });

  const inviteCodesQuery = useQuery({
    queryKey: ['inviteCodes'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(INVITE_CODES_KEY);
      if (stored) {
        let codes: InviteCode[] = JSON.parse(stored);
        const seedKey = 'aira_invite_codes_seed_v1';
        const hasSeeded = await AsyncStorage.getItem(seedKey);
        if (!hasSeeded) {
          const existingCodes = new Set(codes.map(c => c.code));
          const missingCodes = MOCK_INVITE_CODES.filter(m => !existingCodes.has(m.code));
          if (missingCodes.length > 0) {
            codes = [...codes, ...missingCodes];
            await AsyncStorage.setItem(INVITE_CODES_KEY, JSON.stringify(codes));
            console.log('[Auth] Seeded mock invite codes:', missingCodes.map(c => c.code));
          }
          await AsyncStorage.setItem(seedKey, 'true');
        }
        return codes;
      }
      await AsyncStorage.setItem(INVITE_CODES_KEY, JSON.stringify(MOCK_INVITE_CODES));
      await AsyncStorage.setItem('aira_invite_codes_seed_v1', 'true');
      console.log('[Auth] Initialized with mock invite codes');
      return MOCK_INVITE_CODES;
    },
  });

  const currentUserQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (!stored) return null;
      const user = ensureUserVerified(JSON.parse(stored) as User);
      if (user.archived) {
        await AsyncStorage.multiRemove([CURRENT_USER_KEY, SESSION_TOKEN_KEY]);
        return null;
      }
      return user;
    },
  });

  useEffect(() => {
    if (currentUserQuery.data !== undefined && !currentUserQuery.isLoading) {
      setCurrentUser(currentUserQuery.data);
      setIsInitialized(true);
    }
  }, [currentUserQuery.data, currentUserQuery.isLoading]);

  const saveUsers = useCallback(async (users: User[]) => {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    queryClient.setQueryData(['users'], users);
  }, [queryClient]);

  const saveSections = useCallback(async (sections: Section[]) => {
    await AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
    queryClient.setQueryData(['sections'], sections);
  }, [queryClient]);

  const saveSubjects = useCallback(async (subjects: Subject[]) => {
    await AsyncStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
    queryClient.setQueryData(['subjects'], subjects);
  }, [queryClient]);

  const saveRegLinks = useCallback(async (links: RegistrationLink[]) => {
    await AsyncStorage.setItem(REG_LINKS_KEY, JSON.stringify(links));
    queryClient.setQueryData(['regLinks'], links);
  }, [queryClient]);

  const saveInviteCodes = useCallback(async (codes: InviteCode[]) => {
    await AsyncStorage.setItem(INVITE_CODES_KEY, JSON.stringify(codes));
    queryClient.setQueryData(['inviteCodes'], codes);
  }, [queryClient]);

  const adminSignupMutation = useMutation({
    mutationFn: async (data: AdminSignupData) => {
      const emailLower = data.email.toLowerCase().trim();
      if (!emailLower.endsWith('@deped.gov.ph')) {
        throw new Error('Admin accounts must use a @deped.gov.ph email address.');
      }
      const users = usersQuery.data ?? [];
      const emailExists = users.some(u => u.email.toLowerCase() === emailLower);
      if (emailExists) {
        throw new Error('An account with this email already exists.');
      }
      const usernameExists = users.some(u => u.username.toLowerCase() === data.username.toLowerCase());
      if (usernameExists) {
        throw new Error('This username is already taken.');
      }
      const invitationCode = data.invitationCode?.trim().toUpperCase();
      let invitation: InviteCode | undefined;
      if (invitationCode) {
        invitation = (inviteCodesQuery.data ?? []).find(code => code.code === invitationCode && code.is_active && (code.role === 'admin' || code.role === 'teacher'));
        if (!invitation) throw new Error('Invalid or inactive admin invitation code.');
        if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now()) throw new Error('This invitation code has expired.');
        if (invitation.maxUses && (invitation.usedCount ?? 0) >= invitation.maxUses) throw new Error('This invitation code has reached its usage limit.');
      }
      const newAdmin: User = {
        id: generateId(),
        fullName: data.fullName,
        username: data.username,
        email: emailLower,
        password: data.password,
        role: 'admin',
        themePreference: 'dark',
        createdAt: new Date().toISOString(),
        is_verified: true,
        schoolOrganization: data.schoolOrganization?.trim() || undefined,
        accountType: data.accountType ?? (invitation?.role === 'teacher' ? 'teacher' : 'admin'),
      };
      const updated = [...users, newAdmin];
      await saveUsers(updated);
      if (invitation) {
        const updatedCodes = (inviteCodesQuery.data ?? []).map(code => code.id === invitation?.id ? {
          ...code,
          usedCount: (code.usedCount ?? 0) + 1,
          usedAt: new Date().toISOString(),
          is_active: code.maxUses ? (code.usedCount ?? 0) + 1 < code.maxUses : false,
        } : code);
        await saveInviteCodes(updatedCodes);
      }
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newAdmin));
      void establishCloudSession(newAdmin.id, newAdmin.email, data.password, newAdmin).catch(() => undefined);
      setCurrentUser(newAdmin);
      console.log('[Auth] Admin account created:', newAdmin.email);
      return newAdmin;
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupData) => {
      const users = usersQuery.data ?? [];
      const emailExists = users.some(u => u.email.toLowerCase() === data.email.toLowerCase().trim());
      if (emailExists) {
        throw new Error('An account with this email already exists.');
      }
      const usernameExists = users.some(u => u.username.toLowerCase() === data.username.toLowerCase().trim());
      if (usernameExists) {
        throw new Error('This username is already taken.');
      }
      // Validate profile image if provided
      if (data.profileImage) {
        const imageSize = data.profileImage.length;
        // Max ~5MB for base64 (base64 is ~33% larger than binary)
        if (imageSize > 7 * 1024 * 1024) {
          throw new Error('Profile image is too large. Please use an image under 5MB.');
        }
        if (!data.profileImage.startsWith('data:image/')) {
          throw new Error('Invalid image format. Only JPEG, PNG, and WebP are allowed.');
        }
      }
      
      if (data.adminId) {
        const adminExists = users.some(u => u.id === data.adminId && isAdminRole(u.role));
        if (!adminExists) {
          throw new Error('Invalid registration link. Please contact your administrator.');
        }
      }

      const newUser: User = {
        id: generateId(),
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        password: data.password,
        role: 'student',
        adminId: data.adminId,
        sectionId: data.sectionId,
        subjectIds: data.subjectIds || [],
        themePreference: 'dark',
        createdAt: new Date().toISOString(),
        is_verified: true,
        gradeLevel: data.gradeLevel,
      };
      const updated = [...users, newUser];
      await saveUsers(updated);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      void establishCloudSession(newUser.id, newUser.email, data.password, newUser).catch(() => undefined);
      setCurrentUser(newUser);
      console.log('[Auth] Student account created:', newUser.email, 'linked to admin:', data.adminId);
      return newUser;
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ identifier, password }: { identifier: string; password: string }) => {
      const users = ensureUsersVerified(usersQuery.data ?? []);
      let user = users.find(
        candidate => (candidate.email.toLowerCase() === identifier.toLowerCase() || candidate.username.toLowerCase() === identifier.toLowerCase()) &&
          candidate.password === password && !candidate.archived
      );
      if (!user) {
        try {
          const remoteProfile = await establishCloudSession(undefined, identifier, password);
          if (remoteProfile) {
            user = { ...remoteProfile, password, is_verified: remoteProfile.is_verified ?? true } as User;
            await saveUsers([...users.filter(candidate => candidate.id !== user?.id), user]);
          }
        } catch (error) {
          // Keep the local error message stable when the device is offline.
        }
      }
      if (!user) throw new Error('Invalid credentials. Please check your email/username and password.');
      const verifiedUser = ensureUserVerified(user);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(verifiedUser));
      void establishCloudSession(verifiedUser.id, identifier, password, verifiedUser).catch(() => undefined);
      setCurrentUser(verifiedUser);
      console.log('[Auth] Login successful:', verifiedUser.email, 'role:', verifiedUser.role);
      return verifiedUser;
    },
  });

  const logout = useCallback(async () => {
    console.log('[Auth] Logout started');
    try {
      // 1. Immediately clear the cloud auth ref to stop any pending sync
      cloudAuthUserRef.current = null;
      setCloudAuthReady(false);
      // 2. Clear currentUser from React state IMMEDIATELY (before async ops)
      //    This prevents components from rendering with stale data and avoids
      //    hook-ordering crashes during the transition.
      setCurrentUser(null);
      // 3. Cancel all in-flight queries to prevent race conditions and AbortErrors
      await queryClient.cancelQueries().catch(() => undefined);
      // 4. Revoke cloud session (best-effort, never throws)
      await revokeCloudSession().catch((e) => console.log('[Auth] Cloud session revoke failed (non-fatal):', e));
      // 5. Remove all session-related local storage keys
      await AsyncStorage.multiRemove([
        CURRENT_USER_KEY,
        SESSION_TOKEN_KEY,
        'aira_cloud_revision_auth',
        'aira_cloud_revision_data',
      ]).catch(() => undefined);
      // 6. Clear and invalidate ALL query caches to prevent stale data on next login
      queryClient.setQueryData(['currentUser'], null);
      queryClient.removeQueries({ queryKey: ['currentUser'] });
      // Remove all user-scoped data queries completely (not just invalidate)
      queryClient.removeQueries({ queryKey: ['users'] });
      queryClient.removeQueries({ queryKey: ['subjects'] });
      queryClient.removeQueries({ queryKey: ['sections'] });
      queryClient.removeQueries({ queryKey: ['announcements'] });
      queryClient.removeQueries({ queryKey: ['cocs'] });
      queryClient.removeQueries({ queryKey: ['los'] });
      queryClient.removeQueries({ queryKey: ['contents'] });
      queryClient.removeQueries({ queryKey: ['quizzes'] });
      queryClient.removeQueries({ queryKey: ['questions'] });
      queryClient.removeQueries({ queryKey: ['progress_v4'] });
      queryClient.removeQueries({ queryKey: ['submissions_v4'] });
      queryClient.removeQueries({ queryKey: ['activities_v1'] });
      queryClient.removeQueries({ queryKey: ['quiz_attempts_v1'] });
      queryClient.removeQueries({ queryKey: ['notifications_v1'] });
      queryClient.removeQueries({ queryKey: ['adminChecks'] });
      queryClient.removeQueries({ queryKey: ['quiz_violations_v1'] });
      queryClient.removeQueries({ queryKey: ['doc_progress_v1'] });
      queryClient.removeQueries({ queryKey: ['quiz_locks_v1'] });
      queryClient.removeQueries({ queryKey: ['activity_logs_v1'] });
      queryClient.removeQueries({ queryKey: ['dismissedAnnouncements'] });
      queryClient.removeQueries({ queryKey: ['activeSubject'] });
      queryClient.removeQueries({ queryKey: ['inviteCodes'] });
      queryClient.removeQueries({ queryKey: ['regLinks'] });
      // 7. On web, replace history state to prevent back-button access to protected pages
      if (Platform.OS === 'web') {
        try {
          window.history.replaceState(null, '', '/login');
        } catch { /* noop */ }
      }
      console.log('[Auth] Logout complete: session cleared, all caches removed');
    } catch (error) {
      // Even if something fails, force-clear state so user is logged out
      console.error('[Auth] Logout error (force-clearing state):', error);
      setCurrentUser(null);
      cloudAuthUserRef.current = null;
      setCloudAuthReady(false);
      try {
        await AsyncStorage.multiRemove([CURRENT_USER_KEY, SESSION_TOKEN_KEY]).catch(() => undefined);
      } catch { /* noop */ }
      if (Platform.OS === 'web') {
        try { window.history.replaceState(null, '', '/login'); } catch { /* noop */ }
      }
    }
  }, [queryClient]);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!currentUser) return;
    const users = usersQuery.data ?? [];
    const updatedUser = { ...currentUser, ...updates };
    const updatedUsers = users.map(u => u.id === currentUser.id ? updatedUser : u);
    await saveUsers(updatedUsers);
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    console.log('[Auth] Profile updated', updatedUser.fullName);
  }, [currentUser, usersQuery.data, saveUsers]);

  const resetPassword = useCallback(async (identifier: string, newPassword: string) => {
    const users = usersQuery.data ?? [];
    const user = users.find(
      u => u.email.toLowerCase() === identifier.toLowerCase() ||
           u.username.toLowerCase() === identifier.toLowerCase()
    );
    if (!user) {
      throw new Error('No account found with that email or username.');
    }
    const updatedUsers = users.map(u =>
      u.id === user.id ? { ...u, password: newPassword } : u
    );
    await saveUsers(updatedUsers);
    console.log('[Auth] Password reset for', identifier);
  }, [usersQuery.data, saveUsers]);

  const resetStudentPassword = useCallback(async (userId: string, newPassword: string) => {
    const users = usersQuery.data ?? [];
    const updatedUsers = users.map(u =>
      u.id === userId ? { ...u, password: newPassword } : u
    );
    await saveUsers(updatedUsers);
    await enqueueSync('user', 'update', userId, { password: newPassword }, 'auth');
    console.log('[Auth] Admin reset password for user', userId);
  }, [usersQuery.data, saveUsers]);

  const resetUserPassword = useCallback(async (targetUserId: string, newPassword: string) => {
    if (!currentUser) throw new Error('Not authenticated.');
    if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
    const users = usersQuery.data ?? [];
    const target = users.find(u => u.id === targetUserId);
    if (!target) throw new Error('User not found.');
    if (target.archived) throw new Error('Cannot reset password for an archived account.');

    if (currentUser.role === 'super_admin') {
      // Super Admin can reset Admins and Teachers
      if (target.role !== 'admin' && target.role !== 'super_admin') {
        // Super Admin can also reset students they manage
        if (target.role === 'student') {
          // allowed if student is under their org or unassigned
        } else {
          throw new Error('Super Admin can only reset passwords for Admins, Teachers, and Students.');
        }
      }
      if (target.id === currentUser.id) throw new Error('Use the profile page to change your own password.');
    } else if (currentUser.role === 'admin') {
      if (target.role === 'student') {
        if (target.adminId !== currentUser.id) throw new Error('You can only reset passwords for your own students.');
      } else if (target.role === 'admin') {
        // Admin can reset passwords for teachers in same org
        if (target.accountType !== 'teacher') throw new Error('Admins can only reset passwords for Teachers in their organization.');
        if (target.schoolOrganization !== currentUser.schoolOrganization) throw new Error('You can only reset passwords for Teachers in your organization.');
      } else {
        throw new Error('You do not have permission to reset this user\'s password.');
      }
    } else {
      throw new Error('You do not have permission to reset passwords.');
    }

    const updatedUsers = users.map(u =>
      u.id === targetUserId ? { ...u, password: newPassword } : u
    );
    await saveUsers(updatedUsers);
    await enqueueSync('user', 'update', targetUserId, { password: newPassword }, 'auth');
    console.log('[Auth] Password reset by', currentUser.role, 'for', target.role, targetUserId);
  }, [currentUser, usersQuery.data, saveUsers]);

  const deleteStudent = useCallback(async (userId: string) => {
    const users = usersQuery.data ?? [];
    const updatedUsers = users.filter(u => u.id !== userId);
    await saveUsers(updatedUsers);
    console.log('[Auth] Student deleted', userId);
  }, [usersQuery.data, saveUsers]);

  const archiveStudent = useCallback(async (userId: string) => {
    const users = usersQuery.data ?? [];
    const updatedUsers = users.map(u =>
      u.id === userId ? { ...u, archived: !u.archived } : u
    );
    await saveUsers(updatedUsers);
    console.log('[Auth] Student archive toggled', userId);
  }, [usersQuery.data, saveUsers]);

  const editStudent = useCallback(async (userId: string, updates: Partial<User>) => {
    const users = usersQuery.data ?? [];
    const updatedUsers = users.map(u =>
      u.id === userId ? { ...u, ...updates } : u
    );
    await saveUsers(updatedUsers);
    console.log('[Auth] Student updated', userId);
  }, [usersQuery.data, saveUsers]);

  // Section Management
  const addSection = useCallback(async (name: string, description: string, gradeLevel?: GradeLevel) => {
    if (!currentUser || !isAdminRole(currentUser.role)) throw new Error('Admin only');
    const sections = sectionsQuery.data ?? [];
    const newSection: Section = {
      id: generateId(),
      adminId: currentUser.id,
      name,
      description,
      createdAt: new Date().toISOString(),
      gradeLevel,
    };
    await saveSections([...sections, newSection]);
    // Auto-create section group chat via ChatContext (injected from _layout)
    // This is handled in the component layer where ChatContext is available
    return newSection;
  }, [currentUser, sectionsQuery.data, saveSections]);

  const editSection = useCallback(async (sectionId: string, updates: Partial<Section>) => {
    const sections = sectionsQuery.data ?? [];
    const updated = sections.map(s => s.id === sectionId ? { ...s, ...updates } : s);
    await saveSections(updated);
  }, [sectionsQuery.data, saveSections]);

  const deleteSection = useCallback(async (sectionId: string) => {
    const sections = sectionsQuery.data ?? [];
    await saveSections(sections.filter(s => s.id !== sectionId));
    // Remove section from students
    const users = usersQuery.data ?? [];
    const updatedUsers = users.map(u => 
      u.sectionId === sectionId ? { ...u, sectionId: undefined } : u
    );
    await saveUsers(updatedUsers);
  }, [sectionsQuery.data, usersQuery.data, saveSections, saveUsers]);

  const archiveSection = useCallback(async (sectionId: string) => {
    const sections = sectionsQuery.data ?? [];
    const updated = sections.map(s => 
      s.id === sectionId ? { ...s, archived: !s.archived } : s
    );
    await saveSections(updated);
  }, [sectionsQuery.data, saveSections]);

  // Subject Management
  const canManageSubject = useCallback((subjectId: string): boolean => {
    if (!currentUser || !isAdminRole(currentUser.role)) return false;
    if (currentUser.role === 'super_admin') return true;
    const subject = (subjectsQuery.data ?? []).find(item => item.id === subjectId);
    return Boolean(subject && subject.adminId === currentUser.id && subject.subjectType !== 'global' && subject.subjectType !== 'generic' && !subject.isGlobal);
  }, [currentUser, subjectsQuery.data]);

  const addSubject = useCallback(async (
    name: string,
    description: string,
    code: string,
    unlockType: 'sequential' | 'flexible' = 'sequential',
    gradeLevel?: GradeLevel,
    semester?: Semester,
    subjectType?: SubjectType,
  ) => {
    if (!currentUser || !isAdminRole(currentUser.role)) throw new Error('Admin only');
    if (currentUser.role === 'super_admin' && !subjectType) throw new Error('Choose Global or Generic subject type.');
    const resolvedType: SubjectType = subjectType ?? 'private';
    if (currentUser.role === 'admin' && resolvedType !== 'private') throw new Error('Admins can only create private subjects.');
    const subjects = subjectsQuery.data ?? [];
    const newSubject: Subject = {
      id: generateId(),
      adminId: currentUser.id,
      name,
      description,
      code,
      unlockType,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.role === 'super_admin' ? 'super_admin' : 'admin',
      subjectType: resolvedType,
      isGlobal: resolvedType === 'global',
      adoptedBy: [],
      sharedWithAdminIds: [],
      gradeLevel,
      semester,
    };
    await saveSubjects([...subjects, newSubject]);
    return newSubject;
  }, [currentUser, subjectsQuery.data, saveSubjects]);

  const adoptSubject = useCallback(async (subjectId: string) => {
    if (!currentUser || currentUser.role !== 'admin') throw new Error('Admin only');
    const subjects = subjectsQuery.data ?? [];
    const source = subjects.find(item => item.id === subjectId);
    if (!source || source.archived) throw new Error('Subject not found.');
    const sourceType: SubjectType = source.subjectType ?? (source.isGlobal ? 'global' : 'private');
    const isSharedGeneric = sourceType === 'generic' && (source.sharedWithAdminIds ?? []).includes(currentUser.id);
    if (sourceType !== 'global' && !isSharedGeneric) throw new Error('This subject is not available to your organization.');
    const alreadyHasCopy = subjects.some(item => item.adminId === currentUser.id && (item.sourceSubjectId === source.id || item.adaptedFromSubjectId === source.id));
    if (alreadyHasCopy) throw new Error('You already have an independent copy of this subject.');

    const copy: Subject = {
      ...source,
      id: generateId(),
      adminId: currentUser.id,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      subjectType: 'adapted',
      isGlobal: false,
      adoptedBy: [],
      sharedWithAdminIds: [],
      sourceSubjectId: source.id,
      adaptedFromSubjectId: source.id,
      organizationId: currentUser.schoolOrganization ?? currentUser.id,
    };
    const updated = subjects.map(item => item.id === source.id ? { ...item, adoptedBy: [...(item.adoptedBy ?? []), currentUser.id] } : item);
    await saveSubjects([...updated, copy]);
    await cloneSubjectContent(source.id, copy.id, currentUser.id);
    await Promise.all(Object.values(DATA_KEYS).map(key => queryClient.invalidateQueries({ queryKey: [key.replace('aira_', '')] })));
    console.log('[Auth] Subject adopted:', copy.id, 'from global/generic source:', source.id, 'by admin:', currentUser.id);
    return copy;
  }, [currentUser, subjectsQuery.data, saveSubjects, queryClient]);

  const unadoptSubject = useCallback(async (subjectId: string) => {
    if (!currentUser || currentUser.role !== 'admin') throw new Error('Admin only');
    const subjects = subjectsQuery.data ?? [];
    const target = subjects.find(item => item.id === subjectId);
    const sourceId = target?.adminId === currentUser.id ? (target.sourceSubjectId ?? target.adaptedFromSubjectId) : subjectId;
    const copy = subjects.find(item => item.adminId === currentUser.id && (item.sourceSubjectId === sourceId || item.adaptedFromSubjectId === sourceId));
    const updated = subjects
      .filter(item => item.id !== copy?.id)
      .map(item => item.id === sourceId ? { ...item, adoptedBy: (item.adoptedBy ?? []).filter(id => id !== currentUser.id) } : item);
    await saveSubjects(updated);
  }, [currentUser, subjectsQuery.data, saveSubjects]);

  const shareGenericSubject = useCallback(async (subjectId: string, adminIds: string[]) => {
    if (!currentUser || currentUser.role !== 'super_admin') throw new Error('Super Admin only');
    const subjects = subjectsQuery.data ?? [];
    const subject = subjects.find(item => item.id === subjectId);
    if (!subject || (subject.subjectType ?? (subject.isGlobal ? 'global' : 'private')) !== 'generic') throw new Error('Only Generic Subjects can be shared.');
    const validAdminIds = new Set((usersQuery.data ?? []).filter(user => user.role === 'admin' && !user.archived).map(user => user.id));
    const sharedWithAdminIds = [...new Set(adminIds.filter(id => validAdminIds.has(id)))];
    const removedAdminIds = (subject.sharedWithAdminIds ?? []).filter(id => !sharedWithAdminIds.includes(id));
    const adoptedAdminIds = subjects.filter(item => item.adminId && (item.sourceSubjectId === subjectId || item.adaptedFromSubjectId === subjectId)).map(item => item.adminId);
    if (removedAdminIds.some(id => adoptedAdminIds.includes(id))) throw new Error('An Admin with an independent copy cannot be removed from sharing.');
    await saveSubjects(subjects.map(item => item.id === subjectId ? { ...item, sharedWithAdminIds } : item));
  }, [currentUser, subjectsQuery.data, usersQuery.data, saveSubjects]);

  const revokeGenericShare = useCallback(async (subjectId: string, adminId: string) => {
    if (!currentUser || currentUser.role !== 'super_admin') throw new Error('Super Admin only');
    const subjects = subjectsQuery.data ?? [];
    const hasAdopted = subjects.some(item => item.adminId === adminId && (item.sourceSubjectId === subjectId || item.adaptedFromSubjectId === subjectId));
    if (hasAdopted) throw new Error('This Admin already adopted the subject; their copy is independent and cannot be revoked.');
    await saveSubjects(subjects.map(item => item.id === subjectId ? { ...item, sharedWithAdminIds: (item.sharedWithAdminIds ?? []).filter(id => id !== adminId) } : item));
  }, [currentUser, subjectsQuery.data, saveSubjects]);

  const getGlobalSubjects = useCallback(() => {
    return (subjectsQuery.data ?? []).filter(subject => (subject.subjectType ?? (subject.isGlobal ? 'global' : 'private')) === 'global' && !subject.archived);
  }, [subjectsQuery.data]);

  const getGenericSubjects = useCallback(() => {
    return (subjectsQuery.data ?? []).filter(subject => (subject.subjectType ?? 'private') === 'generic' && !subject.archived);
  }, [subjectsQuery.data]);

  const getAdoptableSubjects = useCallback(() => {
    if (!currentUser || currentUser.role !== 'admin') return [];
    const subjects = subjectsQuery.data ?? [];
    return subjects.filter(subject => {
      const subjectType: SubjectType = subject.subjectType ?? (subject.isGlobal ? 'global' : 'private');
      // Only global subjects and explicitly shared generic subjects are adoptable.
      // Super Admin's private subjects are never shown to admins.
      const available = subjectType === 'global' || (subjectType === 'generic' && (subject.sharedWithAdminIds ?? []).includes(currentUser.id));
      const alreadyHasCopy = subjects.some(copy => copy.adminId === currentUser.id && (copy.sourceSubjectId === subject.id || copy.adaptedFromSubjectId === subject.id));
      const isSuperAdminOwned = subject.createdBy === 'super_admin' && subjectType !== 'global' && subjectType !== 'generic';
      return available && !subject.archived && !alreadyHasCopy && !isSuperAdminOwned;
    });
  }, [currentUser, subjectsQuery.data]);

  const getAdoptedSubjects = useCallback(() => {
    if (!currentUser || currentUser.role !== 'admin') return [];
    return (subjectsQuery.data ?? []).filter(subject => subject.adminId === currentUser.id && (subject.subjectType === 'adapted' || Boolean(subject.sourceSubjectId || subject.adaptedFromSubjectId)) && !subject.archived);
  }, [currentUser, subjectsQuery.data]);

  const editSubject = useCallback(async (subjectId: string, updates: Partial<Subject>) => {
    if (!canManageSubject(subjectId)) throw new Error('You cannot edit a master subject owned by Super Admin.');
    const subjects = subjectsQuery.data ?? [];
    await saveSubjects(subjects.map(subject => subject.id === subjectId ? { ...subject, ...updates } : subject));
  }, [canManageSubject, subjectsQuery.data, saveSubjects]);

  const deleteSubject = useCallback(async (subjectId: string) => {
    if (!canManageSubject(subjectId)) throw new Error('You cannot delete a master subject owned by Super Admin.');
    const subjects = subjectsQuery.data ?? [];
    await saveSubjects(subjects.filter(subject => subject.id !== subjectId));
  }, [canManageSubject, subjectsQuery.data, saveSubjects]);

  const archiveSubject = useCallback(async (subjectId: string) => {
    if (!canManageSubject(subjectId)) throw new Error('You cannot archive a master subject owned by Super Admin.');
    const subjects = subjectsQuery.data ?? [];
    await saveSubjects(subjects.map(subject => subject.id === subjectId ? { ...subject, archived: !subject.archived } : subject));
  }, [canManageSubject, subjectsQuery.data, saveSubjects]);

  // Registration Link Management
  const generateRegLink = useCallback(async (maxUses?: number, expiresInDays?: number) => {
    if (!currentUser || !isAdminRole(currentUser.role)) throw new Error('Admin only');
    const links = regLinksQuery.data ?? [];
    const code = generateId().slice(0, 8).toUpperCase();
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    
    // Generate QR data
    const qrData = JSON.stringify({
      adminId: currentUser.id,
      code,
      appUrl: 'aira://register',
    });

    const newLink: RegistrationLink = {
      id: generateId(),
      adminId: currentUser.id,
      code,
      qrData,
      createdAt: new Date().toISOString(),
      expiresAt,
      maxUses,
      usedCount: 0,
      active: true,
    };
    await saveRegLinks([...links, newLink]);
    return newLink;
  }, [currentUser, regLinksQuery.data, saveRegLinks]);

  const deactivateRegLink = useCallback(async (linkId: string) => {
    const links = regLinksQuery.data ?? [];
    const updated = links.map(l => 
      l.id === linkId ? { ...l, active: false } : l
    );
    await saveRegLinks(updated);
  }, [regLinksQuery.data, saveRegLinks]);

  const incrementLinkUsage = useCallback(async (code: string) => {
    const links = regLinksQuery.data ?? [];
    const updated = links.map(l => 
      l.code === code ? { ...l, usedCount: l.usedCount + 1 } : l
    );
    await saveRegLinks(updated);
  }, [regLinksQuery.data, saveRegLinks]);

  const validateRegCode = useCallback((code: string): string | null => {
    const links = regLinksQuery.data ?? [];
    const link = links.find(l => l.code === code && l.active);
    if (link) {
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) return null;
      if (link.maxUses && link.usedCount >= link.maxUses) return null;
      return link.adminId;
    }
    const inviteCodes = inviteCodesQuery.data ?? [];
    const invite = inviteCodes.find(ic => ic.code === code && ic.is_active && (ic.role ?? 'student') === 'student');
    if (invite) {
      if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return null;
      if (invite.maxUses && (invite.usedCount ?? 0) >= invite.maxUses) return null;
      return invite.adminId;
    }
    return null;
  }, [regLinksQuery.data, inviteCodesQuery.data]);

  const generateInviteCode = useCallback(async (role: InviteRole = 'student', expiresAt?: string, maxUses?: number): Promise<InviteCode> => {
    if (!currentUser || currentUser.role !== 'super_admin') throw new Error('Only Super Admin can generate admin invitation codes.');
    if (role !== 'admin' && role !== 'teacher') throw new Error('Choose Admin or Teacher.');
    const codes = inviteCodesQuery.data ?? [];
    let code = '';
    do {
      code = `AIRA-${role === 'teacher' ? 'T' : 'A'}-${generateId().slice(-8).toUpperCase()}`;
    } while (codes.some(item => item.code === code));
    const newCode: InviteCode = {
      id: generateId(),
      code,
      adminId: currentUser.id,
      role,
      is_active: true,
      createdAt: new Date().toISOString(),
      expiresAt,
      maxUses: maxUses && maxUses > 0 ? maxUses : undefined,
      usedCount: 0,
    };
    await saveInviteCodes([...codes, newCode]);
    return newCode;
  }, [currentUser, inviteCodesQuery.data, saveInviteCodes]);

  const deactivateInviteCode = useCallback(async (codeId: string) => {
    if (!currentUser || currentUser.role !== 'super_admin') throw new Error('Super Admin only');
    const codes = inviteCodesQuery.data ?? [];
    const updated = codes.map(code => code.id === codeId ? { ...code, is_active: false, deactivatedAt: new Date().toISOString() } : code);
    await saveInviteCodes(updated);
  }, [currentUser, inviteCodesQuery.data, saveInviteCodes]);

  const deleteInviteCode = useCallback(async (codeId: string) => {
    if (!currentUser || currentUser.role !== 'super_admin') throw new Error('Super Admin only');
    const codes = inviteCodesQuery.data ?? [];
    const target = codes.find(code => code.id === codeId);
    if (!target) return;
    if ((target.usedCount ?? 0) > 0) throw new Error('Used invitation codes cannot be deleted. Deactivate them instead.');
    await saveInviteCodes(codes.filter(code => code.id !== codeId));
  }, [currentUser, inviteCodesQuery.data, saveInviteCodes]);

  const validateAdminInviteCode = useCallback((code: string): InviteCode | null => {
    const normalized = code.trim().toUpperCase();
    const invite = (inviteCodesQuery.data ?? []).find(item => item.code === normalized && item.is_active && (item.role === 'admin' || item.role === 'teacher'));
    if (!invite) return null;
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return null;
    if (invite.maxUses && (invite.usedCount ?? 0) >= invite.maxUses) return null;
    return invite;
  }, [inviteCodesQuery.data]);

  const getAdminInviteCodes = useCallback(() => {
    if (!currentUser) return [];
    return currentUser.role === 'super_admin'
      ? (inviteCodesQuery.data ?? [])
      : (inviteCodesQuery.data ?? []).filter(code => code.adminId === currentUser.id && (code.role ?? 'student') === 'student');
  }, [currentUser, inviteCodesQuery.data]);

  // Student enrollment management
  const enrollStudentInSubject = useCallback(async (studentId: string, subjectId: string) => {
    const users = usersQuery.data ?? [];
    const student = users.find(u => u.id === studentId);
    if (!student) throw new Error('Student not found');
    
    const currentSubjects = student.subjectIds || [];
    if (currentSubjects.includes(subjectId)) return;
    
    const updatedUsers = users.map(u =>
      u.id === studentId 
        ? { ...u, subjectIds: [...currentSubjects, subjectId] }
        : u
    );
    await saveUsers(updatedUsers);
  }, [usersQuery.data, saveUsers]);

  const removeStudentFromSubject = useCallback(async (studentId: string, subjectId: string) => {
    const users = usersQuery.data ?? [];
    const student = users.find(u => u.id === studentId);
    if (!student) throw new Error('Student not found');
    
    const updatedUsers = users.map(u =>
      u.id === studentId 
        ? { ...u, subjectIds: (u.subjectIds || []).filter(id => id !== subjectId) }
        : u
    );
    await saveUsers(updatedUsers);
  }, [usersQuery.data, saveUsers]);

  const changeStudentSection = useCallback(async (studentId: string, sectionId: string | undefined) => {
    const users = usersQuery.data ?? [];
    const updatedUsers = users.map(u =>
      u.id === studentId ? { ...u, sectionId } : u
    );
    await saveUsers(updatedUsers);
  }, [usersQuery.data, saveUsers]);

  const editAdmin = useCallback(async (adminId: string, updates: Partial<User>) => {
    if (!currentUser || currentUser.role !== 'super_admin') throw new Error('Super Admin only');
    const target = (usersQuery.data ?? []).find(user => user.id === adminId && user.role === 'admin');
    if (!target) throw new Error('Admin account not found.');
    await saveUsers((usersQuery.data ?? []).map(user => user.id === adminId ? { ...user, ...updates, role: 'admin' as const } : user));
  }, [currentUser, usersQuery.data, saveUsers]);

  const archiveAdmin = useCallback(async (adminId: string) => {
    if (!currentUser || currentUser.role !== 'super_admin') throw new Error('Super Admin only');
    if (adminId === currentUser.id) throw new Error('You cannot deactivate your own account.');
    const target = (usersQuery.data ?? []).find(user => user.id === adminId && user.role === 'admin');
    if (!target) throw new Error('Admin account not found.');
    await saveUsers((usersQuery.data ?? []).map(user => user.id === adminId ? { ...user, archived: !user.archived } : user));
  }, [currentUser, usersQuery.data, saveUsers]);

  const deleteAdmin = useCallback(async (adminId: string) => {
    if (!currentUser || currentUser.role !== 'super_admin') throw new Error('Super Admin only');
    if (adminId === currentUser.id) throw new Error('You cannot delete your own account.');
    const target = (usersQuery.data ?? []).find(user => user.id === adminId && user.role === 'admin');
    if (!target) throw new Error('Admin account not found.');
    await saveUsers((usersQuery.data ?? []).filter(user => user.id !== adminId));
  }, [currentUser, usersQuery.data, saveUsers]);

  // Computed values
  const allUsers = usersQuery.data ?? [];
  const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');
  
  // Filter students by current admin
  const students = allUsers.filter(u => {
    if (u.role !== 'student') return false;
    if (u.archived) return false;
    if (currentUser?.role === 'super_admin') return true;
    if (currentUser?.role === 'admin') {
      return u.adminId === currentUser.id;
    }
    return true;
  });

  const archivedStudents = allUsers.filter(u => 
    u.role === 'student' && u.archived &&
    (currentUser?.role === 'super_admin' || currentUser?.role !== 'admin' || u.adminId === currentUser.id)
  );

  // Filter sections by current admin
  const sections = (sectionsQuery.data ?? []).filter(s => 
    currentUser?.role === 'super_admin' ? true :
    currentUser?.role === 'admin' ? s.adminId === currentUser.id : true
  );

  const allSubjects = subjectsQuery.data ?? [];
  const subjects = allSubjects.filter(subject => {
    if (currentUser?.role === 'super_admin') return !subject.archived;
    if (currentUser?.role === 'admin') {
      // Admins/Teachers only see subjects they own or adopted —
      // NOT Super Admin global/generic master subjects.
      // Global/Generic subjects are only visible via the adopt modal.
      const isOwn = subject.adminId === currentUser.id;
      return !subject.archived && isOwn;
    }
    // Students see subjects they're enrolled in
    return !subject.archived;
  });

  // Filter registration links by current admin
  const regLinks = (regLinksQuery.data ?? []).filter(l => 
    currentUser?.role === 'super_admin' ? true :
    currentUser?.role === 'admin' ? l.adminId === currentUser.id : true
  );

  const inviteCodes = (inviteCodesQuery.data ?? []).filter(c =>
    currentUser?.role === 'super_admin' ? true :
    currentUser?.role === 'admin' ? c.adminId === currentUser.id : true
  );

  useEffect(() => {
    if (!currentUser) {
      cloudAuthUserRef.current = null;
      setCloudAuthReady(false);
      return;
    }
    if (cloudAuthUserRef.current === currentUser.id) return;
    cloudAuthUserRef.current = currentUser.id;
    setCloudAuthReady(false);
    let cancelled = false;
    void pullCloudScope<AuthSnapshot>(currentUser.id, 'auth').then(async snapshot => {
      if (cancelled || !snapshot) return;
      const localUsers = usersQuery.data ?? [];
      const hydratedUsers = (snapshot.users ?? []).map(remoteUser => ({
        ...remoteUser,
        password: localUsers.find(localUser => localUser.id === remoteUser.id)?.password ?? (remoteUser.id === currentUser.id ? currentUser.password : ''),
      }));
      if (hydratedUsers.length > 0) await saveUsers(hydratedUsers);
      if (snapshot.sections) await saveSections(snapshot.sections);
      if (snapshot.subjects) await saveSubjects(snapshot.subjects.map(normalizeSubject));
      if (snapshot.regLinks) await saveRegLinks(snapshot.regLinks);
      if (snapshot.inviteCodes) await saveInviteCodes(snapshot.inviteCodes);
    }).catch(() => undefined).finally(() => {
      if (!cancelled) setCloudAuthReady(true);
    });
    return () => { cancelled = true; };
  }, [currentUser, usersQuery.data, saveUsers, saveSections, saveSubjects, saveRegLinks, saveInviteCodes]);

  useEffect(() => {
    if (!currentUser || !cloudAuthReady) return;
    const safeUsers = allUsers.map(user => ({ ...user, password: '' }));
    const snapshot: AuthSnapshot = { users: safeUsers, sections: sectionsQuery.data ?? [], subjects: allSubjects, regLinks: regLinksQuery.data ?? [], inviteCodes: inviteCodesQuery.data ?? [] };
    void pushCloudScope(currentUser.id, 'auth', snapshot).catch(() => undefined);
  }, [currentUser?.id, cloudAuthReady, allUsers, allSubjects, sectionsQuery.data, regLinksQuery.data, inviteCodesQuery.data]);

  const isLoading = usersQuery.isLoading || sectionsQuery.isLoading || 
                    subjectsQuery.isLoading || regLinksQuery.isLoading ||
                    currentUserQuery.isLoading || inviteCodesQuery.isLoading;

  return {
    currentUser,
    isInitialized,
    isLoading,
    allUsers,
    admins,
    students,
    archivedStudents,
    sections,
    subjects,
    regLinks,
    
    // Auth
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error?.message ?? null,
    loginPending: loginMutation.isPending,
    signup: signupMutation.mutateAsync,
    signupError: signupMutation.error?.message ?? null,
    signupPending: signupMutation.isPending,
    adminSignup: adminSignupMutation.mutateAsync,
    adminSignupError: adminSignupMutation.error?.message ?? null,
    adminSignupPending: adminSignupMutation.isPending,
    logout,
    updateProfile,
    resetPassword,
    
    // Student management
    resetStudentPassword,
    resetUserPassword,
    deleteStudent,
    archiveStudent,
    editStudent,
    
    // Section management
    addSection,
    editSection,
    deleteSection,
    archiveSection,
    
    // Subject management
    addSubject,
    editSubject,
    deleteSubject,
    archiveSubject,
    adoptSubject,
    unadoptSubject,
    getGlobalSubjects,
    getAdoptableSubjects,
    getAdoptedSubjects,
    getGenericSubjects,
    shareGenericSubject,
    revokeGenericShare,
    allSubjects,
    
    // Admin management
    editAdmin,
    archiveAdmin,
    deleteAdmin,

    // Registration links
    generateRegLink,
    deactivateRegLink,
    validateRegCode,
    incrementLinkUsage,
    
    // Invite codes
    inviteCodes,
    generateInviteCode,
    deactivateInviteCode,
    deleteInviteCode,
    validateAdminInviteCode,
    getAdminInviteCodes,
    
    // Student enrollment
    enrollStudentInSubject,
    removeStudentFromSubject,
    changeStudentSection,
  };
});
