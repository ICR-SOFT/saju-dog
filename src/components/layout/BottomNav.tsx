'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: '/', icon: '/images/ui/home.png', label: '홈' },
  { href: '/archive', icon: '/images/ui/archive.png', label: '기록' },
  { href: '/groups', icon: '/images/ui/archive.png', label: '그룹' },
  { href: '/shop', icon: '/images/ui/shop.png', label: '상점' },
  { href: '/my', icon: '/images/ui/mypage.png', label: 'MY' },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-[var(--bg-primary)] border-t-2 border-[var(--pixel-border)]">
      <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom,0px)]">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 min-w-[56px] py-1 transition-all ${
                active ? 'opacity-100' : 'opacity-50 hover:opacity-75'
              }`}
            >
              <Image
                src={item.icon}
                alt={item.label}
                width={28}
                height={28}
                className={`transition-transform ${active ? 'scale-110' : ''}`}
              />
              <span
                className={`font-pixel text-[10px] leading-none ${
                  active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
