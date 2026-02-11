export type ThemeType = 'system' | 'light' | 'dark';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface PriorityLevel {
  id: string;
  name: string;
  color: string;
  rank: number;
}

export const PRESET_COLORS = [
  { name: 'Amber', color: '#F59E0B' },
  { name: 'Lime', color: '#84CC16' },
  { name: 'Emerald', color: '#10B981' },
  { name: 'Cyan', color: '#06B6D4' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Violet', color: '#8B5CF6' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Brown', color: '#92400E' },
  { name: 'Gray', color: '#6B7280' },
];

export const DEFAULT_TAGS: Tag[] = [
  { id: '1', name: 'Personal', color: '#3B82F6' },
  { id: '2', name: 'Work', color: '#F59E0B' },
  { id: '3', name: 'Urgent', color: '#EC4899' },
];

export interface CommonTimes {
  morning: string;
  afternoon: string;
  evening: string;
  night: string;
}
