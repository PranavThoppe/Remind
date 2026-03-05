// AI Chat types for the conversational reminder creation flow

import { Reminder, Subtask } from './reminder';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // Inline panel support
  panelType?: 'create' | 'edit' | 'search' | 'draft' | 'draft_update' | 'reminder_list' | 'notification_settings' | 'subtasks_settings';
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
  repeat?: string; // 'none' | RFC 5545 RRULE
  repeat_until?: string | null;
  notes?: string | null;
  notification_offsets?: number[];
  subtasks?: Subtask[];
}

export interface MockAIResponse {
  type: 'chat' | 'create' | 'update' | 'search';
  message: string;
  fieldUpdates?: ModalFieldUpdates;
  searchResults?: any[];
}
