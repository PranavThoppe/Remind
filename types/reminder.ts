export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  date?: string;
  time?: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  created_at: string;
  tag_id?: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
