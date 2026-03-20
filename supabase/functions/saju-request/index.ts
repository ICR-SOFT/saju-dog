/**
 * saju-request: 풀이 요청 접수 (빠른 응답, <2초)
 *
 * 1. 인증 확인
 * 2. 크레딧 차감
 * 3. pending 상태의 reading 생성
 * 4. reading ID 즉시 반환
 *
 * 처리는 saju-worker에서 별도로 수행
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { profileId, serviceType = 'comprehensive', secondaryProfileId, force = false, metadata } = await req.json();

    // Auth
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

    // 캐시 확인 (force=true면 캐시 무시하고 새로 풀이)
    if (!force) {
      const { data: cached } = await supabase
        .from('readings')
        .select('id, result, processing_status')
        .eq('profile_id', profileId)
        .eq('service_type', serviceType)
        .eq('processing_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached?.result) {
        return new Response(JSON.stringify({
          readingId: cached.id,
          status: 'completed',
          result: cached.result,
          cached: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 진행 중인 요청 확인 (force=true면 무시)
    if (!force) {
      const { data: pending } = await supabase
        .from('readings')
        .select('id, processing_status')
        .eq('profile_id', profileId)
        .eq('service_type', serviceType)
        .in('processing_status', ['pending', 'processing'])
        .maybeSingle();

      if (pending) {
        return new Response(JSON.stringify({
          readingId: pending.id,
          status: pending.processing_status,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 크레딧 차감
    const cost = CREDIT_COSTS[serviceType] ?? 2;
    if (cost > 0) {
      const { data: credits } = await adminSupabase
        .from('credits')
        .select('bones')
        .eq('user_id', user.id)
        .single();

      if (!credits || credits.bones < cost) {
        throw new Error(`뼈다귀가 부족합니다 (필요: ${cost}, 보유: ${credits?.bones ?? 0})`);
      }

      await adminSupabase
        .from('credits')
        .update({ bones: credits.bones - cost, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      await adminSupabase.from('credit_transactions').insert({
        user_id: user.id, type: 'usage', bones_delta: -cost,
        description: `${serviceType} 풀이 요청`,
      });
    }

    // pending reading 생성
    const { data: reading, error: insertError } = await adminSupabase
      .from('readings')
      .insert({
        user_id: user.id,
        profile_id: profileId,
        secondary_profile_id: secondaryProfileId || null,
        service_type: serviceType,
        status: 'completed', // RLS 호환
        processing_status: 'pending',
        ...(metadata ? { error: JSON.stringify(metadata) } : {}), // metadata를 error 필드에 임시 저장
      })
      .select('id')
      .single();

    if (insertError) throw new Error(`요청 생성 실패: ${insertError.message}`);

    return new Response(JSON.stringify({
      readingId: reading.id,
      status: 'pending',
      cost,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
