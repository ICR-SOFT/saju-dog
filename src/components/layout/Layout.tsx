import type { ReactNode } from 'react';
import { Header } from './Header.tsx';
import { BottomNav } from './BottomNav.tsx';

interface LayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function Layout({ children, hideNav = false }: LayoutProps) {
  return (
    <div className="min-h-dvh bg-cream">
      <Header />
      <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
