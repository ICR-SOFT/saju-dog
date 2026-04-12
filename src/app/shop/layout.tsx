import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '상점',
  description: '뼈다귀를 충전하고 다양한 사주 풀이를 이용하세요.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
