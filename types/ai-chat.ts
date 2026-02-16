// AI Chat types for the conversational reminder creation flow

import { Reminder } from './reminder';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // Inline panel support
  panelType?: 'create' | 'edit' | 'search';
  panelFields?: ModalFieldUpdates;
  panelSearchResults?: Reminder[];
  panelReminderId?: string; // For editing
  panelIsStatic?: boolean; // True after save/close

  // Media support
  imageUri?: string;
}

export interface ModalFieldUpdates {
  title?: string;
  date?: string | null;  // YYYY-MM-DD
  time?: string | null;  // HH:mm
  tag_id?: string | null;
  priority_id?: string | null;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  repeat_until?: string | null;
}

export interface MockAIResponse {
  type: 'chat' | 'create' | 'update' | 'search';
  message: string;
  fieldUpdates?: ModalFieldUpdates;
  searchResults?: any[];
}
