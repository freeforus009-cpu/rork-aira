import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/types';

export type CloudScope = 'auth' | 'data';
export type CloudSyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

const SESSION_TOKEN_KEY = 'aira_session_token';
const REVISION_PREFIX = 'aira_cloud_revision_';
const FUNCTIONS_URL = (process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL ?? '').replace(/\/$/, '');

function endpoint(path: string): string {
  return `${FUNCTIONS_URL}${path}`;
}

function headers(userId?: string, token?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'X-School-User-Id': userId } : {}),
    ...(token ? { 'X-School-Session': token } : {}),
  };
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try { return await response.json() as Record<string, unknown>; } catch (error) { return {}; }
}

export async function getSessionToken(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_TOKEN_KEY);
}

export async function clearCloudSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
}

export async function establishCloudSession(userId: string | undefined, identifier: string, password: string, profile?: User): Promise<User | null> {
  if (!FUNCTIONS_URL) return null;
  const response = await fetch(endpoint('/v1/auth/session'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ userId, identifier, password, profile }),
  });
  const payload = await safeJson(response);
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Cloud session could not be established.');
  if (typeof payload.token === 'string') await AsyncStorage.setItem(SESSION_TOKEN_KEY, payload.token);
  return (payload.profile as User | undefined) ?? null;
}

export async function revokeCloudSession(): Promise<void> {
  if (!FUNCTIONS_URL) return;
  const token = await getSessionToken();
  if (token) {
    await fetch(endpoint('/v1/auth/revoke'), { method: 'POST', headers: headers(undefined, token), body: JSON.stringify({ token }) }).catch(() => undefined);
  }
  await clearCloudSession();
}

export async function pullCloudScope<T>(userId: string, scope: CloudScope): Promise<T | null> {
  if (!FUNCTIONS_URL) return null;
  const token = await getSessionToken();
  if (!token) return null;
  const response = await fetch(`${endpoint(`/v1/sync/snapshot?scope=${scope}`)}`, { headers: headers(userId, token) });
  if (!response.ok) throw new Error('Cloud snapshot could not be loaded.');
  const payload = await safeJson(response);
  if (typeof payload.revision === 'number') await AsyncStorage.setItem(`${REVISION_PREFIX}${scope}`, String(payload.revision));
  return (payload.data as T | null) ?? null;
}

export async function pushCloudScope<T>(userId: string, scope: CloudScope, data: T): Promise<boolean> {
  if (!FUNCTIONS_URL) return false;
  const token = await getSessionToken();
  if (!token) return false;
  const storedRevision = await AsyncStorage.getItem(`${REVISION_PREFIX}${scope}`);
  const baseRevision = storedRevision ? Number.parseInt(storedRevision, 10) : 0;
  const response = await fetch(endpoint('/v1/sync/snapshot'), {
    method: 'PUT',
    headers: headers(userId, token),
    body: JSON.stringify({ scope, data, baseRevision: Number.isFinite(baseRevision) ? baseRevision : 0 }),
  });
  const payload = await safeJson(response);
  if (response.status === 409) {
    if (typeof payload.revision === 'number') await AsyncStorage.setItem(`${REVISION_PREFIX}${scope}`, String(payload.revision));
    return false;
  }
  if (!response.ok) throw new Error('Cloud snapshot could not be saved.');
  if (typeof payload.revision === 'number') await AsyncStorage.setItem(`${REVISION_PREFIX}${scope}`, String(payload.revision));
  return true;
}

export async function openCloudRealtime(userId: string, scope: CloudScope, onSnapshot: (data: unknown, revision: number) => void): Promise<WebSocket | null> {
  if (!FUNCTIONS_URL) return null;
  const token = await getSessionToken();
  if (!token) return null;
  const socketUrl = `${FUNCTIONS_URL.replace(/^http/, 'ws')}/v1/sync/realtime?scope=${encodeURIComponent(scope)}&userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
  const socket = new WebSocket(socketUrl);
  socket.onmessage = event => {
    try {
      const message = JSON.parse(String(event.data)) as { type?: string; data?: unknown; revision?: number };
      if (message.type === 'snapshot' && typeof message.revision === 'number') onSnapshot(message.data, message.revision);
    } catch (error) { console.log('[CloudSync] Ignored malformed realtime message'); }
  };
  socket.onerror = () => console.log('[CloudSync] Realtime connection unavailable');
  return socket;
}

export async function uploadLocalFile(uri: string, fileName: string, contentType: string, userId: string, onProgress?: (progress: number) => void): Promise<{ id: string; url: string } | null> {
  const token = await getSessionToken();
  if (!FUNCTIONS_URL || !token) return null;
  const localResponse = await fetch(uri);
  const bytes = await localResponse.arrayBuffer();
  const totalBytes = bytes.byteLength;
  const response = await fetch(endpoint('/v1/uploads'), { method: 'POST', headers: { 'Content-Type': contentType, 'X-File-Name': fileName, 'X-School-User-Id': userId, 'X-School-Session': token }, body: bytes });
  const payload = await safeJson(response);
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'File upload failed.');
  const upload = payload.upload as { id?: string; url?: string } | undefined;
  if (!upload?.id || !upload.url) return null;
  const protectedUrl = await getProtectedFileUrl(upload.id);
  if (onProgress) onProgress(1);
  return { id: upload.id, url: protectedUrl ?? endpoint(upload.url) };
}

const PLAYBACK_POSITIONS_KEY = 'aira_playback_positions';
const PLAYBACK_CLOUD_KEY = 'aira_playback_cloud_synced';

export async function savePlaybackPosition(userId: string, contentId: string, position: number, duration: number): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(PLAYBACK_POSITIONS_KEY);
    const positions: Array<{ userId: string; contentId: string; position: number; duration: number; updatedAt: string }> = stored ? JSON.parse(stored) : [];
    const filtered = positions.filter(p => !(p.userId === userId && p.contentId === contentId));
    filtered.push({ userId, contentId, position, duration, updatedAt: new Date().toISOString() });
    await AsyncStorage.setItem(PLAYBACK_POSITIONS_KEY, JSON.stringify(filtered));
    // Also push to cloud if online
    void syncPlaybackPositionToCloud(userId, contentId, position, duration);
  } catch (error) {
    console.log('[CloudSync] Failed to save playback position');
  }
}

export async function getPlaybackPosition(userId: string, contentId: string): Promise<{ position: number; duration: number } | null> {
  try {
    // Try cloud first if we have a session
    const cloudPos = await fetchPlaybackPositionFromCloud(userId, contentId);
    if (cloudPos) {
      // Update local cache from cloud
      const stored = await AsyncStorage.getItem(PLAYBACK_POSITIONS_KEY);
      const positions: Array<{ userId: string; contentId: string; position: number; duration: number; updatedAt: string }> = stored ? JSON.parse(stored) : [];
      const filtered = positions.filter(p => !(p.userId === userId && p.contentId === contentId));
      filtered.push({ userId, contentId, ...cloudPos, updatedAt: new Date().toISOString() });
      await AsyncStorage.setItem(PLAYBACK_POSITIONS_KEY, JSON.stringify(filtered));
      return cloudPos;
    }
    // Fall back to local
    const stored = await AsyncStorage.getItem(PLAYBACK_POSITIONS_KEY);
    if (!stored) return null;
    const positions: Array<{ userId: string; contentId: string; position: number; duration: number }> = JSON.parse(stored);
    const found = positions.find(p => p.userId === userId && p.contentId === contentId);
    return found ? { position: found.position, duration: found.duration } : null;
  } catch {
    return null;
  }
}

async function syncPlaybackPositionToCloud(userId: string, contentId: string, position: number, duration: number): Promise<void> {
  if (!FUNCTIONS_URL) return;
  const token = await getSessionToken();
  if (!token) return;
  try {
    await fetch(endpoint('/v1/sync/playback'), {
      method: 'POST',
      headers: headers(userId, token),
      body: JSON.stringify({ contentId, position, duration }),
    });
  } catch {
    // Silent fail — local save already succeeded
  }
}

async function fetchPlaybackPositionFromCloud(userId: string, contentId: string): Promise<{ position: number; duration: number } | null> {
  if (!FUNCTIONS_URL) return null;
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const response = await fetch(`${endpoint(`/v1/sync/playback?contentId=${encodeURIComponent(contentId)}`)}`, {
      headers: headers(userId, token),
    });
    if (!response.ok) return null;
    const payload = await safeJson(response);
    const pos = payload.position as number | undefined;
    const dur = payload.duration as number | undefined;
    if (typeof pos === 'number' && typeof dur === 'number') return { position: pos, duration: dur };
    return null;
  } catch {
    return null;
  }
}

const DOC_PROGRESS_KEY = 'aira_doc_progress';

export async function saveDocumentProgress(userId: string, contentId: string, scrollPercent: number, isRead: boolean): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(DOC_PROGRESS_KEY);
    const progress: Array<{ userId: string; contentId: string; scrollPercent: number; isRead: boolean; updatedAt: string }> = stored ? JSON.parse(stored) : [];
    const filtered = progress.filter(p => !(p.userId === userId && p.contentId === contentId));
    filtered.push({ userId, contentId, scrollPercent, isRead, updatedAt: new Date().toISOString() });
    await AsyncStorage.setItem(DOC_PROGRESS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.log('[CloudSync] Failed to save document progress');
  }
}

export async function getDocumentProgress(userId: string, contentId: string): Promise<{ scrollPercent: number; isRead: boolean } | null> {
  try {
    const stored = await AsyncStorage.getItem(DOC_PROGRESS_KEY);
    if (!stored) return null;
    const progress: Array<{ userId: string; contentId: string; scrollPercent: number; isRead: boolean }> = JSON.parse(stored);
    const found = progress.find(p => p.userId === userId && p.contentId === contentId);
    return found ? { scrollPercent: found.scrollPercent, isRead: found.isRead } : null;
  } catch {
    return null;
  }
}

const FILE_CACHE_KEY = 'aira_file_cache';

export async function cacheFileLocally(contentId: string, uri: string, fileName: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(FILE_CACHE_KEY);
    const cache: Array<{ contentId: string; uri: string; fileName: string; cachedAt: string }> = stored ? JSON.parse(stored) : [];
    const filtered = cache.filter(c => c.contentId !== contentId);
    filtered.push({ contentId, uri, fileName, cachedAt: new Date().toISOString() });
    await AsyncStorage.setItem(FILE_CACHE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.log('[CloudSync] Failed to cache file locally');
  }
}

export async function getCachedFile(contentId: string): Promise<{ uri: string; fileName: string } | null> {
  try {
    const stored = await AsyncStorage.getItem(FILE_CACHE_KEY);
    if (!stored) return null;
    const cache: Array<{ contentId: string; uri: string; fileName: string }> = JSON.parse(stored);
    return cache.find(c => c.contentId === contentId) ?? null;
  } catch {
    return null;
  }
}

export async function getProtectedFileUrl(uploadId: string): Promise<string | null> {
  const token = await getSessionToken();
  if (!FUNCTIONS_URL || !token) return null;
  return `${endpoint(`/v1/uploads/${encodeURIComponent(uploadId)}`)}?token=${encodeURIComponent(token)}`;
}
