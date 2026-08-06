import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncQueueItem, SyncEntityType, SyncOperationType } from '@/types';
import { generateId } from '@/mocks/data';

const QUEUE_KEY = 'aira_sync_queue';

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const stored = await AsyncStorage.getItem(QUEUE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as SyncQueueItem[];
  } catch {
    return [];
  }
}

async function saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueSync(
  entityType: SyncEntityType,
  operationType: SyncOperationType,
  entityId: string,
  data?: unknown,
  scope: 'auth' | 'data' = 'data',
  options?: { fileUri?: string; fileName?: string; contentType?: string },
): Promise<void> {
  const queue = await getSyncQueue();
  const existingIdx = queue.findIndex(
    (item) => item.entityType === entityType && item.entityId === entityId && item.scope === scope,
  );
  const newItem: SyncQueueItem = {
    id: generateId(),
    entityType,
    operationType,
    entityId,
    data,
    timestamp: new Date().toISOString(),
    retries: 0,
    maxRetries: 3,
    scope,
    fileUri: options?.fileUri,
    fileName: options?.fileName,
    contentType: options?.contentType,
  };
  if (existingIdx >= 0) {
    queue[existingIdx] = newItem;
  } else {
    queue.push(newItem);
  }
  await saveSyncQueue(queue);
  console.log('[SyncQueue] Enqueued:', entityType, operationType, entityId);
}

export async function dequeueSync(itemId: string): Promise<void> {
  const queue = await getSyncQueue();
  await saveSyncQueue(queue.filter((item) => item.id !== itemId));
}

export async function incrementSyncRetry(itemId: string): Promise<void> {
  const queue = await getSyncQueue();
  const updated = queue.map((item) =>
    item.id === itemId ? { ...item, retries: item.retries + 1 } : item,
  );
  await saveSyncQueue(updated);
}

export async function getPendingSyncCount(): Promise<number> {
  const queue = await getSyncQueue();
  return queue.length;
}

export async function clearSyncQueue(): Promise<void> {
  await saveSyncQueue([]);
}

export async function getSyncQueueSnapshot(): Promise<SyncQueueItem[]> {
  return getSyncQueue();
}
