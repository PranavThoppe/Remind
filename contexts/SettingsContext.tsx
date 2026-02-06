import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tag, PriorityLevel, DEFAULT_TAGS, ThemeType, CommonTime, DEFAULT_COMMON_TIMES } from '../types/settings';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface CommonTimesSettings {
  morning?: string;
  afternoon?: string;
  evening?: string;
  night?: string;
}

interface Settings {
  commonTimes?: CommonTimesSettings;
}

interface SettingsContextType {
  tags: Tag[];
  addTag: (name: string, color: string) => Promise<void>;
  updateTag: (id: string, name: string, color: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  priorities: PriorityLevel[];
  addPriority: (name: string, color: string, rank: number) => Promise<void>;
  updatePriority: (id: string, name: string, color: string, rank?: number) => Promise<void>;
  deletePriority: (id: string) => Promise<void>;
  commonTimes: CommonTime[];
  addCommonTime: (name: string, time: string) => Promise<void>;
  updateCommonTime: (id: string, name: string, time: string) => Promise<void>;
  deleteCommonTime: (id: string) => Promise<void>;
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  timeFormat: '12h' | '24h';
  setTimeFormat: (format: '12h' | '24h') => Promise<void>;
  weekStart: 'Sunday' | 'Monday';
  setWeekStart: (day: 'Sunday' | 'Monday') => Promise<void>;
  showRelativeDates: boolean;
  setShowRelativeDates: (show: boolean) => Promise<void>;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => Promise<void>;
  lastViewMode: 'list' | 'week' | 'calendar';
  setLastViewMode: (mode: 'list' | 'week' | 'calendar') => Promise<void>;
  lastSortMode: 'time' | 'tag' | 'priority';
  setLastSortMode: (mode: 'time' | 'tag' | 'priority') => Promise<void>;
  isSortExpanded: boolean;
  setIsSortExpanded: (expanded: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TAGS: 'settings_tags',
  PRIORITIES: 'settings_priorities',
  NOTIFICATIONS: 'settings_notifications',
  TIME_FORMAT: 'settings_time_format',
  WEEK_START: 'settings_week_start',
  RELATIVE_DATES: 'settings_relative_dates',
  THEME: 'settings_theme',
  COMMON_TIMES: 'settings_common_times',
  COMMON_TIMES_V2: 'settings_common_times_v2',
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [priorities, setPriorities] = useState<PriorityLevel[]>([]);
  const [commonTimes, setCommonTimes] = useState<CommonTime[]>(DEFAULT_COMMON_TIMES);
  const [settings, setSettings] = useState<Settings>({});
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [timeFormat, setTimeFormatState] = useState<'12h' | '24h'>('12h');
  const [weekStart, setWeekStartState] = useState<'Sunday' | 'Monday'>('Sunday');
  const [showRelativeDates, setShowRelativeDatesState] = useState(true);
  const [theme, setThemeState] = useState<ThemeType>('system');
  const [lastViewMode, setLastViewModeState] = useState<'list' | 'week' | 'calendar'>('list');
  const [lastSortMode, setLastSortModeState] = useState<'time' | 'tag' | 'priority'>('time');
  const [isSortExpanded, setIsSortExpanded] = useState(false);
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

  const fetchProfileSettings = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('last_view_mode, last_sort_mode')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile settings:', error);
      } else if (data) {
        if (data.last_view_mode) setLastViewModeState(data.last_view_mode as 'list' | 'week' | 'calendar');
        if (data.last_sort_mode) setLastSortModeState(data.last_sort_mode as 'time' | 'tag' | 'priority');
      }
    } catch (error) {
      console.error('Unexpected error fetching profile settings:', error);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    fetchTags();
    fetchPriorities();
    fetchProfileSettings();
  }, [fetchTags, fetchPriorities, fetchProfileSettings]);

  const loadSettings = async () => {
    try {
      const [
        savedNotifications,
        savedTimeFormat,
        savedWeekStart,
        savedRelativeDates,
        savedTheme,
        savedCommonTimes,
        savedCommonTimesV2,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.TIME_FORMAT),
        AsyncStorage.getItem(STORAGE_KEYS.WEEK_START),
        AsyncStorage.getItem(STORAGE_KEYS.RELATIVE_DATES),
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
        AsyncStorage.getItem(STORAGE_KEYS.COMMON_TIMES),
        AsyncStorage.getItem(STORAGE_KEYS.COMMON_TIMES_V2),
      ]);

      if (savedNotifications) setNotificationsEnabledState(JSON.parse(savedNotifications));
      if (savedTimeFormat) setTimeFormatState(JSON.parse(savedTimeFormat));
      if (savedWeekStart) setWeekStartState(JSON.parse(savedWeekStart));
      if (savedRelativeDates) setShowRelativeDatesState(JSON.parse(savedRelativeDates));
      if (savedTheme) setThemeState(JSON.parse(savedTheme));
      if (savedCommonTimes) setCommonTimes(JSON.parse(savedCommonTimes));
      if (savedCommonTimesV2) setSettings(JSON.parse(savedCommonTimesV2));
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

  const addCommonTime = async (name: string, time: string) => {
    try {
      const newTime: CommonTime = {
        id: Date.now().toString(),
        name,
        time,
      };
      const updated = [...commonTimes, newTime].sort((a, b) => a.time.localeCompare(b.time));
      await AsyncStorage.setItem(STORAGE_KEYS.COMMON_TIMES, JSON.stringify(updated));
      setCommonTimes(updated);
    } catch (error) {
      console.error('Error adding common time:', error);
    }
  };

  const updateCommonTime = async (id: string, name: string, time: string) => {
    try {
      const updated = commonTimes
        .map(ct => ct.id === id ? { ...ct, name, time } : ct)
        .sort((a, b) => a.time.localeCompare(b.time));
      await AsyncStorage.setItem(STORAGE_KEYS.COMMON_TIMES, JSON.stringify(updated));
      setCommonTimes(updated);
    } catch (error) {
      console.error('Error updating common time:', error);
    }
  };

  const deleteCommonTime = async (id: string) => {
    try {
      const updated = commonTimes.filter(ct => ct.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.COMMON_TIMES, JSON.stringify(updated));
      setCommonTimes(updated);
    } catch (error) {
      console.error('Error deleting common time:', error);
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.COMMON_TIMES_V2, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error updating settings:', error);
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

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(newTheme));
  };

  const setLastViewMode = async (mode: 'list' | 'week' | 'calendar') => {
    setLastViewModeState(mode);
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ last_view_mode: mode })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error updating view mode:', error);
    }
  };

  const setLastSortMode = async (mode: 'time' | 'tag' | 'priority') => {
    setLastSortModeState(mode);
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ last_sort_mode: mode })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error updating sort mode:', error);
    }
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
    commonTimes,
    addCommonTime,
    updateCommonTime,
    deleteCommonTime,
    settings,
    updateSettings,
    notificationsEnabled,
    setNotificationsEnabled,
    timeFormat,
    setTimeFormat,
    weekStart,
    setWeekStart,
    showRelativeDates,
    setShowRelativeDates,
    theme,
    setTheme,
    lastViewMode,
    setLastViewMode,
    lastSortMode,
    setLastSortMode,
    isSortExpanded,
    setIsSortExpanded,
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
