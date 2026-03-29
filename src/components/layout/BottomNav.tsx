import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const NAV_ITEMS = [
  { path: '/', label: '홈', icon: '/icons/nav-home.png', isCenter: false },
  { path: '/add-profile', label: '사주추가', icon: '/icons/nav-profile.png', isCenter: false },
  { path: '/daily', label: '무료운세', icon: '/icons/nav-fortune.png', isCenter: true },
  { path: '/chat', label: '사주상담', icon: '/icons/nav-chat.png', isCenter: false },
  { path: '/archive', label: '보관함', icon: '/icons/nav-archive.png', isCenter: false },
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
                className="flex-1 flex flex-col items-center -mt-5 relative z-10"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ring-4 ring-cream-dark transition-transform active:scale-95 overflow-hidden ${
                    isActive ? 'bg-brown' : 'bg-brown-light'
                  }`}
                >
                  {!logoError ? (
                    <img
                      src="/images/logo.png"
                      alt="무료운세"
                      className="w-10 h-10 rounded-full object-cover"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <img
                      src={item.icon}
                      alt={item.label}
                      className="w-8 h-8 object-contain"
                    />
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
              <div
                className={`flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                  isActive ? 'bg-brown/10 scale-110' : ''
                }`}
              >
                <img
                  src={item.icon}
                  alt={item.label}
                  className={`w-6 h-6 object-contain transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-50'
                  }`}
                />
              </div>
              <span>{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-brown -mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
