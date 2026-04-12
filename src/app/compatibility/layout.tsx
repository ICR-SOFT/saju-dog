import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '궁합 분석',
  description: '두 사람의 인연과 케미를 사주로 확인해보세요.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
