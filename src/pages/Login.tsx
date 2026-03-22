import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.ts';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Logo } from '@/components/ui/Logo.tsx';

type Mode = 'login' | 'signup';

export function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithOAuth } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (password.length < 6) {
          setError('비밀번호는 6자 이상이어야 합니다');
          return;
        }
        await signUp(email, password, nickname || undefined);
        setSignupDone(true);
      } else {
        await signIn(email, password);
        navigate('/');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '실패';
      if (msg.includes('already registered')) {
        setError('이미 가입된 이메일입니다');
      } else if (msg.includes('Invalid login')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: 'kakao' | 'google') => {
    setError('');
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SNS 로그인 실패');
    }
  };

  if (signupDone) {
    return (
      <div className="min-h-dvh gradient-warm flex items-center justify-center px-4">
        <Card className="text-center max-w-sm w-full">
          <Logo size="lg" className="mx-auto" />
          <h2 className="text-xl font-bold text-dark font-serif mt-3">가입 완료!</h2>
          <p className="text-sm text-warm-gray mt-2">
            이메일로 확인 링크를 보내드렸어요.<br />
            확인 후 로그인해주세요.
          </p>
          <Button className="mt-4" onClick={() => { setMode('login'); setSignupDone(false); }}>
            로그인하기
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh gradient-warm flex items-center justify-center px-4 paw-bg relative overflow-hidden">
      <div className="w-full max-w-sm relative z-10">
        {/* 로고 */}
        <div className="text-center mb-6">
          <div className="relative w-24 h-24 mx-auto mb-3">
            <Logo size="xl" animate className="w-24 h-24 shadow-md border-2 border-brown/10" />
            <span className="absolute -top-1 -right-1 text-xl animate-sparkle">✨</span>
          </div>
          <h1 className="text-3xl font-bold text-dark font-serif">사주독</h1>
          <p className="text-brown font-medium mt-1 text-sm">사주로 보는 나의 이야기</p>
        </div>

        {/* SNS 로그인 */}
        <div className="space-y-2.5 mb-4">
          <button
            onClick={() => handleOAuth('kakao')}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all active:scale-[0.98]"
            style={{ backgroundColor: '#FEE500', color: '#191919' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#191919" d="M9 1C4.58 1 1 3.8 1 7.19c0 2.18 1.44 4.1 3.63 5.2l-.93 3.4c-.08.29.25.52.5.35l4.07-2.67c.24.02.48.03.73.03 4.42 0 8-2.8 8-6.31C17 3.8 13.42 1 9 1z"/></svg>
            카카오로 시작하기
          </button>
          <button
            onClick={() => handleOAuth('google')}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all active:scale-[0.98]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2a10.341 10.341 0 0 0-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
            Google로 시작하기
          </button>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-warm-gray-light/30" />
          <span className="text-xs text-warm-gray-light">또는</span>
          <div className="flex-1 h-px bg-warm-gray-light/30" />
        </div>

        {/* 이메일 로그인/회원가입 */}
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <Input
                label="닉네임"
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="복돌이에게 불릴 이름"
              />
            )}
            <Input
              label="이메일"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              required
            />
            <Input
              label="비밀번호"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? '6자 이상' : '비밀번호'}
              required
            />

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button type="submit" size="lg" isLoading={isLoading}>
              {mode === 'login' ? '로그인' : '회원가입'}
            </Button>
          </form>

          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            className="w-full text-center text-xs text-warm-gray mt-3 py-1"
          >
            {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </Card>
      </div>
    </div>
  );
}
