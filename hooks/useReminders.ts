import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Reminder } from '../types/reminder';

export function useReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReminders = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reminders:', error);
      } else {
        setReminders(data || []);
      }
    } catch (error) {
      console.error('Unexpected error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const addReminder = async (newReminder: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed'>) => {
    if (!user) return { error: new Error('User not authenticated') };

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
      return { error };
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
      return { error };
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

  useEffect(() => {
    fetchReminders();
  }, [user]);

  return {
    reminders,
    loading,
    addReminder,
    toggleComplete,
    refreshReminders: fetchReminders,
    updateReminder,
    deleteReminder,
  };
}
