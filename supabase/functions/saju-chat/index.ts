import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getActivePromptConfig, buildClaudeParams } from '../_shared/prompt-config.ts';
import { callClaude } from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { profileId, message, history = [] } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('인증이 필요합니다');

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 크레딧 차감
    const { data: credits } = await adminSupabase
      .from('credits')
      .select('bones')
      .eq('user_id', user.id)
      .single();

    if (!credits || credits.bones < 1) throw new Error('뼈다귀가 부족합니다 🦴');

    await adminSupabase
      .from('credits')
      .update({ bones: credits.bones - 1, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    // 프로필의 사주 데이터
    const { data: profile } = await supabase
      .from('saju_profiles')
      .select('calculated_saju, name')
      .eq('id', profileId)
      .single();

    // DB에서 프롬프트 설정 조회
    const config = await getActivePromptConfig(adminSupabase, 'chat');

    // 메시지 빌드: 첫 턴에 사주 데이터 포함
    const messages: any[] = [];

    if (history.length === 0 && profile?.calculated_saju) {
      const p = profile.calculated_saju.pillars;
      const sajuInfo = `[사주 데이터] ${profile.name}님, 사주: ${p.year.stem}${p.year.branch} ${p.month.stem}${p.month.branch} ${p.day.stem}${p.day.branch} ${p.hour.stem}${p.hour.branch}\n\n${message}`;
      messages.push({ role: 'user', content: sajuInfo });
    } else {
      for (const h of history) {
        messages.push({ role: h.role, content: h.content });
      }
      messages.push({ role: 'user', content: message });
    }

    // Claude API 호출
    const params: any = {
      model: config.model,
      max_tokens: config.max_tokens,
      system: config.system_prompt,
      messages,
    };

    if (config.temperature !== null) {
      params.temperature = config.temperature;
    }

    const responseText = await callClaude(params);

    // 트랜잭션 기록
    await adminSupabase.from('credit_transactions').insert({
      user_id: user.id, type: 'usage', bones_delta: -1, description: 'AI 채팅',
    });

    return new Response(JSON.stringify({ message: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
