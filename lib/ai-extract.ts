import { ChatMessage, ModalFieldUpdates } from '../types/ai-chat';
import { Tag, PriorityLevel } from '../types/settings';

const SUPABASE_URL = 'https://wnucyciacxqrbuthymbu.supabase.co';
// MVP MODE: Admin secret for bypassing JWT (get this from Supabase secrets: supabase secrets list)
// TODO: Move to environment variable or secure storage for production
const ADMIN_SECRET_KEY = 'bxWLD2nOAFTjbFxlG60jNmNn+djE+DgNpcLlfckyKNw=';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudWN5Y2lhY3hxcmJ1dGh5bWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIzMzgsImV4cCI6MjA4NDQzODMzOH0.Xm5XfWgrQIGpvUzoCUqRntuO0pNXWfb4u465VxUe22Y';

export interface ExtractReminderFieldsResponse {
  type: 'create' | 'update' | 'chat' | 'search';
  message: string;
  fieldUpdates?: ModalFieldUpdates;
}

export interface ExtractReminderFieldsParams {
  query: string;
  user_id: string; // Required for MVP mode
  conversation?: ChatMessage[];
  modalContext?: {
    isOpen: boolean;
    currentFields: ModalFieldUpdates;
  };
  tags?: Tag[];
  priorities?: PriorityLevel[];
}

/**
 * Calls the ai-extract-test edge function to extract reminder fields using LLM
 */
export async function extractReminderFields(
  params: ExtractReminderFieldsParams
): Promise<ExtractReminderFieldsResponse> {
  const { query, user_id, conversation = [], modalContext, tags = [], priorities = [] } = params;

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    // Prepare request body
    const requestBody = {
      query,
      user_id,
      conversation: conversation.map(m => ({
        role: m.role,
        content: m.content,
      })),
      modalContext,
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
      })),
      priorities: priorities.map(p => ({
        id: p.id,
        name: p.name,
        rank: p.rank,
        color: p.color,
      })),
    };

    console.log('[extractReminderFields] Sending request to:', `${SUPABASE_URL}/functions/v1/ai-extract-test`);
    console.log('[extractReminderFields] Body:', JSON.stringify(requestBody, null, 2));

    // Call edge function - MVP mode using service role key + admin secret
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-extract-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'x-admin-secret': ADMIN_SECRET_KEY,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: any = {};
      let errorText = '';
      try {
        errorText = await response.text();
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText || response.statusText };
      }

      console.error('[extractReminderFields] HTTP Error:', response.status, errorData);

      // Handle pro membership required error
      if (response.status === 403 && errorData.code === 'PRO_REQUIRED') {
        const error = new Error(errorData.error || 'Pro membership required');
        (error as any).code = 'PRO_REQUIRED';
        throw error;
      }

      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[extractReminderFields] Success data:', JSON.stringify(data, null, 2));

    // Map tag_name to tag_id
    const fieldUpdates: ModalFieldUpdates = {};

    if (data.fieldUpdates) {
      const updates = data.fieldUpdates;

      // Copy basic fields
      if (updates.title !== null && updates.title !== undefined) {
        fieldUpdates.title = updates.title;
      }
      if (updates.date !== null && updates.date !== undefined) {
        fieldUpdates.date = updates.date;
      }
      if (updates.time !== null && updates.time !== undefined) {
        fieldUpdates.time = updates.time;
      }
      if (updates.repeat !== null && updates.repeat !== undefined) {
        fieldUpdates.repeat = updates.repeat;
      }

      // Map tag_name to tag_id
      if (updates.tag_name && typeof updates.tag_name === 'string') {
        const matchingTag = tags.find(
          t => t.name.toLowerCase() === updates.tag_name.toLowerCase()
        );
        if (matchingTag) {
          fieldUpdates.tag_id = matchingTag.id;
        }
      }
    }

    return {
      type: data.type || 'chat',
      message: data.message || 'How can I help you?',
      fieldUpdates: Object.keys(fieldUpdates).length > 0 ? fieldUpdates : undefined,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[extractReminderFields] Request timed out');
      throw new Error('Request timed out. Please try again.');
    }
    console.error('[extractReminderFields] Error:', error);
    throw error;
  }
}

/**
 * Calls the ai-search edge function to find existing reminders
 */
export async function searchReminders(params: {
  query: string;
  user_id: string;
  targetDate?: string;
}): Promise<{ answer: string; follow_up: string; evidence: any[] }> {
  const { query, user_id, targetDate } = params;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'x-admin-secret': ADMIN_SECRET_KEY,
      },
      body: JSON.stringify({
        query,
        dev_user_id: user_id,
        target_date: targetDate
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[searchReminders] Request timed out');
      throw new Error('Request timed out. Please try again.');
    }
    console.error('[searchReminders] Error:', error);
    throw error;
  }
}
