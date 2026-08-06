export type GradeLevel = 'Grade 7' | 'Grade 8' | 'Grade 9' | 'Grade 10' | 'Grade 11' | 'Grade 12';

export type Semester = '1st Semester' | '2nd Semester' | '3rd Semester';

export type SubjectType = 'global' | 'generic' | 'adapted' | 'private';
export type InviteRole = 'admin' | 'teacher' | 'student';

export type Quarter = 'Quarter 1' | 'Quarter 2' | 'Quarter 3' | 'Quarter 4';

export const GRADE_LEVELS: GradeLevel[] = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export function getSemestersForGrade(grade: GradeLevel): Semester[] {
  const gradeNum = parseInt(grade.replace('Grade ', ''), 10);
  if (gradeNum >= 7 && gradeNum <= 10) {
    return ['1st Semester', '2nd Semester', '3rd Semester'];
  }
  return ['1st Semester', '2nd Semester'];
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: 'student' | 'admin' | 'super_admin';
  profileImage?: string;
  themePreference: 'light' | 'dark' | 'auto';
  createdAt: string;
  archived?: boolean;
  adminId?: string;
  sectionId?: string;
  subjectIds?: string[];
  is_verified: boolean;
  gradeLevel?: GradeLevel;
  schoolOrganization?: string;
  accountType?: 'admin' | 'teacher';
}

export interface Section {
  id: string;
  adminId: string;
  name: string;
  description: string;
  createdAt: string;
  archived?: boolean;
  gradeLevel?: GradeLevel;
}

export interface Subject {
  id: string;
  adminId: string;
  name: string;
  description: string;
  code: string;
  createdAt: string;
  archived?: boolean;
  unlockType: 'sequential' | 'flexible';
  createdBy?: 'super_admin' | 'admin';
  /** The ownership model for this subject. Legacy records use isGlobal. */
  subjectType?: SubjectType;
  isGlobal?: boolean;
  adoptedBy?: string[];
  sharedWithAdminIds?: string[];
  adaptedFromSubjectId?: string;
  sourceSubjectId?: string;
  organizationId?: string;
  gradeLevel?: GradeLevel;
  semester?: Semester;
}

export interface RegistrationLink {
  id: string;
  adminId: string;
  code: string;
  qrData: string;
  createdAt: string;
  expiresAt?: string;
  maxUses?: number;
  usedCount: number;
  active: boolean;
}

export interface COC {
  id: string;
  subjectId: string;
  adminId: string;
  title: string;
  description: string;
  order: number;
  createdAt: string;
  archived?: boolean;
}

export interface LearningOutcome {
  id: string;
  cocId: string;
  subjectId: string;
  adminId: string;
  title: string;
  description: string;
  performanceCriteria: string[];
  order: number;
  createdAt: string;
  archived?: boolean;
}

export type ContentType = 'text' | 'youtube' | 'pdf' | 'ppt' | 'doc' | 'image' | 'video';

export interface VideoMetadata {
  duration?: number;
  thumbnail?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface Content {
  id: string;
  loId: string;
  cocId: string;
  subjectId: string;
  adminId: string;
  type: ContentType;
  title: string;
  content: string;
  order: number;
  createdAt: string;
  archived?: boolean;
  updatedAt?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  videoMetadata?: VideoMetadata;
}

export type QuizScheduleStatus = 'upcoming' | 'available' | 'closed';

export interface QuizSchedule {
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  isExtendable: boolean;
  updatedAt?: string;
}

export interface SubtitleTrack {
  id: string;
  url: string;
  label: string;
  language: string;
}

export type VideoSourceMode = 'online' | 'offline' | 'cached' | 'unknown';

export interface Quiz {
  id: string;
  loId: string;
  cocId: string;
  subjectId: string;
  adminId: string;
  title: string;
  description: string;
  passingScore: number;
  timeLimit?: number;
  createdAt: string;
  archived?: boolean;
  schedule?: QuizSchedule;
}

export interface Question {
  id: string;
  quizId: string;
  loId: string;
  subjectId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  image?: string;
  order: number;
  createdAt: string;
  archived?: boolean;
}

export interface StudentProgress {
  userId: string;
  loId: string;
  cocId: string;
  subjectId: string;
  score: number;
  passed: boolean;
  attempts: number;
  lastAttemptDate?: string;
  completionDate?: string;
  status: LOStatus;
  unlockedAt?: string;
  totalItems?: number;
  lessonMarkedDone?: boolean;
  lessonDoneAt?: string;
  lessonUndoneAt?: string;
}

export interface QuizAttempt {
  id: string;
  studentId: string;
  quizId: string;
  loId: string;
  subjectId: string;
  score: number;
  totalItems: number;
  attemptCount: number;
  isPassed: boolean;
  quarter?: Quarter;
  createdAt: string;
  timeTakenMs?: number;
  answers?: Record<string, number>;
  reviewed?: boolean;
}

export interface Activity {
  id: string;
  studentId: string;
  adminId: string;
  subjectId: string;
  loId: string;
  type: 'performance_task';
  score: number;
  maxScore: number;
  quarter?: Quarter;
  remarks?: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  userId: string;
  loId: string;
  subjectId: string;
  type: 'link' | 'document' | 'video';
  name: string;
  url: string;
  submittedAt: string;
  validated: boolean;
  validatedAt?: string;
  validatedBy?: string;
  grade?: number;
  maxGrade?: number;
  gradeRemarks?: string;
}

export type LOStatus = 'locked' | 'available' | 'in_progress' | 'completed';
export type TopicStatus = LOStatus;

export interface QuizResult {
  score: number;
  total: number;
  passed: boolean;
  percentage: number;
}

export interface SignupData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  profileImage?: string;
  adminId?: string;
  sectionId?: string;
  subjectIds?: string[];
  gradeLevel?: GradeLevel;
}

export interface AdminSignupData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  invitationCode?: string;
  schoolOrganization?: string;
  accountType?: 'admin' | 'teacher';
}

export interface OTPCode {
  email: string;
  code: string;
  expires_at: string;
  attempts?: number;
  lockedUntil?: string;
  resendAvailableAt?: string;
}

export interface PlaybackPosition {
  userId: string;
  contentId: string;
  position: number;
  duration: number;
  updatedAt: string;
}

export type QuizViolationType = 'tab_switch' | 'window_exit' | 'window_blur';

export interface QuizViolation {
  id: string;
  studentId: string;
  studentName: string;
  quizId: string;
  loId: string;
  subjectId: string;
  type: QuizViolationType;
  questionIndex: number;
  timestamp: string;
  acknowledged?: boolean;
}

export interface DocumentProgress {
  userId: string;
  contentId: string;
  scrollPercent: number;
  isRead: boolean;
  updatedAt: string;
}

export interface QuizLock {
  id: string;
  studentId: string;
  quizId: string;
  loId: string;
  subjectId: string;
  lockedAt: string;
  unlockAt: string;
  violationCount: number;
}

export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncEntityType = 'coc' | 'lo' | 'content' | 'quiz' | 'question' | 'progress' | 'submission' | 'announcement' | 'adminCheck' | 'activity' | 'quizAttempt' | 'user' | 'section' | 'subject' | 'regLink' | 'inviteCode' | 'fileUpload' | 'quizViolation' | 'docProgress' | 'playbackPosition';

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  operationType: SyncOperationType;
  entityId: string;
  data?: unknown;
  timestamp: string;
  retries: number;
  maxRetries: number;
  scope: 'auth' | 'data';
  fileUri?: string;
  fileName?: string;
  contentType?: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  createdAt: string;
}

export interface InviteCode {
  id: string;
  code: string;
  adminId: string;
  role?: InviteRole;
  is_active: boolean;
  createdAt: string;
  expiresAt?: string;
  maxUses?: number;
  usedCount?: number;
  usedAt?: string;
  deactivatedAt?: string;
}

export type AnnouncementTargetType = 'all' | 'admins' | 'students' | 'specific' | 'my_students';
export type AnnouncementPriority = 'normal' | 'important';

export type AnnouncementScope = 'global' | 'admin_students' | 'targeted';

export interface Announcement {
  id: string;
  adminId: string;
  title: string;
  message: string;
  createdAt: string;
  updatedAt?: string;
  archived?: boolean;
  targetType?: AnnouncementTargetType;
  targetIds?: string[];
  targetAdminIds?: string[];
  targetStudentIds?: string[];
  targetSectionIds?: string[];
  targetGradeLevels?: GradeLevel[];
  scope?: AnnouncementScope;
  targetRole?: 'all' | 'admins' | 'students';
  isEditable?: boolean;
  priority?: AnnouncementPriority;
  attachmentUrl?: string;
  attachmentName?: string;
  pinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
}

export interface AdminProgressCheck {
  id: string;
  adminId: string;
  userId: string;
  loId: string;
  subjectId: string;
  checked: boolean;
  checkedAt?: string;
  notes?: string;
}

export interface StudentFilters {
  sectionId?: string;
  subjectId?: string;
  searchQuery?: string;
}

export interface ContentFilters {
  subjectId?: string;
  cocId?: string;
  loId?: string;
}

export type QuizDisplayStatus = 'completed' | 'not_started' | 'in_progress' | 'missed';

export type NotificationType = 'announcement' | 'lesson_uploaded' | 'quiz_available' | 'deadline_approaching' | 'grade_released';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedId?: string;
  subjectId?: string;
  subjectCode?: string;
  actorId?: string;
  actorName?: string;
}

export interface UserActivityLog {
  id: string;
  userId: string;
  action: string;
  description: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

// ===== Messaging Types =====

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type MessageAttachmentType = 'image' | 'file' | 'video';

export interface MessageAttachment {
  id: string;
  type: MessageAttachmentType;
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

export interface ChatReaction {
  emoji: string;
  userId: string;
  timestamp: string;
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  thumbnail?: string;
  siteName?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: User['role'];
  senderProfileImage?: string;
  text: string;
  attachments?: MessageAttachment[];
  createdAt: string;
  deliveryStatus: MessageDeliveryStatus;
  readBy?: string[];
  edited?: boolean;
  editedAt?: string;
  deleted?: boolean;
  replyToId?: string;
  replyToText?: string;
  reactions?: ChatReaction[];
  linkPreview?: LinkPreview;
  pinned?: boolean;
}

export interface ConversationSettings {
  backgroundColor?: string;
  wallpaperImage?: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participantInfo: ConversationParticipant[];
  lastMessageText: string;
  lastMessageAt: string;
  lastMessageSenderId: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  archivedBy?: string[];
  deletedBy?: string[];
  organizationId?: string;
  isGroup?: boolean;
  groupName?: string;
  groupAvatar?: string;
  adminIds?: string[];
  sectionId?: string;
  pinnedMessageIds?: string[];
  mutedBy?: string[];
  settings?: ConversationSettings;
}

export interface ConversationParticipant {
  userId: string;
  fullName: string;
  role: User['role'];
  profileImage?: string;
  isOnline?: boolean;
  lastActiveAt?: string;
  isAdmin?: boolean;
  isMuted?: boolean;
}

export interface ChatContact {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
  matchedUserId?: string;
}

export type ChatConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export type ChatPresenceStatus = 'online' | 'offline' | 'away';

export interface ChatPresence {
  userId: string;
  status: ChatPresenceStatus;
  lastActiveAt: string;
}

export interface ChatTypingIndicator {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  timestamp: string;
}

export interface ChatSearchResult {
  conversationId: string;
  messageId: string;
  text: string;
  senderName: string;
  createdAt: string;
}

// WebSocket message types for chat
export type ChatWSEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'message_update'; message: ChatMessage }
  | { type: 'message_delete'; messageId: string; conversationId: string }
  | { type: 'typing'; conversationId: string; userId: string; isTyping: boolean }
  | { type: 'presence'; userId: string; status: ChatPresenceStatus; lastActiveAt: string }
  | { type: 'conversation_update'; conversation: Conversation }
  | { type: 'read_receipt'; conversationId: string; messageIds: string[]; readBy: string }
  | { type: 'history'; conversationId: string; messages: ChatMessage[] }
  | { type: 'conversations'; conversations: Conversation[] }
  | { type: 'error'; error: string }
  | { type: 'connected'; userId: string }
  | { type: 'reaction'; conversationId: string; messageId: string; reactions: ChatReaction[] }
  | { type: 'member_added'; conversationId: string; participant: ConversationParticipant }
  | { type: 'member_removed'; conversationId: string; userId: string }
  | { type: 'pinned_message'; conversationId: string; messageId: string; pinned: boolean }
  | { type: 'settings_update'; conversationId: string; settings: ConversationSettings };

export interface ProgressChartData {
  student: {
    id: string;
    fullName: string;
    profileImage?: string;
  };
  learningOutcomes: {
    loId: string;
    cocId: string;
    status: LOStatus;
    score?: number;
    passed: boolean;
    validated: boolean;
  }[];
}
