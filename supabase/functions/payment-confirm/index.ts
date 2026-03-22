/**
 * payment-confirm: 토스페이먼츠 결제 승인 + 크레딧 지급
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOSS_SECRET_KEY = Deno.env.get('TOSS_SECRET_KEY') || 'test_sk_D5GePWvyJnrK0W0k6q8gLzN97Eoq';

// 금액 → 뼈다귀 매핑
const AMOUNT_TO_BONES: Record<number, number> = {
  1900: 10,
  4900: 30,
  8900: 60,
  14900: 120,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { paymentKey, orderId, amount } = await req.json();

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

    // 중복 결제 확인
    const { data: existing } = await adminSupabase
      .from('credit_transactions')
      .select('id')
      .eq('description', `toss:${orderId}`)
      .maybeSingle();

    if (existing) throw new Error('이미 처리된 결제입니다');

    // 토스페이먼츠 결제 승인
    const confirmRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(TOSS_SECRET_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!confirmRes.ok) {
      const err = await confirmRes.json();
      throw new Error(err.message || '결제 승인 실패');
    }

    const payment = await confirmRes.json();

    // 금액에 맞는 뼈다귀 수 결정
    const bones = AMOUNT_TO_BONES[payment.totalAmount];
    if (!bones) throw new Error(`잘못된 결제 금액: ${payment.totalAmount}`);

    // 크레딧 지급
    const { data: credits } = await adminSupabase
      .from('credits')
      .select('bones')
      .eq('user_id', user.id)
      .single();

    await adminSupabase
      .from('credits')
      .update({
        bones: (credits?.bones || 0) + bones,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    // 거래 기록
    await adminSupabase.from('credit_transactions').insert({
      user_id: user.id,
      type: 'purchase',
      bones_delta: bones,
      description: `toss:${orderId}`,
    });

    return new Response(JSON.stringify({
      success: true,
      bones,
      orderId: payment.orderId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
