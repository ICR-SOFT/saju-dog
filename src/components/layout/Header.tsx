'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useSajuStore } from '@/stores/saju';
import { useCreditStore } from '@/stores/credit';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export default function Header({ title, showBack = false, rightAction }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();
  const { profiles, selectedProfileIdx, selectProfile } = useSajuStore();
  const { credits } = useCreditStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedProfile = profiles[selectedProfileIdx];

  // 바깥 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!showProfileMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showProfileMenu]);

  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-[var(--bg-primary)] border-b-2 border-[var(--pixel-border)]">
      <div className="flex items-center justify-between h-12 px-3">
        {/* Left */}
        <div className="flex items-center gap-1.5 min-w-0 shrink relative" ref={menuRef}>
          {showBack ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="font-pixel text-lg text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors shrink-0"
              aria-label="뒤로 가기"
            >
              ◀
            </button>
          ) : isAuthenticated && selectedProfile ? (
            <>
              <button
                type="button"
                onClick={() => setShowProfileMenu(prev => !prev)}
                className="font-pixel text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors truncate max-w-[100px] flex items-center gap-1"
              >
                {selectedProfile.name}
                <span className="text-[8px]">▼</span>
              </button>

              {/* 프로필 전환 드롭다운 */}
              {showProfileMenu && profiles.length > 0 && (
                <div className="fixed left-3 top-12 pixel-border bg-[var(--bg-primary)] w-[200px] max-w-[70vw] z-[60] max-h-[60vh] overflow-y-auto">
                  {profiles.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[var(--bg-hover)] ${
                        idx === selectedProfileIdx ? 'bg-[var(--accent-light)] text-[var(--accent)]' : 'text-[var(--text-primary)]'
                      }`}
                      onClick={() => {
                        selectProfile(idx);
                        setShowProfileMenu(false);
                        // reading 페이지면 새 프로필로 URL 변경
                        if (pathname.startsWith('/reading/')) {
                          const params = new URLSearchParams(window.location.search);
                          const service = params.get('service') || 'comprehensive';
                          router.replace(`/reading/${p.id}?service=${service}`);
                        }
                      }}
                    >
                      <span className="truncate">{p.name}</span>
                      {idx === selectedProfileIdx && <span className="font-pixel text-[8px]">✓</span>}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] border-t border-[var(--pixel-shadow)]"
                    onClick={() => { setShowProfileMenu(false); router.push('/profile/add'); }}
                  >
                    + 프로필 추가
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Center */}
        <h1 className="font-pixel text-sm text-[var(--text-primary)] truncate text-center">
          {title}
        </h1>

        {/* Right */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isAuthenticated && credits && (
            <button
              type="button"
              onClick={() => router.push('/shop')}
              className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[var(--gold-light)] transition-colors"
            >
              <span className="text-xs">🦴</span>
              <span className="font-pixel text-[10px] text-[var(--gold)]">{credits.bones}</span>
            </button>
          )}
          {rightAction}
        </div>
      </div>
    </header>
  );
}
