import * as React from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { addDays, addWeeks, addMonths, format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Reminder } from '../types/reminder';

interface RemindersContextType {
  reminders: Reminder[];
  loading: boolean;
  addReminder: (newReminder: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed'>) => Promise<{ data: Reminder | null; error: any }>;
  toggleComplete: (id: string, currentStatus: boolean) => Promise<{ error: any }>;
  updateReminder: (id: string, updates: Partial<Omit<Reminder, 'id' | 'user_id' | 'created_at'>>) => Promise<{ data: Reminder | null; error: any }>;
  deleteReminder: (id: string) => Promise<{ error: any }>;
  refreshReminders: () => Promise<void>;
  searchReminders: (query: string) => Promise<{ answer?: string; follow_up?: string; evidence?: Reminder[]; error?: any }>;
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
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reminders:', error);
        setReminders([]);
      } else {
        console.log(`Fetched ${data?.length || 0} reminders`);
        setReminders(data || []);
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

  const getNextDate = (dateStr: string | undefined, repeat: 'daily' | 'weekly' | 'monthly' | 'yearly'): string | undefined => {
    // We use T00:00:00 to ensure it's parsed as local time
    const baseDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();

    if (isNaN(baseDate.getTime())) return undefined;

    let nextDate: Date;
    switch (repeat) {
      case 'daily':
        nextDate = addDays(baseDate, 1);
        break;
      case 'weekly':
        nextDate = addWeeks(baseDate, 1);
        break;
      case 'monthly':
        nextDate = addMonths(baseDate, 1);
        break;
      case 'yearly':
        nextDate = addMonths(baseDate, 12);
        break;
      default:
        return undefined;
    }

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
          prev.map((r) => (r.id === id ? data : r))
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
      }
      return { error };
    } catch (error) {
      console.error('Unexpected error deleting reminder:', error);
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
