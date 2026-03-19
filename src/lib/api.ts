import { supabase } from './supabase.ts';
import type {
  ReadingRequest,
  CompatibilityRequest,
  DailyFortuneRequest,
  ChatRequest,
  ChatResponse,
} from '@/types/api.ts';
import type { SajuApiResponse } from '@/types/saju.ts';

async function callEdgeFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
  });

  if (error) {
    throw new Error(error.message || `Edge Function 호출 실패: ${name}`);
  }

  return data as T;
}

export async function getReading(req: ReadingRequest): Promise<SajuApiResponse> {
  return callEdgeFunction<SajuApiResponse>('saju-reading', req);
}

export async function getCompatibility(req: CompatibilityRequest): Promise<SajuApiResponse> {
  return callEdgeFunction<SajuApiResponse>('compatibility', req);
}

export async function getDailyFortune(req: DailyFortuneRequest): Promise<SajuApiResponse> {
  return callEdgeFunction<SajuApiResponse>('daily-fortune', req);
}

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  return callEdgeFunction<ChatResponse>('saju-chat', req);
}
