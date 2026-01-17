export interface Reminder {
  id: string;
  title: string;
  date?: Date;
  time?: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  createdAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
