import { supabase } from './supabase.ts';
import type { SajuApiResponse } from '@/types/saju.ts';

// ===== 큐 기반 API (DB 직접 insert) =====

const CREDIT_COSTS: Record<string, number> = {
  comprehensive: 3, compatibility: 3, daeun: 2, yearly: 2,
  daily: 0, chat: 1, business: 3, luckyday: 2,
  love: 2, wealth: 2, health: 2, career: 2, pastlife: 2, moving: 2,
};

export interface RequestResult {
  readingId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cached';
  result?: SajuApiResponse;
  cached?: boolean;
  cost?: number;
  error?: string;
}

/**
 * 풀이 요청 접수 (DB 직접 insert)
 * 1. 캐시/진행중 확인
 * 2. 크레딧 차감
 * 3. pending reading 생성
 * EC2 워커가 자동으로 처리 → 프론트는 pollReadingStatus로 폴링
 */
export async function requestReading(
  profileId: string,
  serviceType: string,
  secondaryProfileId?: string,
  force = false,
  metadata?: Record<string, string>,
): Promise<RequestResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');

  // 캐시 확인 (force=true면 건너뜀)
  if (!force) {
    const { data: cached } = await supabase
      .from('readings')
      .select('id, result, processing_status')
      .eq('profile_id', profileId)
      .eq('service_type', serviceType)
      .eq('processing_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result) {
      return { readingId: cached.id, status: 'completed', result: cached.result, cached: true };
    }
  }

  // 진행 중인 요청 확인 (force=true면 건너뜀)
  if (!force) {
    const { data: pending } = await supabase
      .from('readings')
      .select('id, processing_status')
      .eq('profile_id', profileId)
      .eq('service_type', serviceType)
      .in('processing_status', ['pending', 'processing'])
      .maybeSingle();

    if (pending) {
      return { readingId: pending.id, status: pending.processing_status as RequestResult['status'] };
    }
  }

  // 크레딧 차감
  const cost = (serviceType === 'daily' && force) ? 1 : (CREDIT_COSTS[serviceType] ?? 2);
  if (cost > 0) {
    const { data: credits } = await supabase
      .from('credits')
      .select('bones')
      .eq('user_id', user.id)
      .single();

    if (!credits || credits.bones < cost) {
      throw new Error(`뼈다귀가 부족합니다 (필요: ${cost}, 보유: ${credits?.bones ?? 0})`);
    }

    await supabase
      .from('credits')
      .update({ bones: credits.bones - cost, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    await supabase.from('credit_transactions').insert({
      user_id: user.id, type: 'usage', bones_delta: -cost,
      description: `${serviceType} 풀이 요청`,
    });
  }

  // pending reading 생성
  const { data: reading, error: insertError } = await supabase
    .from('readings')
    .insert({
      user_id: user.id,
      profile_id: profileId,
      secondary_profile_id: secondaryProfileId || null,
      service_type: serviceType,
      status: 'completed',
      processing_status: 'pending',
      ...(metadata ? { metadata } : {}),
    })
    .select('id')
    .single();

  if (insertError) throw new Error(`요청 생성 실패: ${insertError.message}`);

  return { readingId: reading.id, status: 'pending', cost };
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
