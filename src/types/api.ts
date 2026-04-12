import type { ServiceType, SajuApiResponse } from './saju';

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
  comprehensive: { bones: 5 },
  compatibility: { bones: 5 },
  daeun: { bones: 4 },
  yearly: { bones: 4 },
  daily: { bones: 1 },
  chat: { bones: 1 },
  business: { bones: 5 },
  luckyday: { bones: 4 },
  love: { bones: 4 },
  wealth: { bones: 4 },
  health: { bones: 4 },
  career: { bones: 4 },
  pastlife: { bones: 4 },
  moving: { bones: 4 },
  mbti: { bones: 4 },
  pet: { bones: 4 },
  travel: { bones: 4 },
  food: { bones: 4 },
  color: { bones: 4 },
  study: { bones: 4 },
  ancestor: { bones: 4 },
  child: { bones: 4 },
  secret: { bones: 4 },
  timing: { bones: 4 },
};
