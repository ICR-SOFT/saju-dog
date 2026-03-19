import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callClaudeForService } from '../_shared/anthropic.ts';
import { buildCompatibilityUserMessage } from '../_shared/message-builders.ts';
import { parseClaudeResponse } from '../_shared/parse-response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { primaryProfileId, secondaryProfileId } = await req.json();

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

    // 캐시 확인
    const { data: cached } = await supabase
      .from('readings')
      .select('result')
      .eq('profile_id', primaryProfileId)
      .eq('secondary_profile_id', secondaryProfileId)
      .eq('service_type', 'compatibility')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result) {
      return new Response(JSON.stringify(cached.result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 크레딧 차감
    const { data: credits } = await adminSupabase
      .from('credits')
      .select('bones')
      .eq('user_id', user.id)
      .single();

    if (!credits || credits.bones < 3) throw new Error('뼈다귀가 부족합니다 🦴');

    await adminSupabase
      .from('credits')
      .update({ bones: credits.bones - 3, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    // 두 프로필 가져오기
    const [{ data: primary }, { data: secondary }] = await Promise.all([
      supabase.from('saju_profiles').select('*').eq('id', primaryProfileId).single(),
      supabase.from('saju_profiles').select('*').eq('id', secondaryProfileId).single(),
    ]);

    if (!primary?.calculated_saju || !secondary?.calculated_saju) {
      throw new Error('사주 데이터가 없습니다');
    }

    const userMessage = buildCompatibilityUserMessage(primary.calculated_saju, secondary.calculated_saju);
    const { text, configId } = await callClaudeForService(adminSupabase, 'compatibility', userMessage);

    const parsed = parseClaudeResponse(text);
    await adminSupabase.from('readings').insert({
      user_id: user.id, profile_id: primaryProfileId,
      secondary_profile_id: secondaryProfileId,
      service_type: 'compatibility', status: 'completed',
      result: parsed, prompt_config_id: configId,
    });

    await adminSupabase.from('credit_transactions').insert({
      user_id: user.id, type: 'usage', bones_delta: -3, description: '궁합 풀이',
    });

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
