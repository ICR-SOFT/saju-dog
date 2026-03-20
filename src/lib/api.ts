import { supabase } from './supabase.ts';
import type {
  DailyFortuneRequest,
  ChatRequest,
  ChatResponse,
} from '@/types/api.ts';
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
): Promise<RequestResult> {
  const { data, error } = await supabase.functions.invoke('saju-request', {
    body: { profileId, serviceType, secondaryProfileId, force },
  });

  if (error) throw new Error(error.message || '요청 실패');
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

// ===== 기존 API (daily, chat은 아직 동기식) =====

async function callEdgeFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message || `Edge Function 호출 실패: ${name}`);
  return data as T;
}

export async function getDailyFortune(req: DailyFortuneRequest): Promise<SajuApiResponse> {
  return callEdgeFunction<SajuApiResponse>('daily-fortune', req);
}

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  return callEdgeFunction<ChatResponse>('saju-chat', req);
}

export async function getCompatibility(req: { profileIds: string[] }): Promise<SajuApiResponse> {
  return callEdgeFunction<SajuApiResponse>('compatibility', req);
}
