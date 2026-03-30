import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

// SVG 아이콘 컴포넌트 — 깔끔한 라인 스타일
function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#D4A843' : '#8B8580'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#D4A843' : '#8B8580'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function IconChat({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#D4A843' : '#8B8580'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconArchive({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#D4A843' : '#8B8580'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { path: '/', label: '홈', Icon: IconHome, isCenter: false },
  { path: '/add-profile', label: '사주추가', Icon: IconProfile, isCenter: false },
  { path: '/daily', label: '무료운세', Icon: null, isCenter: true },
  { path: '/chat', label: '사주상담', Icon: IconChat, isCenter: false },
  { path: '/archive', label: '보관함', Icon: IconArchive, isCenter: false },
] as const;

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-cream-dark border-t border-warm-gray-light/15 safe-area-bottom">
      <div className="mx-auto max-w-lg flex items-end relative">
        {NAV_ITEMS.map(item => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex-1 flex flex-col items-center -mt-2 relative z-10"
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md ring-3 ring-cream-dark transition-transform active:scale-95 overflow-hidden ${
                    isActive ? 'bg-brown' : 'bg-brown-light'
                  }`}
                >
                  {!logoError ? (
                    <img
                      src="/images/logo.png"
                      alt="무료운세"
                      className="w-8 h-8 rounded-full object-cover"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 ${isActive ? 'text-brown font-medium' : 'text-warm-gray'}`}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-all ${
                isActive ? 'text-brown font-medium' : 'text-warm-gray'
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-7 rounded-full transition-all ${isActive ? 'bg-brown/10' : ''}`}>
                {item.Icon && <item.Icon active={isActive} />}
              </div>
              <span className="text-[10px]">{item.label}</span>
              {isActive && <span className="w-1 h-1 rounded-full bg-brown -mt-0.5" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
