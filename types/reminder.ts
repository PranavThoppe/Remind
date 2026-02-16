export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  date?: string | null;
  time?: string | null; // Allow null for clearing time
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  repeat_until?: string | null;
  completed: boolean;
  created_at: string;
  tag_id?: string | null; // Allow null for removing tags
  priority_id?: string | null; // Allow null for removing priority
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  updated_at?: string;
  pro?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
