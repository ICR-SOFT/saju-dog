import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { useAuthStore } from '@/stores/auth.ts';

const SERVICES = [
  {
    type: 'comprehensive',
    title: '종합 사주풀이',
    desc: '나의 타고난 운명과 삶의 흐름을 깊이 있게 알아보세요',
    emoji: '🔮',
    cost: 3,
    gradient: 'from-amber-50 to-orange-50',
    iconBg: 'bg-amber-100',
  },
  {
    type: 'compatibility',
    title: '궁합',
    desc: '두 사람 사이의 인연과 케미를 확인해보세요',
    emoji: '💕',
    cost: 3,
    gradient: 'from-pink-50 to-rose-50',
    iconBg: 'bg-pink-100',
  },
  {
    type: 'daily',
    title: '오늘의 운세',
    desc: '오늘 하루의 운세와 행운의 키워드를 알려드려요',
    emoji: '🌅',
    cost: 0,
    gradient: 'from-orange-50 to-yellow-50',
    iconBg: 'bg-orange-100',
  },
  {
    type: 'chat',
    title: '복돌이 상담',
    desc: '사주에 대해 궁금한 것을 자유롭게 물어보세요',
    emoji: '💬',
    cost: 1,
    gradient: 'from-sky-50 to-blue-50',
    iconBg: 'bg-sky-100',
  },
] as const;

const DAILY_TIPS = [
  '오늘 하루도 좋은 에너지로 가득 채워보세요!',
  '지금 이 순간이 가장 좋은 시작점이에요.',
  '작은 변화가 큰 행운을 불러올 수 있어요.',
  '주변 사람들에게 따뜻한 말 한마디 건네보세요.',
  '오늘은 새로운 도전에 좋은 날이에요!',
  '마음을 편히 먹으면 운도 따라온답니다.',
];

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

  const dailyTip = DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];

  return (
    <Layout>
      {/* 히어로 섹션 */}
      <div className="text-center mb-6 -mx-4 -mt-4 px-4 pt-6 pb-6 gradient-hero rounded-b-3xl relative overflow-hidden">
        {/* 장식 배경 */}
        <div className="absolute inset-0 paw-bg opacity-50" />

        <div className="relative z-10">
          <div className="w-24 h-24 mx-auto mb-3 rounded-full bg-white/80 flex items-center justify-center shadow-lg border-2 border-brown/10">
            <span className="text-5xl animate-float">🐕</span>
          </div>

          <div className="inline-block bg-brown/10 rounded-full px-4 py-1 mb-2">
            <span className="text-xs font-medium text-brown animate-sparkle inline-block">✨ 오늘의 추천 ✨</span>
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
        <Card className="mb-5" padding="sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-brown/10 flex items-center justify-center text-lg border border-brown/15 shadow-sm">
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

      {/* 서비스 메뉴 — 풀 너비 카드 */}
      <div className="space-y-3 mb-6">
        {SERVICES.map(service => (
          <Card
            key={service.type}
            padding="md"
            className={`cursor-pointer hover:shadow-md active:scale-[0.99] bg-gradient-to-r ${service.gradient}`}
            onClick={() => handleServiceClick(service.type)}
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl ${service.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <span className="text-3xl">{service.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-dark text-base">{service.title}</h3>
                <p className="text-xs text-warm-gray mt-0.5 leading-relaxed">{service.desc}</p>
                <div className="mt-1.5">
                  <span className="inline-block text-xs font-medium rounded-full px-2.5 py-0.5 bg-white/70 text-brown border border-brown/10">
                    {service.cost > 0 ? `🦴 ${service.cost}개` : '무료'}
                  </span>
                </div>
              </div>
              <span className="text-warm-gray-light text-lg flex-shrink-0">›</span>
            </div>
          </Card>
        ))}
      </div>

      {/* 복돌이의 한마디 */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-warm-gray mb-2 flex items-center gap-1">
          <span>🐾</span> 복돌이의 한마디
        </h3>
        <div className="speech-bubble shadow-sm border border-cream-dark">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🐕</span>
            <p className="text-sm text-dark-light leading-relaxed pt-0.5">
              {dailyTip}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
