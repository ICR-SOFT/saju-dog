import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useCreditStore } from '@/stores/credit.ts';
import { useAuthStore } from '@/stores/auth.ts';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';

interface BonePackage {
  id: string;
  bones: number;
  price: number;
  label: string;
  badge?: string;
}

const PACKAGES: BonePackage[] = [
  { id: 'bone_10', bones: 10, price: 1900, label: '10개' },
  { id: 'bone_30', bones: 30, price: 4900, label: '30개', badge: '인기' },
  { id: 'bone_60', bones: 60, price: 8900, label: '60개', badge: '추천' },
  { id: 'bone_120', bones: 120, price: 14900, label: '120개', badge: '최고가성비' },
];

export function Shop() {
  const navigate = useNavigate();
  const { credits } = useCreditStore();
  const { sessionUserId } = useAuthStore();
  const [selected, setSelected] = useState<BonePackage>(PACKAGES[1]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePurchase = async () => {
    if (!sessionUserId) return;
    setError('');
    setIsLoading(true);

    try {
      const tossPayments = await loadTossPayments(CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: sessionUserId });

      const orderId = `bone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: selected.price },
        orderId,
        orderName: `뼈다귀 ${selected.bones}개`,
        customerName: '운명전쟁 사용자',
        successUrl: `${window.location.origin}/shop/success`,
        failUrl: `${window.location.origin}/shop/fail`,
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes('USER_CANCEL')) {
        // 사용자 취소
      } else {
        setError(e instanceof Error ? e.message : '결제 요청 실패');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4 -mx-4 -mt-4 px-4 pt-5 pb-4 gradient-hero rounded-b-3xl">
        <button onClick={() => navigate(-1)} className="text-dark text-lg">←</button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-dark font-serif">뼈다귀 충전</h2>
          <p className="text-xs text-warm-gray">현재 보유: 🦴 {credits?.bones ?? 0}개</p>
        </div>
      </div>

      {/* 패키지 선택 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {PACKAGES.map(pkg => (
          <Card
            key={pkg.id}
            padding="sm"
            className={`cursor-pointer transition-all text-center relative ${
              selected.id === pkg.id
                ? 'ring-2 ring-brown shadow-lg scale-[1.02]'
                : 'hover:shadow-md active:scale-[0.98]'
            }`}
            onClick={() => setSelected(pkg)}
          >
            {pkg.badge && (
              <span className="absolute -top-2 -right-2 bg-brown text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                {pkg.badge}
              </span>
            )}
            <span className="text-3xl">🦴</span>
            <p className="text-xl font-bold text-dark font-serif mt-1">{pkg.bones}개</p>
            <p className="text-sm font-medium text-brown mt-1">
              {pkg.price.toLocaleString()}원
            </p>
            <p className="text-[10px] text-warm-gray mt-0.5">
              개당 {Math.round(pkg.price / pkg.bones)}원
            </p>
          </Card>
        ))}
      </div>

      {/* 결제 버튼 */}
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-warm-gray">선택</span>
          <span className="font-bold text-dark">🦴 {selected.bones}개</span>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-warm-gray">결제 금액</span>
          <span className="font-bold text-dark text-lg">{selected.price.toLocaleString()}원</span>
        </div>

        {error && <p className="text-sm text-red-500 text-center mb-3">{error}</p>}

        <Button size="lg" onClick={handlePurchase} isLoading={isLoading}>
          결제하기
        </Button>
      </Card>

      <p className="text-[10px] text-warm-gray-light text-center leading-relaxed">
        결제 시 토스페이먼츠를 통해 안전하게 처리됩니다.<br />
        구매한 뼈다귀는 환불이 불가합니다.
      </p>
    </Layout>
  );
}
