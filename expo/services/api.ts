/**
 * Offline-first REST API client for AIRA LMS.
 *
 * Every method writes to AsyncStorage first (instant local update),
 * then attempts to sync to the backend API if online.
 * When offline, operations are enqueued in the sync queue
 * and flushed automatically when connectivity restores.
 *
 * Entity endpoints (all under /v1/api):
 *   subjects, sections, users, cocs, learning-outcomes, content,
 *   quizzes, questions, progress, submissions, announcements,
 *   activities, quiz-attempts, notifications, quiz-violations,
 *   quiz-locks, document-progress, admin-checks, activity-logs,
 *   invite-codes, playback-positions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueSync } from './syncQueue';
import { getSessionToken } from './cloudSync';
import type { SyncEntityType } from '@/types';

const FUNCTIONS_URL = (process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL ?? '').replace(/\/$/, '');
const API_PREFIX = '/v1/api';

/** Maps client entity names to API endpoint paths */
const ENTITY_ENDPOINTS: Record<string, string> = {
  subjects: 'subjects',
  sections: 'sections',
  users: 'users',
  cocs: 'cocs',
  learningOutcomes: 'learning-outcomes',
  content: 'content',
  quizzes: 'quizzes',
  questions: 'questions',
  progress: 'progress',
  submissions: 'submissions',
  announcements: 'announcements',
  activities: 'activities',
  quizAttempts: 'quiz-attempts',
  notifications: 'notifications',
  quizViolations: 'quiz-violations',
  quizLocks: 'quiz-locks',
  documentProgress: 'document-progress',
  adminChecks: 'admin-checks',
  activityLogs: 'activity-logs',
  inviteCodes: 'invite-codes',
  playbackPositions: 'playback-positions',
};

/** Maps API entity keys to SyncEntityType values for the sync queue */
const SYNC_ENTITY_MAP: Record<string, SyncEntityType> = {
  subjects: 'subject',
  sections: 'section',
  users: 'user',
  cocs: 'coc',
  learningOutcomes: 'lo',
  content: 'content',
  quizzes: 'quiz',
  questions: 'question',
  progress: 'progress',
  submissions: 'submission',
  announcements: 'announcement',
  activities: 'activity',
  quizAttempts: 'quizAttempt',
  notifications: 'announcement',
  quizViolations: 'quizViolation',
  quizLocks: 'quizViolation',
  documentProgress: 'docProgress',
  adminChecks: 'adminCheck',
  activityLogs: 'activity',
  inviteCodes: 'inviteCode',
  playbackPositions: 'playbackPosition',
};

/** AsyncStorage key prefix for each entity collection */
const STORAGE_PREFIX = 'aira_api_';

function apiUrl(path: string): string {
  return `${FUNCTIONS_URL}${API_PREFIX}${path}`;
}

async function authHeaders(userId?: string): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'X-School-Session': token } : {}),
    ...(userId ? { 'X-School-User-Id': userId } : {}),
  };
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try { return await response.json() as Record<string, unknown>; } catch { return {}; }
}

/** Check if we have a backend URL and token (i.e., cloud is reachable) */
async function isCloudAvailable(): Promise<boolean> {
  if (!FUNCTIONS_URL) return false;
  const token = await getSessionToken();
  return Boolean(token);
}

// ============================================================
//  Local storage helpers
// ============================================================

async function getLocalCollection<T>(entity: string): Promise<T[]> {
  const key = `${STORAGE_PREFIX}${entity}`;
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return [];
  try { return JSON.parse(stored) as T[]; } catch { return []; }
}

async function saveLocalCollection<T>(entity: string, items: T[]): Promise<void> {
  const key = `${STORAGE_PREFIX}${entity}`;
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

async function upsertLocal<T extends Record<string, unknown>>(entity: string, item: T): Promise<T[]> {
  const items = await getLocalCollection<T>(entity);
  const id = item.id as string;
  const idx = items.findIndex(i => (i as Record<string, unknown>)['id'] === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...item };
  } else {
    items.push(item);
  }
  await saveLocalCollection(entity, items);
  return items;
}

async function deleteLocal<T extends Record<string, unknown>>(entity: string, id: string): Promise<T[]> {
  const items = await getLocalCollection<T>(entity);
  const filtered = items.filter(i => (i as Record<string, unknown>)['id'] !== id);
  await saveLocalCollection(entity, filtered);
  return filtered;
}

// ============================================================
//  Public API — Generic CRUD
// ============================================================

/**
 * Fetch all items for an entity from the cloud.
 * Falls back to local storage when offline.
 * Updates local cache on success.
 */
export async function fetchEntities<T extends Record<string, unknown>>(
  entity: keyof typeof ENTITY_ENDPOINTS,
  userId: string,
  filters?: Record<string, string>,
): Promise<T[]> {
  const endpoint = ENTITY_ENDPOINTS[entity];
  const cloudAvailable = await isCloudAvailable();

  if (cloudAvailable) {
    try {
      const params = new URLSearchParams(filters ?? {});
      const response = await fetch(`${apiUrl(`/${endpoint}?${params.toString()}`)}`, {
        headers: await authHeaders(userId),
      });
      if (response.ok) {
        const payload = await safeJson(response);
        const data = (payload.data as T[] | undefined) ?? [];
        await saveLocalCollection(entity, data);
        return data;
      }
    } catch {
      // Network error — fall through to local
    }
  }

  // Offline or cloud unavailable — read from local
  let items = await getLocalCollection<T>(entity);
  if (filters) {
    items = items.filter(item =>
      Object.entries(filters).every(([key, value]) => String(item[key] ?? '') === value),
    );
  }
  return items;
}

/**
 * Fetch a single item by ID. Tries cloud first, falls back to local.
 */
export async function fetchEntity<T extends Record<string, unknown>>(
  entity: keyof typeof ENTITY_ENDPOINTS,
  userId: string,
  id: string,
): Promise<T | null> {
  const endpoint = ENTITY_ENDPOINTS[entity];
  const cloudAvailable = await isCloudAvailable();

  if (cloudAvailable) {
    try {
      const response = await fetch(`${apiUrl(`/${endpoint}/${id}`)}`, {
        headers: await authHeaders(userId),
      });
      if (response.ok) {
        const payload = await safeJson(response);
        const data = payload.data as T | undefined;
        if (data) {
          await upsertLocal(entity, data);
          return data;
        }
      }
    } catch {
      // Fall through to local
    }
  }

  // Local fallback
  const items = await getLocalCollection<T>(entity);
  return items.find(i => (i as Record<string, unknown>)['id'] === id) ?? null;
}

/**
 * Create or update an entity. Writes locally first, then syncs to cloud.
 * When offline, the operation is enqueued for later sync.
 */
export async function upsertEntity<T extends Record<string, unknown>>(
  entity: keyof typeof ENTITY_ENDPOINTS,
  userId: string,
  item: T,
): Promise<T> {
  // 1. Write to local storage immediately
  const enriched = { ...item, updatedAt: new Date().toISOString() } as T;
  if (!(enriched as Record<string, unknown>)['createdAt']) {
    (enriched as Record<string, unknown>)['createdAt'] = new Date().toISOString();
  }
  await upsertLocal(entity, enriched);

  // 2. Enqueue for sync queue (works with existing sync infrastructure)
  const entityId = (enriched as Record<string, unknown>)['id'] as string;
  await enqueueSync(SYNC_ENTITY_MAP[entity] ?? 'content', 'create', entityId, enriched, 'data');

  // 3. Try immediate cloud sync if online
  const cloudAvailable = await isCloudAvailable();
  if (cloudAvailable) {
    const endpoint = ENTITY_ENDPOINTS[entity];
    try {
      const response = await fetch(`${apiUrl(`/${endpoint}/${entityId}`)}`, {
        method: 'PUT',
        headers: await authHeaders(userId),
        body: JSON.stringify(enriched),
      });
      if (response.ok) {
        const payload = await safeJson(response);
        const cloudData = payload.data as T | undefined;
        if (cloudData) {
          // Update local with server-returned data (may include server-generated fields)
          await upsertLocal(entity, cloudData);
          return cloudData;
        }
      }
    } catch {
      // Network error — item is already saved locally and enqueued
    }
  }

  return enriched;
}

/**
 * Partially update an entity. Merges with existing local record,
 * then syncs the merged result to cloud.
 */
export async function patchEntity<T extends Record<string, unknown>>(
  entity: keyof typeof ENTITY_ENDPOINTS,
  userId: string,
  id: string,
  patch: Partial<T>,
): Promise<T | null> {
  // 1. Merge with existing local record
  const items = await getLocalCollection<T>(entity);
  const existing = items.find(i => (i as Record<string, unknown>)['id'] === id);
  if (!existing) return null;

  const merged = { ...existing, ...patch, updatedAt: new Date().toISOString() } as T;
  await upsertLocal(entity, merged);

  // 2. Enqueue for sync
  await enqueueSync(SYNC_ENTITY_MAP[entity] ?? 'content', 'update', id, merged, 'data');

  // 3. Try cloud sync
  const cloudAvailable = await isCloudAvailable();
  if (cloudAvailable) {
    const endpoint = ENTITY_ENDPOINTS[entity];
    try {
      const response = await fetch(`${apiUrl(`/${endpoint}/${id}`)}`, {
        method: 'PATCH',
        headers: await authHeaders(userId),
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const payload = await safeJson(response);
        const cloudData = payload.data as T | undefined;
        if (cloudData) {
          await upsertLocal(entity, cloudData);
          return cloudData;
        }
      }
    } catch {
      // Already saved locally and enqueued
    }
  }

  return merged;
}

/**
 * Delete an entity. Removes from local storage immediately,
 * then attempts cloud deletion. Enqueues for sync if offline.
 */
export async function deleteEntity(
  entity: keyof typeof ENTITY_ENDPOINTS,
  userId: string,
  id: string,
): Promise<boolean> {
  // 1. Delete locally
  await deleteLocal<Record<string, unknown>>(entity, id);

  // 2. Enqueue for sync
  await enqueueSync(SYNC_ENTITY_MAP[entity] ?? 'content', 'delete', id, undefined, 'data');

  // 3. Try cloud delete
  const cloudAvailable = await isCloudAvailable();
  if (cloudAvailable) {
    const endpoint = ENTITY_ENDPOINTS[entity];
    try {
      const response = await fetch(`${apiUrl(`/${endpoint}/${id}`)}`, {
        method: 'DELETE',
        headers: await authHeaders(userId),
      });
      return response.ok || response.status === 404;
    } catch {
      // Already deleted locally and enqueued
    }
  }

  return true;
}

/**
 * Bulk sync an entire entity collection from the cloud.
 * Replaces local storage with cloud data.
 * Useful for initial load or manual refresh.
 */
export async function syncEntityFromCloud<T extends Record<string, unknown>>(
  entity: keyof typeof ENTITY_ENDPOINTS,
  userId: string,
): Promise<T[]> {
  const endpoint = ENTITY_ENDPOINTS[entity];
  const cloudAvailable = await isCloudAvailable();

  if (!cloudAvailable) {
    return getLocalCollection<T>(entity);
  }

  try {
    const response = await fetch(`${apiUrl(`/${endpoint}`)}`, {
      headers: await authHeaders(userId),
    });
    if (response.ok) {
      const payload = await safeJson(response);
      const data = (payload.data as T[] | undefined) ?? [];
      await saveLocalCollection(entity, data);
      return data;
    }
  } catch {
    // Fall through to local
  }

  return getLocalCollection<T>(entity);
}

/**
 * Bulk push an entire entity collection to the cloud.
 * Replaces cloud data with the provided items.
 */
export async function bulkPushEntity<T extends Record<string, unknown>>(
  entity: keyof typeof ENTITY_ENDPOINTS,
  userId: string,
  items: T[],
): Promise<boolean> {
  // Save locally first
  await saveLocalCollection(entity, items);

  const cloudAvailable = await isCloudAvailable();
  if (!cloudAvailable) return false;

  const endpoint = ENTITY_ENDPOINTS[entity];
  try {
    const response = await fetch(`${apiUrl(`/${endpoint}/bulk`)}`, {
      method: 'POST',
      headers: await authHeaders(userId),
      body: JSON.stringify(items),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the count of items in a collection (from local storage).
 */
export async function getLocalEntityCount(entity: keyof typeof ENTITY_ENDPOINTS): Promise<number> {
  const items = await getLocalCollection(entity);
  return items.length;
}

/**
 * Clear a local entity collection (does not affect cloud).
 */
export async function clearLocalEntity(entity: keyof typeof ENTITY_ENDPOINTS): Promise<void> {
  await saveLocalCollection(entity, []);
}

/**
 * Check API health (returns true if backend is reachable).
 */
export async function checkApiHealth(): Promise<boolean> {
  if (!FUNCTIONS_URL) return false;
  try {
    const response = await fetch(`${apiUrl('/health')}`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get all available entity endpoints (for introspection/debugging).
 */
export function getAvailableEntities(): string[] {
  return Object.keys(ENTITY_ENDPOINTS);
}

// ============================================================
//  Typed convenience wrappers for common entities
// ============================================================

export const ApiClient = {
  // Subjects
  fetchSubjects: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('subjects', userId, filters),
  upsertSubject: (userId: string, subject: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('subjects', userId, subject),
  deleteSubject: (userId: string, id: string) =>
    deleteEntity('subjects', userId, id),

  // Sections
  fetchSections: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('sections', userId, filters),
  upsertSection: (userId: string, section: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('sections', userId, section),
  deleteSection: (userId: string, id: string) =>
    deleteEntity('sections', userId, id),

  // Users
  fetchUsers: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('users', userId, filters),
  upsertUser: (userId: string, user: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('users', userId, user),

  // COCs
  fetchCOCs: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('cocs', userId, filters),
  upsertCOC: (userId: string, coc: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('cocs', userId, coc),
  deleteCOC: (userId: string, id: string) =>
    deleteEntity('cocs', userId, id),

  // Learning Outcomes
  fetchLOs: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('learningOutcomes', userId, filters),
  upsertLO: (userId: string, lo: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('learningOutcomes', userId, lo),
  deleteLO: (userId: string, id: string) =>
    deleteEntity('learningOutcomes', userId, id),

  // Content
  fetchContent: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('content', userId, filters),
  upsertContent: (userId: string, content: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('content', userId, content),
  deleteContent: (userId: string, id: string) =>
    deleteEntity('content', userId, id),

  // Quizzes
  fetchQuizzes: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('quizzes', userId, filters),
  upsertQuiz: (userId: string, quiz: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('quizzes', userId, quiz),
  deleteQuiz: (userId: string, id: string) =>
    deleteEntity('quizzes', userId, id),

  // Questions
  fetchQuestions: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('questions', userId, filters),
  upsertQuestion: (userId: string, question: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('questions', userId, question),
  deleteQuestion: (userId: string, id: string) =>
    deleteEntity('questions', userId, id),

  // Progress
  fetchProgress: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('progress', userId, filters),
  upsertProgress: (userId: string, progress: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('progress', userId, progress),

  // Submissions
  fetchSubmissions: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('submissions', userId, filters),
  upsertSubmission: (userId: string, submission: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('submissions', userId, submission),

  // Announcements
  fetchAnnouncements: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('announcements', userId, filters),
  upsertAnnouncement: (userId: string, announcement: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('announcements', userId, announcement),
  deleteAnnouncement: (userId: string, id: string) =>
    deleteEntity('announcements', userId, id),

  // Quiz Attempts
  fetchQuizAttempts: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('quizAttempts', userId, filters),
  upsertQuizAttempt: (userId: string, attempt: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('quizAttempts', userId, attempt),

  // Notifications
  fetchNotifications: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('notifications', userId, filters),
  upsertNotification: (userId: string, notification: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('notifications', userId, notification),
  deleteNotification: (userId: string, id: string) =>
    deleteEntity('notifications', userId, id),

  // Activities
  fetchActivities: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('activities', userId, filters),
  upsertActivity: (userId: string, activity: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('activities', userId, activity),

  // Invite Codes
  fetchInviteCodes: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('inviteCodes', userId, filters),
  upsertInviteCode: (userId: string, code: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('inviteCodes', userId, code),

  // Activity Logs
  fetchActivityLogs: (userId: string, filters?: Record<string, string>) =>
    fetchEntities<Record<string, unknown>>('activityLogs', userId, filters),
  upsertActivityLog: (userId: string, log: Record<string, unknown>) =>
    upsertEntity<Record<string, unknown>>('activityLogs', userId, log),

  // Generic
  fetchEntities,
  fetchEntity,
  upsertEntity,
  patchEntity,
  deleteEntity,
  syncEntityFromCloud,
  bulkPushEntity,
  getLocalEntityCount,
  clearLocalEntity,
  checkApiHealth,
  getAvailableEntities,
};
