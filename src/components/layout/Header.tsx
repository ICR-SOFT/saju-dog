import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.ts';
import { useCreditStore } from '@/stores/credit.ts';

export function Header() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { credits } = useCreditStore();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-cream-dark">
      <div className="mx-auto max-w-lg flex items-center justify-between px-4 h-12">
        {/* Left: logo + title */}
        <button onClick={() => navigate('/')} className="flex items-center gap-2 group">
          <span className="text-xl group-hover:scale-110 transition-transform inline-block">🐕</span>
          <h1 className="text-base font-bold text-dark font-serif leading-tight">사주독</h1>
        </button>

        {/* Right: credits + menu */}
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <div className="flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-sm border border-cream-dark">
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
