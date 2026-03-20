import { supabase } from './supabase.ts';
import type {} from '@/types/api.ts';
import type { SajuApiResponse } from '@/types/saju.ts';

// ===== 큐 기반 API =====

export interface RequestResult {
  readingId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cached';
  result?: SajuApiResponse;
  cached?: boolean;
  cost?: number;
  error?: string;
}

export interface WorkerResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: SajuApiResponse;
  duration_ms?: number;
  error?: string;
  refunded?: boolean;
}

/**
 * Step 1: 풀이 요청 접수 (빠른 응답)
 * 크레딧 차감 + pending reading 생성 + reading ID 반환
 */
export async function requestReading(
  profileId: string,
  serviceType: string,
  secondaryProfileId?: string,
  force = false,
  metadata?: Record<string, string>,
): Promise<RequestResult> {
  const { data, error } = await supabase.functions.invoke('saju-request', {
    body: { profileId, serviceType, secondaryProfileId, force, metadata },
  });

  if (error) {
    // 401이면 세션 만료
    if (error.message?.includes('401') || error.message?.includes('JWT')) {
      throw new Error('세션이 만료되었습니다. 페이지를 새로고침해주세요.');
    }
    throw new Error(error.message || '요청 실패');
  }
  return data as RequestResult;
}

/**
 * Step 2: 풀이 처리 요청 (시간 소요)
 * pending → processing → completed/failed
 */
export async function processReading(readingId: string): Promise<WorkerResult> {
  const { data, error } = await supabase.functions.invoke('saju-worker', {
    body: { readingId },
  });

  if (error) {
    // 타임아웃이면 processing 상태일 수 있음 → 폴링으로 확인
    return { status: 'processing' };
  }
  return data as WorkerResult;
}

/**
 * Step 3: 상태 폴링 (DB에서 직접 확인)
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인 필요');
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

/** 메시지 전송 (pending으로 insert → 워커가 처리) */
export async function sendChatMessage(sessionId: string, content: string): Promise<ChatMessageRow> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ session_id: sessionId, role: 'user', content, processing_status: 'pending' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
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
