import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callClaudeForService } from '../_shared/anthropic.ts';
import { buildComprehensiveUserMessage } from '../_shared/message-builders.ts';
import { parseClaudeResponse } from '../_shared/parse-response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { profileId, serviceType = 'comprehensive' } = await req.json();

    // Auth
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('인증이 필요합니다');

    // 1. DB 캐시 확인
    const { data: cached } = await supabase
      .from('readings')
      .select('result')
      .eq('profile_id', profileId)
      .eq('service_type', serviceType)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result) {
      return new Response(JSON.stringify(cached.result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. 크레딧 차감 (service_role 클라이언트 필요)
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: credits } = await adminSupabase
      .from('credits')
      .select('bones')
      .eq('user_id', user.id)
      .single();

    const cost = serviceType === 'daily' ? 0 : 3;
    if (!credits || credits.bones < cost) {
      throw new Error('뼈다귀가 부족합니다 🦴');
    }

    if (cost > 0) {
      await adminSupabase
        .from('credits')
        .update({ bones: credits.bones - cost, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }

    // 3. 사주 데이터 가져오기
    const { data: profile, error: profileError } = await supabase
      .from('saju_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError || !profile) throw new Error('프로필을 찾을 수 없습니다');

    // calculated_saju가 없으면 에러 (프론트에서 미리 계산해서 저장)
    if (!profile.calculated_saju) {
      throw new Error('사주 데이터가 아직 계산되지 않았습니다');
    }

    // 4. Claude 호출 — DB에서 모델/토큰/프롬프트 설정 자동 로드
    const userMessage = buildComprehensiveUserMessage(profile.calculated_saju);
    const { text, configId } = await callClaudeForService(adminSupabase, serviceType, userMessage);

    // 5. 파싱 & 저장
    const parsed = parseClaudeResponse(text);
    await adminSupabase.from('readings').insert({
      user_id: user.id,
      profile_id: profileId,
      service_type: serviceType,
      status: 'completed',
      result: parsed,
      prompt_config_id: configId,
    });

    // 크레딧 트랜잭션 기록
    if (cost > 0) {
      await adminSupabase.from('credit_transactions').insert({
        user_id: user.id,
        type: 'usage',
        bones_delta: -cost,
        description: `${serviceType} 풀이`,
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
