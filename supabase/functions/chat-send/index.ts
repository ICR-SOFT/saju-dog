/**
 * chat-send: 상담 메시지 전송 (크레딧 차감 + pending 메시지 생성)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHAT_COST = 1;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { sessionId, content } = await req.json();
    if (!sessionId || !content?.trim()) throw new Error('sessionId와 content가 필요합니다');

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

    // 세션 소유 확인
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();
    if (!session) throw new Error('세션을 찾을 수 없습니다');

    // 크레딧 차감
    const { data: credits } = await adminSupabase
      .from('credits')
      .select('bones')
      .eq('user_id', user.id)
      .single();

    if (!credits || credits.bones < CHAT_COST) {
      throw new Error(`뼈다귀가 부족합니다 (필요: ${CHAT_COST}, 보유: ${credits?.bones ?? 0})`);
    }

    await adminSupabase
      .from('credits')
      .update({ bones: credits.bones - CHAT_COST, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    await adminSupabase.from('credit_transactions').insert({
      user_id: user.id, type: 'usage', bones_delta: -CHAT_COST,
      description: '사주상담 메시지',
    });

    // pending 메시지 생성
    const { data: message, error: insertError } = await adminSupabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: content.trim(),
        processing_status: 'pending',
      })
      .select('id, session_id, role, content, processing_status, created_at')
      .single();

    if (insertError) throw new Error(`메시지 생성 실패: ${insertError.message}`);

    return new Response(JSON.stringify(message), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
