import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '로그인',
  description: '사주독에 로그인하고 사주 풀이를 시작하세요.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
