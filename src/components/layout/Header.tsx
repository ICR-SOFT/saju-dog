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
        <button onClick={() => navigate('/')} className="flex items-center gap-2">
          <span className="text-2xl">🐕</span>
          <h1 className="text-lg font-bold text-dark font-serif">사주독</h1>
        </button>

        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm shadow-sm">
              <span>🦴</span>
              <span className="font-medium text-brown">{credits?.bones ?? 0}</span>
            </div>
            <button
              onClick={() => navigate('/my')}
              className="h-7 w-7 rounded-full bg-brown/10 flex items-center justify-center text-xs font-medium text-brown"
            >
              {user?.nickname?.charAt(0) ?? '?'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium text-brown hover:text-brown-dark transition-colors"
          >
            로그인
          </button>
        )}
      </div>
    </header>
  );
}
