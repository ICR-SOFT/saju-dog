'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import Loading from '@/components/ui/Loading';

interface AuthRequiredProps {
  children: React.ReactNode;
}

export default function AuthRequired({ children }: AuthRequiredProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  // 세션 초기화 보장
  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <Loading message="로딩 중..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
