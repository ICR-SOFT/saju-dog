import { supabase, getValidSession } from './supabase';

// ===== Edge Function 호출 래퍼 =====
async function invokeEdgeFunction(name: string, body: Record<string, unknown>) {
  const session = await getValidSession();
  if (!session) throw new Error('로그인이 필요합니다');

  let { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData.session) {
      ({ data, error } = await supabase.functions.invoke(name, {
        body,
        headers: { Authorization: `Bearer ${refreshData.session.access_token}` },
      }));
    }
  }

  if (error) throw new Error(error.message || '요청 실패');
  if (data?.error) throw new Error(data.error);
  return data;
}

// ===== Types =====
export interface RequestResult {
  readingId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cached';
  result?: unknown;
  cached?: boolean;
  cost?: number;
  error?: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  profile_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  processing_status: string;
  created_at: string;
}

// ===== Reading API =====
export async function requestReading(
  profileId: string,
  serviceType: string,
  secondaryProfileId?: string,
  force = false,
  metadata?: Record<string, string>,
): Promise<RequestResult> {
  return await invokeEdgeFunction('saju-request', {
    profileId, serviceType, secondaryProfileId, force, metadata,
  }) as RequestResult;
}

export async function pollReadingStatus(readingId: string) {
  const { data, error } = await supabase
    .from('readings')
    .select('processing_status, result, processing_duration_ms, failure_reason')
    .eq('id', readingId)
    .single();
  if (error) throw new Error('상태 확인 실패');
  return {
    status: data.processing_status,
    result: data.result,
    duration_ms: data.processing_duration_ms,
    failure_reason: data.failure_reason,
  };
}

// ===== Chat API =====
export async function getChatSessions(): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions').select('*').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createChatSession(profileId: string): Promise<ChatSession> {
  const session = await getValidSession();
  if (!session) throw new Error('로그인 필요');
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: session.user.id, profile_id: profileId })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
  if (error) throw new Error(error.message);
}

export async function getChatMessages(sessionId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages').select('*').eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function sendChatMessage(sessionId: string, content: string): Promise<ChatMessageRow> {
  return await invokeEdgeFunction('chat-send', { sessionId, content }) as ChatMessageRow;
}

export async function pollChatMessages(sessionId: string, afterDate: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages').select('*').eq('session_id', sessionId)
    .gt('created_at', afterDate).eq('role', 'assistant').eq('processing_status', 'completed')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}
