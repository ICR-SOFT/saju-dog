import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '오늘의 운세',
  description: '매일 무료로 확인하는 오늘의 운세. 연애운, 금전운, 직장운, 건강운.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
