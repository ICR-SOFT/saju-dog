'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import { useCreditStore } from '@/stores/credit';
import { supabase } from '@/lib/supabase';

export default function ShopSuccessPage() {
  return (
    <Suspense fallback={<Loading message="로딩 중..." />}>
      <ShopSuccessContent />
    </Suspense>
  );
}

function ShopSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { fetchCredits } = useCreditStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [bones, setBones] = useState(0);
  const [error, setError] = useState('');

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
    <AuthRequired>
      <AppShell title="결제" showNav={false}>
        <div className="p-4 flex flex-col items-center justify-center gap-6 py-20 animate-fade-in">
          {status === 'loading' && (
            <Loading message="결제를 확인하고 있어요..." />
          )}

          {status === 'success' && (
            <>
              <div className="pixel-border-accent p-8 bg-[var(--accent-light)]">
                <span className="text-5xl block text-center">✅</span>
              </div>
              <div className="text-center flex flex-col gap-2">
                <h2 className="font-pixel text-lg text-[var(--text-primary)]">충전 완료!</h2>
                <p className="text-sm text-[var(--text-secondary)]">{bones}개가 추가되었어요</p>
              </div>
              <Button variant="primary" size="lg" className="w-full max-w-[240px]" onClick={() => router.push('/')}>
                홈으로
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="pixel-border p-8">
                <span className="text-5xl block text-center">❌</span>
              </div>
              <div className="text-center flex flex-col gap-2">
                <h2 className="font-pixel text-lg text-[var(--text-primary)]">결제 실패</h2>
                <p className="text-sm text-[var(--error)]">{error}</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-[240px]">
                <Button variant="primary" size="lg" className="w-full" onClick={() => router.push('/shop')}>다시 시도</Button>
                <Button variant="secondary" size="md" className="w-full" onClick={() => router.push('/')}>홈으로</Button>
              </div>
            </>
          )}
        </div>
      </AppShell>
    </AuthRequired>
  );
}
