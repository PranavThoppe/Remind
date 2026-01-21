import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReminders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
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
  }, [user]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

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
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ completed: !currentStatus })
        .eq('id', id);

      if (!error) {
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, completed: !currentStatus } : r))
        );
      }
      return { error };
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
