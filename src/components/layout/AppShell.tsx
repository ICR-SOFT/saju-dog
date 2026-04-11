'use client';

import Header from './Header';
import BottomNav from './BottomNav';

interface AppShellProps {
  title: string;
  showBack?: boolean;
  showNav?: boolean;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({
  title,
  showBack = false,
  showNav = true,
  rightAction,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      <Header title={title} showBack={showBack} rightAction={rightAction} />

      {/* Main content area with padding for fixed header + bottom nav */}
      <main className="flex-1 pt-12 pb-safe">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
