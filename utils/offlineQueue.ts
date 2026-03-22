import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = '@offline_reminder_queue';

export interface QueuedReminder {
    /** Client-generated UUID so we can de-duplicate */
    localId: string;
    title: string;
    date?: string | null;
    time?: string | null;
    repeat?: string;
    repeat_until?: string | null;
    tag_id?: string | null;
    priority_id?: string | null;
    notes?: string | null;
    notification_offsets?: number[];
    subtasks?: { title: string; is_completed: boolean; position: number }[];
    /** ISO timestamp of when the user created it locally */
    createdAt: string;
}

/**
 * Add a reminder to the offline queue.
 */
export async function queueReminder(reminder: QueuedReminder): Promise<void> {
    const existing = await getQueuedReminders();
    existing.push(reminder);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(existing));
}

/**
 * Retrieve all queued (un-synced) reminders.
 */
export async function getQueuedReminders(): Promise<QueuedReminder[]> {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as QueuedReminder[];
    } catch {
        return [];
    }
}

/**
 * Remove a single item from the queue after it has been synced.
 */
export async function clearQueueItem(localId: string): Promise<void> {
    const existing = await getQueuedReminders();
    const filtered = existing.filter(r => r.localId !== localId);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
}

/**
 * Attempt to sync all queued reminders to Supabase.
 * @param syncFn - A function that persists one reminder to the backend.
 *                 It should throw on failure so we can keep the item queued.
 * @returns The number of successfully synced items.
 */
export async function syncQueue(
    syncFn: (reminder: QueuedReminder) => Promise<void>,
): Promise<number> {
    const queue = await getQueuedReminders();
    let synced = 0;

    for (const item of queue) {
        try {
            await syncFn(item);
            await clearQueueItem(item.localId);
            synced++;
        } catch {
            // Keep in queue for next attempt
            console.warn(`[offlineQueue] Failed to sync reminder "${item.title}", will retry later.`);
        }
    }
    return synced;
}
