import * as React from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { addDays, addWeeks, addMonths, format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Reminder, Subtask } from '../types/reminder';
import { cancelReminderNotifications } from '../lib/notifications';
import { rrulestr } from 'rrule';
import * as Crypto from 'expo-crypto';

interface RemindersContextType {
  reminders: Reminder[];
  loading: boolean;
  addReminder: (newReminder: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed'>) => Promise<{ data: Reminder | null; error: any }>;
  toggleComplete: (id: string, currentStatus: boolean) => Promise<{ error: any }>;
  updateReminder: (id: string, updates: Partial<Omit<Reminder, 'id' | 'user_id' | 'created_at'>>) => Promise<{ data: Reminder | null; error: any }>;
  deleteReminder: (id: string) => Promise<{ error: any }>;
  refreshReminders: () => Promise<void>;
  searchReminders: (query: string) => Promise<{ answer?: string; follow_up?: string; evidence?: Reminder[]; error?: any }>;
  updateSubtasks: (reminderId: string, subtasks: Subtask[]) => Promise<{ error: any }>;
  hasFetched: boolean;
}

const RemindersContext = createContext<RemindersContextType | undefined>(undefined);

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchReminders = useCallback(async () => {
    // Don't fetch if auth is still loading or if we don't have a user
    if (authLoading) return;

    if (!user) {
      setReminders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('Fetching reminders for user:', user.id);

      const { data: remindersData, error: remindersError } = await supabase
        .from('reminders')
        .select(`
          *,
          subtasks (
            id,
            reminder_id,
            title,
            is_completed,
            position
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (remindersError) {
        console.error('Error fetching reminders:', remindersError);
        setReminders([]);
      } else {
        console.log(`Fetched ${remindersData?.length || 0} reminders`);

        // Sort subtasks by position client-side to ensure stable ordering
        const formattedData = (remindersData || []).map(r => ({
          ...r,
          subtasks: r.subtasks ? r.subtasks.sort((a: any, b: any) => a.position - b.position) : []
        }));

        setReminders(formattedData);
      }
    } catch (error) {
      console.error('Unexpected error fetching reminders:', error);
      setReminders([]);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [user, session?.access_token, authLoading]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const getNextDate = (dateStr: string | undefined, repeatStr: string | undefined): string | undefined => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    // Default baseDate to today if not provided
    let baseDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();

    if (isNaN(baseDate.getTime())) return undefined;

    if (!repeatStr || repeatStr === 'none') return undefined;

    let repeat = 'none';
    if (repeatStr) {
      if (repeatStr.includes('FREQ=DAILY') || repeatStr === 'daily') repeat = 'daily';
      else if (repeatStr.includes('FREQ=WEEKLY') || repeatStr === 'weekly') repeat = 'weekly';
      else if (repeatStr.includes('FREQ=MONTHLY') || repeatStr === 'monthly') repeat = 'monthly';
      else if (repeatStr.includes('FREQ=YEARLY') || repeatStr === 'yearly') repeat = 'yearly';
    }

    try {
      // Check if it's a basic string, convert to rrule string representation
      let ruleString = repeatStr;
      if (repeatStr === 'daily') ruleString = 'FREQ=DAILY';
      else if (repeatStr === 'weekly') ruleString = 'FREQ=WEEKLY';
      else if (repeatStr === 'monthly') ruleString = 'FREQ=MONTHLY';
      else if (repeatStr === 'yearly') ruleString = 'FREQ=YEARLY';

      const dtstart = new Date(Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()));
      const rule = rrulestr(ruleString, { dtstart });

      // We want the next occurrence that is strictly AFTER today
      const endOfTodayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
      const nextOccurrenceUTC = rule.after(endOfTodayUTC);

      if (nextOccurrenceUTC) {
        const nextLocal = new Date(nextOccurrenceUTC.getUTCFullYear(), nextOccurrenceUTC.getUTCMonth(), nextOccurrenceUTC.getUTCDate());
        return format(nextLocal, 'yyyy-MM-dd');
      }
      return undefined;
    } catch (e) {
      console.error('[RemindersContext] Error parsing rrule:', e);
    }

    // Fallback logic for basic repeats
    let nextDate = baseDate;

    // Helper to add interval
    const addInterval = (d: Date, r: string): Date => {
      switch (r) {
        case 'daily':
          return addDays(d, 1);
        case 'weekly':
          return addWeeks(d, 1);
        case 'monthly':
          return addMonths(d, 1);
        case 'yearly':
          return addMonths(d, 12);
        default:
          return d;
      }
    };

    // Keep adding the interval until we hit a date strictly in the future relative to today
    do {
      nextDate = addInterval(nextDate, repeat);
    } while (format(nextDate, 'yyyy-MM-dd') <= todayStr);

    return format(nextDate, 'yyyy-MM-dd');
  };

  const addReminder = async (newReminder: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed'>) => {
    if (!user) return { data: null, error: new Error('User not authenticated') };

    try {
      const { data, error } = await supabase
        .from('reminders')
        .insert([
          {
            ...newReminder,
            user_id: user.id,
            completed: false,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        setReminders((prev) => [data, ...prev]);
      }
      return { data, error };
    } catch (error) {
      console.error('Unexpected error adding reminder:', error);
      return { data: null, error };
    }
  };

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;

    try {
      console.log(`[RemindersContext] Toggling reminder ${id} to ${newStatus}`);

      // Ensure we have a session before updating
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[RemindersContext] No session found during toggleComplete');
        return { error: new Error('No active session') };
      }

      console.log(`[RemindersContext] Session active for user: ${session.user.id}`);

      // 1. Update current reminder in Supabase first
      const { error: updateError } = await supabase
        .from('reminders')
        .update({ completed: newStatus })
        .eq('id', id);

      if (updateError) {
        console.error('[RemindersContext] Supabase update error:', updateError);
        return { error: updateError };
      }

      console.log(`[RemindersContext] Successfully updated database for ${id}`);

      // Cancel notification if marking as complete
      if (newStatus) {
        cancelReminderNotifications(id).catch(err =>
          console.error('[RemindersContext] Failed to cancel notification on complete:', err)
        );
      }

      // Update local state if the reminder exists in our list
      const reminder = reminders.find((r) => r.id === id);

      setReminders(prev => prev.map((r) =>
        r.id === id ? { ...r, completed: newStatus } : r
      ));

      // 2. Handle repeating logic if marking as completed
      // If we don't have the reminder in state, we might miss the repeating logic
      // This is a trade-off for background actions. 
      if (newStatus && reminder && reminder.repeat && reminder.repeat !== 'none') {
        const nextDate = getNextDate(reminder.date || undefined, reminder.repeat);

        // If repeat_until is set and the next occurrence is past the end date, stop repeating
        if (reminder.repeat_until && nextDate) {
          const nextDateObj = new Date(nextDate + 'T00:00:00');
          const untilDateObj = new Date(reminder.repeat_until + 'T00:00:00');
          if (nextDateObj > untilDateObj) {
            console.log('[RemindersContext] Repeat ended: next date', nextDate, 'is past repeat_until', reminder.repeat_until);
            return { error: null };
          }
        }

        const nextReminder = {
          title: reminder.title,
          date: nextDate,
          time: reminder.time,
          repeat: reminder.repeat,
          repeat_until: reminder.repeat_until || null,
          tag_id: reminder.tag_id,
          priority_id: reminder.priority_id,
          user_id: user?.id,
          completed: false,
        };

        const { data: nextData, error: insertError } = await supabase
          .from('reminders')
          .insert([nextReminder])
          .select()
          .single();

        if (!insertError && nextData) {
          setReminders(prev => [nextData, ...prev]);
        }
      }

      return { error: null };
    } catch (error) {
      console.error('Unexpected error toggling reminder:', error);
      return { error };
    }
  };

  const updateReminder = async (id: string, updates: Partial<Omit<Reminder, 'id' | 'user_id' | 'created_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...data } : r))
        );
      }
      return { data, error };
    } catch (error) {
      console.error('Unexpected error updating reminder:', error);
      return { data: null, error };
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);

      if (!error) {
        setReminders((prev) => prev.filter((r) => r.id !== id));
        // Cancel notification on delete
        cancelReminderNotifications(id).catch(err =>
          console.error('[RemindersContext] Failed to cancel notification on delete:', err)
        );
      }
      return { error };
    } catch (error) {
      console.error('Unexpected error deleting reminder:', error);
      return { error };
    }
  };

  const updateSubtasks = async (reminderId: string, newSubtasks: Subtask[]) => {
    try {
      if (!user) return { error: new Error('User not authenticated') };

      // Ensure all objects have an `id` to prevent Supabase bulk insert schema mismatch
      const toUpsert = newSubtasks.map(t => {
        const payload: any = {
          reminder_id: reminderId,
          user_id: user.id,
          title: t.title,
          is_completed: t.is_completed,
          position: t.position,
          // If it's a new subtask (starts with 'temp-' or missing id), generate a valid UUID
          id: (t.id && !t.id.startsWith('temp-')) ? t.id : Crypto.randomUUID(),
        };
        return payload;
      });

      // We need to sync locally too. 
      // Instead of manual diffs, we can use the simplest approach for sync:
      // Since supabase upsert requires passing the Primary Key, and deletes records that are absent? No, upsert doesn't delete missing.
      // Easiest is to delete all existing subtasks for this reminder, then insert the new ones. 
      // Wait, we can't easily do that without losing foreign keys or triggers if any, but it's safe for simple subtasks.

      const { error: deleteError } = await supabase
        .from('subtasks')
        .delete()
        .eq('reminder_id', reminderId);

      if (deleteError) {
        console.error('[RemindersContext] Error clearing old subtasks:', deleteError);
        return { error: deleteError };
      }

      if (toUpsert.length > 0) {
        const { data, error: insertError } = await supabase
          .from('subtasks')
          .insert(toUpsert)
          .select();

        if (insertError) {
          console.error('[RemindersContext] Error inserting new subtasks:', insertError);
          return { error: insertError };
        }

        // Update local state with the returned fresh UUIDs
        setReminders((prev) =>
          prev.map((r) =>
            r.id === reminderId ? { ...r, subtasks: data as Subtask[] } : r
          )
        );
      } else {
        // Empty list
        setReminders((prev) =>
          prev.map((r) =>
            r.id === reminderId ? { ...r, subtasks: [] } : r
          )
        );
      }

      return { error: null };
    } catch (error) {
      console.error('[RemindersContext] Unexpected error updating subtasks:', error);
      return { error };
    }
  };

  const searchReminders = async (query: string) => {
    try {
      console.log('[RemindersContext] Searching for:', query);
      const { data, error } = await supabase.functions.invoke('nova-search', {
        body: { query }
      });

      if (error) {
        console.error('[RemindersContext] Search error:', error);
        return { error };
      }

      // Map evidence to Reminder objects
      // Note: nova-search returns 'reminder_id', we map to 'id'
      const evidence = (data.evidence || []).map((r: any) => ({
        id: r.reminder_id,
        title: r.title,
        date: r.date,
        time: r.time,
        completed: r.completed,
        tag_id: r.tag_id,
        priority_id: r.priority_id,
        user_id: user?.id, // We assume these belong to the user
        created_at: new Date().toISOString(), // Mock if missing
        notes: r.notes,
      })) as Reminder[];

      return {
        answer: data.answer,
        follow_up: data.follow_up,
        evidence,
        error: null
      };
    } catch (error) {
      console.error('[RemindersContext] Unexpected search error:', error);
      return { error };
    }
  };

  const value = {
    reminders,
    loading,
    addReminder,
    toggleComplete,
    updateReminder,
    deleteReminder,
    refreshReminders: fetchReminders,
    searchReminders,
    updateSubtasks,
    hasFetched,
  };

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export const useRemindersContext = () => {
  const context = useContext(RemindersContext);
  if (context === undefined) {
    throw new Error('useRemindersContext must be used within a RemindersProvider');
  }
  return context;
};
