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
  compatibility: { bones: 4 },
  daeun: { bones: 3 },
  yearly: { bones: 3 },
  daily: { bones: 0 },
  chat: { bones: 1 },
  business: { bones: 4 },
  luckyday: { bones: 3 },
  love: { bones: 3 },
  wealth: { bones: 3 },
  health: { bones: 3 },
  career: { bones: 3 },
  pastlife: { bones: 3 },
  moving: { bones: 3 },
  mbti: { bones: 3 },
  pet: { bones: 3 },
  travel: { bones: 3 },
  food: { bones: 3 },
  color: { bones: 3 },
  study: { bones: 3 },
  ancestor: { bones: 3 },
  child: { bones: 3 },
  secret: { bones: 3 },
  timing: { bones: 3 },
};
