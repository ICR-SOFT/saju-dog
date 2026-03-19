import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { useAuthStore } from '@/stores/auth.ts';

const SERVICES = [
  { type: 'comprehensive', title: '종합 사주풀이', desc: '나의 타고난 운명 알아보기', emoji: '🔮', cost: 3, accent: 'border-l-4 border-l-amber-400' },
  { type: 'compatibility', title: '궁합', desc: '두 사람의 인연 확인하기', emoji: '💕', cost: 3, accent: 'border-l-4 border-l-pink-400' },
  { type: 'daily', title: '오늘의 운세', desc: '오늘 하루 운세 확인', emoji: '🌅', cost: 0, accent: 'border-l-4 border-l-orange-400' },
  { type: 'chat', title: '복돌이 상담', desc: '사주독에게 물어보기', emoji: '💬', cost: 1, accent: 'border-l-4 border-l-sky-400' },
] as const;

export function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { profiles, fetchProfiles } = useSajuStore();
  const { fetchCredits } = useCreditStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
      fetchCredits();
    }
  }, [isAuthenticated, fetchProfiles, fetchCredits]);

  const handleServiceClick = (type: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (profiles.length === 0 && type !== 'chat') {
      navigate('/add-profile');
      return;
    }

    switch (type) {
      case 'comprehensive':
        navigate(`/reading/${profiles[0].id}`);
        break;
      case 'compatibility':
        navigate('/compatibility');
        break;
      case 'daily':
        navigate('/daily');
        break;
      case 'chat':
        navigate('/chat');
        break;
    }
  };

  return (
    <Layout>
      {/* 환영 메시지 (히어로 섹션) */}
      <div className="text-center mb-6 -mx-4 -mt-4 px-4 pt-6 pb-5 gradient-hero rounded-b-3xl">
        <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-brown/10 flex items-center justify-center">
          <span className="text-5xl">🐕</span>
        </div>
        <h2 className="text-xl font-bold text-dark font-serif">
          {isAuthenticated ? '안녕하세요, 보호자님!' : '사주독에 오신 걸 환영해요!'}
        </h2>
        <p className="text-warm-gray text-sm mt-1">
          {isAuthenticated
            ? '오늘도 복돌이가 운세를 알려드릴게요'
            : '사주 상담사 복돌이가 기다리고 있어요'}
        </p>
      </div>

      {/* 로그인 안내 (비로그인) */}
      {!isAuthenticated && (
        <Card className="text-center mb-4 bg-brown/5">
          <p className="text-dark text-sm mb-3">로그인하고 나만의 사주를 확인해보세요</p>
          <Button onClick={() => navigate('/login')} size="md">
            로그인 / 회원가입
          </Button>
        </Card>
      )}

      {/* 프로필 (로그인 상태) */}
      {isAuthenticated && profiles.length === 0 && (
        <Card className="text-center mb-4">
          <p className="text-warm-gray mb-3">아직 등록된 프로필이 없어요</p>
          <Button onClick={() => navigate('/add-profile')} size="md">
            프로필 등록하기
          </Button>
        </Card>
      )}

      {isAuthenticated && profiles.length > 0 && (
        <Card className="mb-4" padding="sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-brown/10 flex items-center justify-center text-lg">
                {profiles[0].gender === 'male' ? '👦' : '👧'}
              </div>
              <div>
                <p className="font-medium text-dark text-sm">{profiles[0].name}</p>
                <p className="text-xs text-warm-gray">{profiles[0].relation}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/add-profile')}>
              +추가
            </Button>
          </div>
        </Card>
      )}

      {/* 서비스 메뉴 */}
      <div className="grid grid-cols-2 gap-3">
        {SERVICES.map(service => (
          <Card
            key={service.type}
            padding="md"
            className={`cursor-pointer hover:shadow-md transition-all active:scale-[0.98] ${service.accent}`}
            onClick={() => handleServiceClick(service.type)}
          >
            <div className="text-3xl mb-2">{service.emoji}</div>
            <h3 className="font-medium text-dark text-sm">{service.title}</h3>
            <p className="text-xs text-warm-gray mt-1">{service.desc}</p>
            <div className="mt-2 text-xs text-brown font-medium">
              {service.cost > 0 ? `🦴 ${service.cost}` : '무료'}
            </div>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
