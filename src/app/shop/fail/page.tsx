'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';

export default function ShopFailPage() {
  return (
    <Suspense fallback={<Loading message="로딩 중..." />}>
      <ShopFailContent />
    </Suspense>
  );
}

function ShopFailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const errorMessage = searchParams.get('message') || '결제 처리 중 오류가 발생했어요';
  const errorCode = searchParams.get('code');

  return (
    <AuthRequired>
      <AppShell title="결제 실패" showNav={false}>
        <div className="p-4 flex flex-col items-center justify-center gap-6 py-20 animate-fade-in">
          {/* Fail Icon */}
          <div className="pixel-border p-8">
            <span className="text-5xl block text-center">❌</span>
          </div>

          {/* Message */}
          <div className="text-center flex flex-col gap-2">
            <h2 className="font-pixel text-lg text-[var(--text-primary)]">
              결제 실패
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {errorMessage}
            </p>
            {errorCode && (
              <p className="text-[10px] text-[var(--text-muted)]">
                오류 코드: {errorCode}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full max-w-[240px]">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => router.push('/shop')}
            >
              다시 시도
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => router.push('/')}
            >
              홈으로
            </Button>
          </div>
        </div>
      </AppShell>
    </AuthRequired>
  );
}
