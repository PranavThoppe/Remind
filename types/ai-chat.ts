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
}

export interface ModalFieldUpdates {
  title?: string;
  date?: string;  // YYYY-MM-DD
  time?: string;  // HH:mm
  tag_id?: string;
  priority_id?: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export interface MockAIResponse {
  type: 'chat' | 'create' | 'update' | 'search';
  message: string;
  fieldUpdates?: ModalFieldUpdates;
  searchResults?: any[];
}
