// AI Chat types for the conversational reminder creation flow

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
  type: 'chat' | 'create' | 'update';
  message: string;
  fieldUpdates?: ModalFieldUpdates;
}
