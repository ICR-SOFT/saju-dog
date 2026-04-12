export interface User {
  id: string;
  nickname: string;
  created_at: string;
  updated_at: string;
}

export interface SajuProfile {
  id: string;
  user_id: string;
  name: string;
  relation: string;
  birth_date: string;
  calendar_type: 'solar' | 'lunar' | 'lunar_leap';
  gender: 'male' | 'female';
  use_true_solar: boolean;
  birth_city: string;
  longitude: number;
  marital_status: 'single' | 'married';
  calculated_saju: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Credits {
  id: string;
  user_id: string;
  bones: number;
  treats: number;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: string;
  bones_delta: number;
  treats_delta: number;
  description: string | null;
  related_reading_id: string | null;
  created_at: string;
}

export interface Reading {
  id: string;
  user_id: string;
  profile_id: string;
  secondary_profile_id: string | null;
  service_type: string;
  status: 'completed' | 'failed';
  result: Record<string, unknown> | null;
  error: string | null;
  target_year: number | null;
  prompt_config_id: string | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_duration_ms: number | null;
  api_cost: Record<string, unknown> | null;
  failure_reason: string | null;
  share_id: string | null;
  og_image_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
