import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.ts';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Card } from '@/components/ui/Card.tsx';

export function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh gradient-warm flex items-center justify-center px-4 paw-bg relative overflow-hidden">
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="relative w-28 h-28 mx-auto mb-4">
            <div className="w-28 h-28 rounded-full bg-brown/10 flex items-center justify-center shadow-md border-2 border-brown/10">
              <span className="text-7xl animate-float">🐕</span>
            </div>
            <span className="absolute -top-1 -right-1 text-xl animate-sparkle">✨</span>
          </div>
          <h1 className="text-3xl font-bold text-dark font-serif">사주독</h1>
          <p className="text-brown font-medium mt-1 text-sm">사주로 보는 나의 이야기</p>
          <p className="text-warm-gray mt-1 text-sm">사주 상담사 복돌이가 기다리고 있어요</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="비밀번호"
              required
            />

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button type="submit" size="lg" isLoading={isLoading}>
              로그인
            </Button>
          </form>
        </Card>

      </div>
    </div>
  );
}
