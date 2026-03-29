import { supabase, getValidSession } from './supabase.ts';
import type { SajuApiResponse } from '@/types/saju.ts';

// ===== Edge Function 호출 래퍼 =====
// 세션 토큰을 명시적으로 전달 — functions.invoke() 내부 토큰 동기화가
// 백그라운드 복귀 후 깨지는 문제 방지. 실패 시 세션 갱신 후 1회 재시도.

async function invokeEdgeFunction(name: string, body: Record<string, unknown>) {
  const session = await getValidSession();
  if (!session) throw new Error('로그인이 필요합니다');

  let { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  // 실패 시 토큰 갱신 후 1회 재시도
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

// ===== 큐 기반 API (크레딧 관련은 Edge Function으로 보호) =====

export interface RequestResult {
  readingId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cached';
  result?: SajuApiResponse;
  cached?: boolean;
  cost?: number;
  error?: string;
}

/**
 * 풀이 요청 접수 (Edge Function: 크레딧 차감 + pending reading 생성)
 */
export async function requestReading(
  profileId: string,
  serviceType: string,
  secondaryProfileId?: string,
  force = false,
  metadata?: Record<string, string>,
): Promise<RequestResult> {
  const data = await invokeEdgeFunction('saju-request', {
    profileId, serviceType, secondaryProfileId, force, metadata,
  });
  return data as RequestResult;
}

/**
 * 상태 폴링 (DB에서 직접 확인)
 */
export async function pollReadingStatus(readingId: string): Promise<{
  status: string;
  result?: SajuApiResponse;
  duration_ms?: number;
  failure_reason?: string;
}> {
  const { data, error } = await supabase
    .from('readings')
    .select('processing_status, result, processing_duration_ms, failure_reason')
    .eq('id', readingId)
    .single();

  if (error) throw new Error('상태 확인 실패');

  return {
    status: data.processing_status,
    result: data.result as SajuApiResponse | undefined,
    duration_ms: data.processing_duration_ms,
    failure_reason: data.failure_reason,
  };
}

// ===== 채팅 API (큐 기반) =====

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

/** 세션 목록 */
export async function getChatSessions(): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/** 세션 생성 */
export async function createChatSession(profileId: string): Promise<ChatSession> {
  const session = await getValidSession();
  if (!session) throw new Error('로그인 필요');
  const user = session.user;
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: user.id, profile_id: profileId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** 세션 삭제 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
  if (error) throw new Error(error.message);
}

/** 메시지 목록 */
export async function getChatMessages(sessionId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

/** 메시지 전송 (Edge Function: 크레딧 차감 + pending 메시지 생성) */
export async function sendChatMessage(sessionId: string, content: string): Promise<ChatMessageRow> {
  const data = await invokeEdgeFunction('chat-send', { sessionId, content });
  return data as ChatMessageRow;
}

/** 새 메시지 폴링 (특정 시점 이후) */
export async function pollChatMessages(sessionId: string, afterDate: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .gt('created_at', afterDate)
    .eq('role', 'assistant')
    .eq('processing_status', 'completed')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}
