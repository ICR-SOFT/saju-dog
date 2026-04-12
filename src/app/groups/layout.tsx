import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '그룹 사주',
  description: '팀, 모임의 케미를 한 번에 분석하세요.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
