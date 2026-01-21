export interface Reminder {
  id: string;
  title: string;
  date?: Date;
  time?: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  createdAt: Date;
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
