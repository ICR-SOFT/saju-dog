import type { ServiceType, SajuApiResponse } from './saju.ts';

// ===== Edge Function 요청 =====

export interface ReadingRequest {
  profileId: string;
  serviceType: ServiceType;
}

export interface CompatibilityRequest {
  profileIds: string[];
}

export interface DailyFortuneRequest {
  profileId: string;
  mood?: string;
}

export interface ChatRequest {
  profileId: string;
  message: string;
  history?: ChatMessage[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ===== Edge Function 응답 =====

export interface ApiResponse<T = SajuApiResponse> {
  data?: T;
  error?: string;
}

export interface ChatResponse {
  message: string;
}

// ===== 크레딧 비용 =====

export const CREDIT_COSTS: Record<ServiceType, { bones: number }> = {
  comprehensive: { bones: 3 },
  compatibility: { bones: 3 },
  daeun: { bones: 2 },
  yearly: { bones: 2 },
  daily: { bones: 0 },
  chat: { bones: 1 },
  business: { bones: 3 },
  luckyday: { bones: 2 },
  love: { bones: 2 },
  wealth: { bones: 2 },
  health: { bones: 2 },
  career: { bones: 2 },
  pastlife: { bones: 2 },
  moving: { bones: 2 },
};
