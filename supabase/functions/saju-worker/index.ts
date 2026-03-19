/**
 * saju-worker: 풀이 처리 워커 (시간 소요)
 *
 * 1. reading ID로 pending 상태 확인
 * 2. processing으로 전환
 * 3. Claude API 호출 (시간/비용 측정)
 * 4. 결과 저장 (completed) 또는 실패 처리 (failed + 환불)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getActivePromptConfig, buildClaudeParams } from '../_shared/prompt-config.ts';
import { buildComprehensiveUserMessage, buildDailyUserMessage, buildCompatibilityUserMessage } from '../_shared/message-builders.ts';
import { parseClaudeResponse } from '../_shared/parse-response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COSTS: Record<string, number> = {
  comprehensive: 3, compatibility: 3, daeun: 2, yearly: 2,
  daily: 0, chat: 1, business: 3, luckyday: 2,
  love: 2, wealth: 2, health: 2, career: 2, pastlife: 2, moving: 2,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { readingId } = await req.json();
    if (!readingId) throw new Error('readingId 필수');

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // reading 조회
    const { data: reading, error: fetchError } = await adminSupabase
      .from('readings')
      .select('*')
      .eq('id', readingId)
      .single();

    if (fetchError || !reading) throw new Error('풀이 요청을 찾을 수 없습니다');

    // 이미 완료된 경우
    if (reading.processing_status === 'completed' && reading.result) {
      return new Response(JSON.stringify({
        status: 'completed',
        result: reading.result,
        duration_ms: reading.processing_duration_ms,
        api_cost: reading.api_cost,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 다른 워커가 이미 처리 중
    if (reading.processing_status === 'processing') {
      return new Response(JSON.stringify({ status: 'processing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // processing으로 전환
    const startTime = Date.now();
    await adminSupabase
      .from('readings')
      .update({
        processing_status: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', readingId);

    try {
      // 프로필 데이터 가져오기
      const { data: profile } = await adminSupabase
        .from('saju_profiles')
        .select('*')
        .eq('id', reading.profile_id)
        .single();

      if (!profile?.calculated_saju) throw new Error('사주 데이터가 없습니다');

      // 서비스 타입에 따른 메시지 빌드
      const serviceType = reading.service_type;
      let userMessage: string;

      if (serviceType === 'daily') {
        // 오늘 일진 계산
        const now = new Date();
        const jdn = Math.floor(
          Math.floor(365.25 * (now.getFullYear() + 4716)) +
          Math.floor(30.6001 * (now.getMonth() + 2)) +
          now.getDate() - 13 - 1524.5
        );
        const stems = ['갑','을','병','정','무','기','경','신','임','계'];
        const branches = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
        userMessage = buildDailyUserMessage(profile.calculated_saju, stems[jdn % 10], branches[(jdn + 2) % 12]);
      } else if (serviceType === 'compatibility' && reading.secondary_profile_id) {
        const { data: secondary } = await adminSupabase
          .from('saju_profiles')
          .select('*')
          .eq('id', reading.secondary_profile_id)
          .single();
        if (!secondary?.calculated_saju) throw new Error('두 번째 프로필 사주 데이터가 없습니다');
        userMessage = buildCompatibilityUserMessage(profile.calculated_saju, secondary.calculated_saju);
      } else {
        userMessage = buildComprehensiveUserMessage(profile.calculated_saju);
      }

      // DB에서 프롬프트 설정 로드
      const promptServiceType = ['comprehensive', 'compatibility', 'daily', 'chat'].includes(serviceType)
        ? serviceType
        : 'comprehensive'; // 기타 서비스는 comprehensive 프롬프트 사용
      const config = await getActivePromptConfig(adminSupabase, promptServiceType);
      const params = buildClaudeParams(config, userMessage);

      // Claude API 호출
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
        const err = await response.json();
        throw new Error(`Claude API: ${err.error?.message || response.statusText}`);
      }

      const apiResponse = await response.json();
      const endTime = Date.now();

      // 텍스트 추출
      const text = apiResponse.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');

      // 비용 계산
      const usage = apiResponse.usage || {};
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      const cacheRead = usage.cache_read_input_tokens || 0;
      const cacheCreation = usage.cache_creation_input_tokens || 0;

      // 비용 산출 (Sonnet 4.6 기준: $3/1M input, $15/1M output)
      const model = config.model;
      let inputRate = 3.0, outputRate = 15.0; // Sonnet
      if (model.includes('opus')) {
        inputRate = 15.0; outputRate = 75.0;
      } else if (model.includes('haiku')) {
        inputRate = 0.25; outputRate = 1.25;
      }
      const costUsd = ((inputTokens - cacheRead) * inputRate + cacheRead * inputRate * 0.1 + cacheCreation * inputRate * 1.25 + outputTokens * outputRate) / 1000000;

      const apiCost = {
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_tokens: cacheRead,
        cache_creation_tokens: cacheCreation,
        cost_usd: Math.round(costUsd * 10000) / 10000, // 소수점 4자리
      };

      // 결과 파싱
      const parsed = parseClaudeResponse(text);

      // 완료 기록
      await adminSupabase
        .from('readings')
        .update({
          result: parsed,
          processing_status: 'completed',
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: endTime - startTime,
          api_cost: apiCost,
          prompt_config_id: config.id,
        })
        .eq('id', readingId);

      return new Response(JSON.stringify({
        status: 'completed',
        result: parsed,
        duration_ms: endTime - startTime,
        api_cost: apiCost,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (processingError) {
      // 실패 처리 + 환불
      const endTime = Date.now();
      const failureReason = processingError instanceof Error ? processingError.message : String(processingError);

      await adminSupabase
        .from('readings')
        .update({
          processing_status: 'failed',
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: endTime - startTime,
          failure_reason: failureReason,
        })
        .eq('id', readingId);

      // 크레딧 환불
      const cost = CREDIT_COSTS[reading.service_type] ?? 2;
      if (cost > 0) {
        const { data: credits } = await adminSupabase
          .from('credits')
          .select('bones')
          .eq('user_id', reading.user_id)
          .single();

        if (credits) {
          await adminSupabase
            .from('credits')
            .update({ bones: credits.bones + cost, updated_at: new Date().toISOString() })
            .eq('user_id', reading.user_id);

          await adminSupabase.from('credit_transactions').insert({
            user_id: reading.user_id, type: 'refund', bones_delta: cost,
            description: `${reading.service_type} 풀이 실패 환불`,
            related_reading_id: readingId,
          });
        }
      }

      return new Response(JSON.stringify({
        status: 'failed',
        error: failureReason,
        refunded: cost > 0,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
