import type { ServiceType } from './types.ts';

export interface PromptConfig {
  id: string;
  service_type: ServiceType;
  model: string;
  max_tokens: number;
  temperature: number | null;
  use_thinking: boolean;
  thinking_type: string | null;
  system_prompt: string;
  use_prompt_caching: boolean;
  version: string;
}

/**
 * DB에서 해당 서비스의 active 프롬프트 설정 조회
 * Edge Function에서 매 요청마다 호출 → 코드 배포 없이 설정 변경 즉시 반영
 */
export async function getActivePromptConfig(
  supabase: any,
  serviceType: ServiceType
): Promise<PromptConfig> {
  const { data, error } = await supabase
    .from('prompt_configs')
    .select('*')
    .eq('service_type', serviceType)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(`No active prompt config for service: ${serviceType}`);
  }

  return data as PromptConfig;
}

/**
 * PromptConfig → Claude API params 변환
 */
export function buildClaudeParams(config: PromptConfig, userMessage: string) {
  const params: any = {
    model: config.model,
    max_tokens: config.max_tokens,
    messages: [{ role: 'user', content: userMessage }],
  };

  // thinking 설정
  if (config.use_thinking && config.thinking_type) {
    params.thinking = { type: config.thinking_type };
  }

  // temperature (null이면 생략 → API 기본값)
  if (config.temperature !== null) {
    params.temperature = config.temperature;
  }

  // system prompt + Prompt Caching
  if (config.use_prompt_caching) {
    params.system = [{
      type: 'text',
      text: config.system_prompt,
      cache_control: { type: 'ephemeral' },
    }];
  } else {
    params.system = config.system_prompt;
  }

  return params;
}
