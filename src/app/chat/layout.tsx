import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '멍도령 상담',
  description: '사주 전문 상담사 멍도령에게 직접 물어보세요.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
