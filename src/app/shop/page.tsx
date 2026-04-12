'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import { useCreditStore } from '@/stores/credit';
import { getPricingPlans, type PricingPlan } from '@/lib/pricing';

function formatPrice(price: number) {
  return `₩${price.toLocaleString('ko-KR')}`;
}

export default function ShopPage() {
  const { credits, fetchCredits } = useCreditStore();
  const [loadingPlan, setLoadingPlan] = useState<number | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);

  useEffect(() => {
    fetchCredits();
    getPricingPlans().then(setPlans);
  }, [fetchCredits]);

  const handlePurchase = useCallback(async (plan: PricingPlan) => {
    setLoadingPlan(plan.bones);

    try {
      // Dynamic import for TossPayments SDK
      const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        alert('결제 설정이 완료되지 않았어요');
        setLoadingPlan(null);
        return;
      }

      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: credits?.user_id || 'anonymous' });

      const orderId = `BONE-${Date.now()}-${plan.bones}`;

      await payment.requestPayment({
        method: 'CARD',
        amount: {
          currency: 'KRW',
          value: plan.price,
        },
        orderId,
        orderName: `사주독 뼈다귀 ${plan.bones}개`,
        successUrl: `${window.location.origin}/shop/success`,
        failUrl: `${window.location.origin}/shop/fail`,
      });
    } catch (err) {
      // User cancelled or error
      if (err instanceof Error && err.message !== 'USER_CANCEL') {
        console.error('결제 오류:', err);
      }
    } finally {
      setLoadingPlan(null);
    }
  }, [credits]);

  return (
    <AuthRequired>
      <AppShell title="상점" showNav>
        <div className="p-4 flex flex-col gap-6 animate-fade-in">
          {/* Current Balance */}
          <div className="pixel-border-accent p-6 bg-[var(--accent-light)] flex flex-col items-center gap-2">
            <span className="font-pixel text-[10px] text-[var(--text-muted)]">보유 뼈다귀</span>
            <span className="font-pixel text-2xl text-[var(--accent)] flex items-center justify-center gap-1">
              🦴 {credits?.bones ?? 0}개
            </span>
          </div>

          {/* Pricing Cards */}
          <div className="flex flex-col gap-3">
            {plans.map((plan, idx) => {
              const perUnit = Math.round(plan.price / plan.bones);
              const isLoading = loadingPlan === plan.bones;

              return (
                <button
                  key={plan.bones}
                  type="button"
                  className="pixel-card p-4 w-full text-left relative"
                  onClick={() => handlePurchase(plan)}
                  disabled={isLoading}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <span className="absolute -top-2 -right-1 font-pixel text-[10px] px-2 py-0.5 bg-[var(--accent)] text-white border-2 border-[var(--accent-hover)]">
                      {plan.badge}
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {'🦴'.repeat(Math.min(idx + 1, 6))}
                      </span>
                      <div>
                        <p className="font-pixel text-sm text-[var(--text-primary)]">
                          {plan.bones}개
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          개당 {formatPrice(perUnit)}
                        </p>
                      </div>
                    </div>
                    <span className="font-pixel text-sm text-[var(--accent)]">
                      {isLoading ? (
                        <span className="pixel-loading inline-flex">
                          <span /><span /><span />
                        </span>
                      ) : (
                        formatPrice(plan.price)
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info */}
          <p className="text-center text-[10px] text-[var(--text-muted)] leading-relaxed">
            뼈다귀는 사주 풀이에 사용되는 재화예요.<br />
            오늘의 운세 1개, 일반 풀이 4개, 종합/궁합 5개, 채팅 1개
          </p>
        </div>
      </AppShell>
    </AuthRequired>
  );
}
