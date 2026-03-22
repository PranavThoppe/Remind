export interface Subtask {
  id: string;
  reminder_id: string;
  title: string;
  is_completed: boolean;
  position: number;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  date?: string | null;
  time?: string | null; // Allow null for clearing time
  repeat?: string; // 'none' | RFC 5545 RRULE
  repeat_until?: string | null;
  completed: boolean;
  created_at: string;
  tag_id?: string | null; // Allow null for removing tags
  priority_id?: string | null; // Allow null for removing priority
  notes?: string | null;
  notification_offsets?: number[];
  isGhost?: boolean; // UI-only flag for virtual occurrences
  isOffline?: boolean; // UI-only flag for offline queued reminders
  subtasks?: Subtask[]; // Optional subtasks loaded client-side
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  updated_at?: string;
  pro?: boolean;
  has_onboarded: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
