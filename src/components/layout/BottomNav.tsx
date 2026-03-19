import { useLocation, useNavigate } from 'react-router';

const NAV_ITEMS = [
  { path: '/', label: '홈', icon: '🏠' },
  { path: '/daily', label: '오늘운세', icon: '🌅' },
  { path: '/archive', label: '보관함', icon: '📚' },
  { path: '/my', label: '마이', icon: '🐾' },
] as const;

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-cream-dark safe-area-bottom">
      <div className="mx-auto max-w-lg flex">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-all ${
                isActive ? 'text-brown font-medium' : 'text-warm-gray'
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                isActive ? 'bg-brown/10 scale-110' : ''
              }`}>
                <span className="text-xl">{item.icon}</span>
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
