import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useCreditStore } from '@/stores/credit.ts';
import { supabase } from '@/lib/supabase.ts';

export function ShopSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchCredits } = useCreditStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [bones, setBones] = useState(0);

  useEffect(() => {
    const confirm = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');

      if (!paymentKey || !orderId || !amount) {
        setError('결제 정보가 누락되었습니다');
        setStatus('error');
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke('payment-confirm', {
          body: { paymentKey, orderId, amount: Number(amount) },
        });

        if (fnError || data?.error) {
          throw new Error(data?.error || fnError?.message || '결제 확인 실패');
        }

        setBones(data.bones);
        setStatus('success');
        fetchCredits();
      } catch (e) {
        setError(e instanceof Error ? e.message : '결제 확인 실패');
        setStatus('error');
      }
    };

    confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100dvh - 200px)' }}>
        <Card className="text-center max-w-sm w-full">
          {status === 'loading' && (
            <>
              <img src="/images/logo.png" alt="복돌이" className="w-16 h-16 mx-auto rounded-full animate-bounce" />
              <p className="text-warm-gray mt-3">결제를 확인하고 있어요...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <span className="text-5xl">🎉</span>
              <h2 className="text-xl font-bold text-dark font-serif mt-3">충전 완료!</h2>
              <p className="text-sm text-warm-gray mt-2">🦴 {bones}개가 추가되었습니다</p>
              <Button className="mt-4" onClick={() => navigate('/')}>
                홈으로
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <span className="text-5xl">😢</span>
              <h2 className="text-xl font-bold text-dark font-serif mt-3">결제 실패</h2>
              <p className="text-sm text-red-500 mt-2">{error}</p>
              <Button className="mt-4" variant="secondary" onClick={() => navigate('/shop')}>
                다시 시도
              </Button>
            </>
          )}
        </Card>
      </div>
    </Layout>
  );
}

export function ShopFail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message') || '결제가 취소되었습니다';

  return (
    <Layout>
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100dvh - 200px)' }}>
        <Card className="text-center max-w-sm w-full">
          <span className="text-5xl">😢</span>
          <h2 className="text-xl font-bold text-dark font-serif mt-3">결제 실패</h2>
          <p className="text-sm text-warm-gray mt-2">{message}</p>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>홈으로</Button>
            <Button className="flex-1" onClick={() => navigate('/shop')}>다시 시도</Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
