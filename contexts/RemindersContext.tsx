import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
}

const RemindersContext = createContext<RemindersContextType | undefined>(undefined);

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

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
        setReminders(data || []);
      }
    } catch (error) {
      console.error('Unexpected error fetching reminders:', error);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const getNextDate = (dateStr: string | undefined, repeat: 'daily' | 'weekly' | 'monthly'): string | undefined => {
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
        const nextDate = getNextDate(reminder.date, reminder.repeat);
        
        const nextReminder = {
          title: reminder.title,
          date: nextDate,
          time: reminder.time,
          repeat: reminder.repeat,
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

  const value = {
    reminders,
    loading,
    addReminder,
    toggleComplete,
    updateReminder,
    deleteReminder,
    refreshReminders: fetchReminders,
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
