import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '풀이 기록',
  description: '내 사주 풀이 기록을 모아볼 수 있어요.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
