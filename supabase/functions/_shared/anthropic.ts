import { getActivePromptConfig, buildClaudeParams } from './prompt-config.ts';
import type { ServiceType } from './types.ts';

/**
 * Claude API 실시간 호출 — PromptConfig 기반
 * 모델, 토큰, thinking, caching 등 모두 DB 설정에서 가져옴
 */
export async function callClaude(params: any): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Claude API: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
}

/**
 * 서비스 타입 기반 통합 호출
 * 1. DB에서 설정 조회
 * 2. Claude 파라미터 빌드
 * 3. API 호출
 */
export async function callClaudeForService(
  supabase: any,
  serviceType: ServiceType,
  userMessage: string,
): Promise<{ text: string; configId: string }> {
  const config = await getActivePromptConfig(supabase, serviceType);
  const params = buildClaudeParams(config, userMessage);
  const text = await callClaude(params);
  return { text, configId: config.id };
}
