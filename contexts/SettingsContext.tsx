import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tag, PriorityLevel, DEFAULT_TAGS, PRESET_COLORS } from '../types/settings';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface SettingsContextType {
  tags: Tag[];
  addTag: (name: string, color: string) => Promise<void>;
  updateTag: (id: string, name: string, color: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  priorities: PriorityLevel[];
  addPriority: (name: string, color: string, rank: number) => Promise<void>;
  updatePriority: (id: string, name: string, color: string, rank?: number) => Promise<void>;
  deletePriority: (id: string) => Promise<void>;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  timeFormat: '12h' | '24h';
  setTimeFormat: (format: '12h' | '24h') => Promise<void>;
  weekStart: 'Sunday' | 'Monday';
  setWeekStart: (day: 'Sunday' | 'Monday') => Promise<void>;
  showRelativeDates: boolean;
  setShowRelativeDates: (show: boolean) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TAGS: 'settings_tags',
  PRIORITIES: 'settings_priorities',
  NOTIFICATIONS: 'settings_notifications',
  TIME_FORMAT: 'settings_time_format',
  WEEK_START: 'settings_week_start',
  RELATIVE_DATES: 'settings_relative_dates',
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [priorities, setPriorities] = useState<PriorityLevel[]>([]);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [timeFormat, setTimeFormatState] = useState<'12h' | '24h'>('12h');
  const [weekStart, setWeekStartState] = useState<'Sunday' | 'Monday'>('Sunday');
  const [showRelativeDates, setShowRelativeDatesState] = useState(true);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingPriorities, setLoadingPriorities] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!user) {
      setTags(DEFAULT_TAGS);
      return;
    }

    setLoadingTags(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching tags:', error);
      } else if (data) {
        setTags(data);
      }
    } catch (error) {
      console.error('Unexpected error fetching tags:', error);
    } finally {
      setLoadingTags(false);
    }
  }, [user]);

  const fetchPriorities = useCallback(async () => {
    if (!user) {
      setPriorities([]);
      return;
    }

    setLoadingPriorities(true);
    try {
      const { data, error } = await supabase
        .from('priorities')
        .select('*')
        .eq('user_id', user.id)
        .order('rank', { ascending: true });

      if (error) {
        console.error('Error fetching priorities:', error);
      } else if (data) {
        setPriorities(data);
      }
    } catch (error) {
      console.error('Unexpected error fetching priorities:', error);
    } finally {
      setLoadingPriorities(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    fetchPriorities();
  }, [fetchPriorities]);

  const loadSettings = async () => {
    try {
      const [
        savedNotifications,
        savedTimeFormat,
        savedWeekStart,
        savedRelativeDates,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.TIME_FORMAT),
        AsyncStorage.getItem(STORAGE_KEYS.WEEK_START),
        AsyncStorage.getItem(STORAGE_KEYS.RELATIVE_DATES),
      ]);

      if (savedNotifications) setNotificationsEnabledState(JSON.parse(savedNotifications));
      if (savedTimeFormat) setTimeFormatState(JSON.parse(savedTimeFormat));
      if (savedWeekStart) setWeekStartState(JSON.parse(savedWeekStart));
      if (savedRelativeDates) setShowRelativeDatesState(JSON.parse(savedRelativeDates));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const addTag = async (name: string, color: string) => {
    if (!user) {
      const newTags = [...tags, { id: Date.now().toString(), name, color }];
      setTags(newTags);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert([{ name, color, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      if (data) setTags([...tags, data]);
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const updateTag = async (id: string, name: string, color: string) => {
    if (!user) {
      const newTags = tags.map((t) => (t.id === id ? { ...t, name, color } : t));
      setTags(newTags);
      return;
    }

    try {
      const { error } = await supabase
        .from('tags')
        .update({ name, color })
        .eq('id', id);

      if (error) throw error;
      setTags(tags.map((t) => (t.id === id ? { ...t, name, color } : t)));
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  };

  const deleteTag = async (id: string) => {
    if (!user) {
      const newTags = tags.filter((t) => t.id !== id);
      setTags(newTags);
      return;
    }

    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTags(tags.filter((t) => t.id !== id));
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  const addPriority = async (name: string, color: string, rank: number) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('priorities')
        .insert([{ name, color, rank, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      if (data) setPriorities(prev => [...prev, data].sort((a, b) => a.rank - b.rank));
    } catch (error) {
      console.error('Error adding priority:', error);
      throw error;
    }
  };

  const updatePriority = async (id: string, name: string, color: string, rank?: number) => {
    if (!user) return;

    try {
      const updates: any = { name, color };
      if (rank !== undefined) updates.rank = rank;

      const { error } = await supabase
        .from('priorities')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setPriorities(prev => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)).sort((a, b) => a.rank - b.rank));
    } catch (error) {
      console.error('Error updating priority:', error);
      throw error;
    }
  };

  const deletePriority = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('priorities')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPriorities(prev => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Error deleting priority:', error);
      throw error;
    }
  };

  const setNotificationsEnabled = async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(enabled));
  };

  const setTimeFormat = async (format: '12h' | '24h') => {
    setTimeFormatState(format);
    await AsyncStorage.setItem(STORAGE_KEYS.TIME_FORMAT, JSON.stringify(format));
  };

  const setWeekStart = async (day: 'Sunday' | 'Monday') => {
    setWeekStartState(day);
    await AsyncStorage.setItem(STORAGE_KEYS.WEEK_START, JSON.stringify(day));
  };

  const setShowRelativeDates = async (show: boolean) => {
    setShowRelativeDatesState(show);
    await AsyncStorage.setItem(STORAGE_KEYS.RELATIVE_DATES, JSON.stringify(show));
  };

  const value = {
    tags,
    addTag,
    updateTag,
    deleteTag,
    priorities,
    addPriority,
    updatePriority,
    deletePriority,
    notificationsEnabled,
    setNotificationsEnabled,
    timeFormat,
    setTimeFormat,
    weekStart,
    setWeekStart,
    showRelativeDates,
    setShowRelativeDates,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
