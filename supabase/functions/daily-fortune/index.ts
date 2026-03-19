import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callClaudeForService } from '../_shared/anthropic.ts';
import { buildDailyUserMessage } from '../_shared/message-builders.ts';
import { parseClaudeResponse } from '../_shared/parse-response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { profileId, mood } = await req.json();

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

    // 오늘 이미 받았는지 캐시 확인
    const today = new Date().toISOString().split('T')[0];
    const { data: cached } = await supabase
      .from('readings')
      .select('result')
      .eq('profile_id', profileId)
      .eq('service_type', 'daily')
      .eq('status', 'completed')
      .gte('created_at', today)
      .maybeSingle();

    if (cached?.result) {
      return new Response(JSON.stringify(cached.result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 프로필 가져오기
    const { data: profile } = await supabase
      .from('saju_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (!profile?.calculated_saju) throw new Error('사주 데이터가 없습니다');

    // 오늘의 일진 계산 (간략)
    const now = new Date();
    const jdn = Math.floor(
      Math.floor(365.25 * (now.getFullYear() + 4716)) +
      Math.floor(30.6001 * (now.getMonth() + 2)) +
      now.getDate() - 13 - 1524.5
    );
    const stems = ['갑','을','병','정','무','기','경','신','임','계'];
    const branches = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
    const todayStem = stems[jdn % 10];
    const todayBranch = branches[(jdn + 2) % 12];

    const userMessage = buildDailyUserMessage(profile.calculated_saju, todayStem, todayBranch, mood);
    const { text, configId } = await callClaudeForService(adminSupabase, 'daily', userMessage);

    const parsed = parseClaudeResponse(text);
    await adminSupabase.from('readings').insert({
      user_id: user.id, profile_id: profileId,
      service_type: 'daily', status: 'completed',
      result: parsed, prompt_config_id: configId,
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
