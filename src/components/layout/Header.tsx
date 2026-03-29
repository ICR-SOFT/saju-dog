import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { useSajuStore } from '@/stores/saju.ts';

export function Header() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { credits } = useCreditStore();
  const { profiles, selectedProfileIdx, selectProfile } = useSajuStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const activeProfile = profiles[selectedProfileIdx] || profiles[0];

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!showProfileMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-md border-b border-warm-gray-light/15">
      <div className="mx-auto max-w-lg flex items-center justify-between px-4 h-12">
        {/* Left: logo + title */}
        <button onClick={() => navigate('/')} className="flex items-center gap-2 group">
          <img src="/images/logo.png" alt="운명전쟁" className="w-7 h-7 rounded-full group-hover:scale-110 transition-transform object-cover" />
          <h1 className="text-base font-bold text-dark font-serif leading-tight">운명전쟁</h1>
        </button>

        {/* Right: profile selector + credits + menu */}
        <div className="flex items-center gap-2">
          {isAuthenticated && activeProfile && (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-1 text-xs text-dark font-medium px-2 py-1 rounded-lg hover:bg-cream transition-colors"
              >
                <span>{activeProfile.gender === 'male' ? '👦' : '👧'}</span>
                <span className="max-w-[60px] truncate">{activeProfile.name}</span>
                <span className="text-warm-gray text-[10px]">▾</span>
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-1 bg-cream-dark rounded-xl shadow-lg border border-warm-gray-light/20 py-1 z-50 min-w-[140px]">
                  {profiles.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => { selectProfile(i); setShowProfileMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-cream transition-colors ${i === selectedProfileIdx ? 'text-brown font-medium' : 'text-dark'}`}
                    >
                      <span>{p.gender === 'male' ? '👦' : '👧'}</span>
                      <span>{p.name}</span>
                      {i === selectedProfileIdx && <span className="ml-auto text-brown">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {isAuthenticated && (
            <div className="flex items-center gap-1 rounded-full bg-cream-dark px-2.5 py-1 text-sm border border-warm-gray-light/20">
              <span>🦴</span>
              <span className="font-medium text-brown text-xs">{credits?.bones ?? 0}</span>
            </div>
          )}
          <button
            onClick={() => navigate(isAuthenticated ? '/my' : '/login')}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-cream transition-colors text-warm-gray"
          >
            <span className="text-lg">&#9776;</span>
          </button>
        </div>
      </div>
    </header>
  );
}
