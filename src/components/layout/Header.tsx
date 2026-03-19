import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.ts';
import { useCreditStore } from '@/stores/credit.ts';

export function Header() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { credits } = useCreditStore();

  return (
    <header className="sticky top-0 z-50 gradient-warm backdrop-blur-md border-b border-cream-dark">
      <div className="mx-auto max-w-lg flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
          <div className="relative">
            <span className="text-2xl group-hover:scale-110 transition-transform inline-block">🐕</span>
            <span className="absolute -top-0.5 -right-1 text-[8px] opacity-40">🐾</span>
          </div>
          <div className="flex flex-col items-start">
            <h1 className="text-lg font-bold text-dark font-serif leading-tight">사주독</h1>
            <span className="text-[9px] text-warm-gray leading-none -mt-0.5">SajuDog</span>
          </div>
        </button>

        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm shadow-sm border border-cream-dark">
              <span>🦴</span>
              <span className="font-medium text-brown">{credits?.bones ?? 0}</span>
            </div>
            <button
              onClick={() => navigate('/my')}
              className="h-8 w-8 rounded-full bg-brown/10 flex items-center justify-center text-xs font-medium text-brown border border-brown/20 hover:bg-brown/20 transition-colors"
            >
              {user?.nickname?.charAt(0) ?? '?'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium text-brown hover:text-brown-dark transition-colors px-3 py-1.5 rounded-full hover:bg-brown/5"
          >
            로그인
          </button>
        )}
      </div>
    </header>
  );
}
