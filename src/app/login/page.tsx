'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
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
          setIsLoading(false);
          return;
        }
        await signUp(email, password, nickname || undefined);
        setSignupDone(true);
      } else {
        await signIn(email, password);
        router.push('/');
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

  // Signup complete screen
  if (signupDone) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 bg-[var(--bg-primary)]">
        <div className="pixel-border bg-[var(--bg-card)] p-6 w-full max-w-[360px] text-center">
          <span className="text-5xl">🐕</span>
          <h2 className="font-pixel text-lg text-[var(--text-primary)] mt-3">
            가입 완료!
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
            이메일로 확인 링크를 보내드렸어요.<br />
            확인 후 로그인해주세요.
          </p>
          <Button
            className="mt-5 w-full"
            onClick={() => {
              setMode('login');
              setSignupDone(false);
            }}
          >
            로그인하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 bg-[var(--bg-primary)]">
      <div className="w-full max-w-[360px]">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <span className="text-5xl">🐕</span>
          <h1 className="font-pixel text-2xl text-[var(--text-primary)] mt-2">
            사주독
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            멍도령과 함께하는 사주 풀이
          </p>
        </div>

        {/* Email / Password form */}
        <div className="pixel-border bg-[var(--bg-card)] p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <Input
                label="닉네임"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="사주독에서 불릴 이름"
              />
            )}
            <Input
              label="이메일"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              required
            />
            <Input
              label="비밀번호"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? '6자 이상' : '비밀번호'}
              required
            />

            {/* Error */}
            {error && (
              <div className="border-2 border-[var(--error)] bg-red-50 p-2 text-center">
                <p className="text-xs text-[var(--error)]">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              loading={isLoading}
              className="w-full"
              size="lg"
            >
              {mode === 'login' ? '로그인' : '회원가입'}
            </Button>
          </form>

          {/* Toggle mode */}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
            className="w-full text-center text-xs text-[var(--text-muted)] mt-3 py-1 hover:text-[var(--accent)] transition-colors"
          >
            {mode === 'login'
              ? '계정이 없으신가요? 회원가입'
              : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[var(--pixel-shadow)]" />
          <span className="font-pixel text-[10px] text-[var(--text-muted)]">
            또는
          </span>
          <div className="flex-1 h-px bg-[var(--pixel-shadow)]" />
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-2.5">
          {/* Kakao */}
          <button
            type="button"
            onClick={() => handleOAuth('kakao')}
            className="pixel-btn w-full flex items-center justify-center gap-2 py-3 text-sm font-pixel"
            style={{
              backgroundColor: '#FEE500',
              color: '#191919',
              borderColor: '#E5CF00',
              boxShadow: '4px 4px 0 #E5CF00',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
            >
              <path
                fill="#191919"
                d="M9 1C4.58 1 1 3.8 1 7.19c0 2.18 1.44 4.1 3.63 5.2l-.93 3.4c-.08.29.25.52.5.35l4.07-2.67c.24.02.48.03.73.03 4.42 0 8-2.8 8-6.31C17 3.8 13.42 1 9 1z"
              />
            </svg>
            카카오로 시작하기
          </button>

          {/* Google */}
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="pixel-btn w-full flex items-center justify-center gap-2 py-3 text-sm font-pixel bg-[var(--bg-primary)] text-[var(--text-primary)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
            >
              <path
                fill="#4285F4"
                d="M17.64 9.2a10.341 10.341 0 0 0-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              />
            </svg>
            Google로 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
