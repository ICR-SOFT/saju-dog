import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { useAuthStore } from '@/stores/auth.ts';
import type { ServiceType } from '@/types/saju.ts';

/* ===== Service Card Component ===== */

interface ServiceCardProps {
  title: string;
  subtitle: string;
  cost: number;
  image?: string;
  gradient: string;
  onClick: () => void;
}

function ServiceCard({ title, subtitle, cost, image, gradient, onClick }: ServiceCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onClick}
      className="relative h-56 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-md"
    >
      {image && !imgError ? (
        <img
          src={image}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`absolute inset-0 ${gradient}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white text-lg font-bold font-serif" style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.5), -1px -1px 0 rgba(0,0,0,0.2)' }}>{title}</h3>
        <p className="text-white/90 text-xs mt-0.5" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>{subtitle}</p>
        <span className="inline-block mt-2 text-xs bg-white/20 backdrop-blur-sm text-white rounded-full px-3 py-1">
          {cost > 0 ? `🦴 ${cost}` : '무료'}
        </span>
      </div>
    </div>
  );
}

/* ===== Data ===== */

const MAIN_SERVICES: {
  type: ServiceType;
  title: string;
  subtitle: string;
  cost: number;
  image: string;
  gradient: string;
}[] = [
  {
    type: 'comprehensive',
    title: '사주 풀이',
    subtitle: '타고난 운명을 12챕터로 깊이 풀어드려요',
    cost: 3,
    image: '/images/comprehensive.png',
    gradient: 'bg-gradient-to-br from-amber-400 to-orange-500',
  },
  {
    type: 'compatibility',
    title: '궁합 해설',
    subtitle: '두 사람의 인연과 케미를 확인해요',
    cost: 3,
    image: '/images/compatibility.png',
    gradient: 'bg-gradient-to-br from-pink-400 to-rose-500',
  },
  {
    type: 'daeun',
    title: '대운 해설',
    subtitle: '언제 물 들어오는지 알려드려요',
    cost: 2,
    image: '/images/daeun.png',
    gradient: 'bg-gradient-to-br from-teal-400 to-cyan-500',
  },
  {
    type: 'luckyday',
    title: '택일/길일',
    subtitle: 'Top 3 길일을 골라드려요',
    cost: 2,
    image: '/images/luckyday.png',
    gradient: 'bg-gradient-to-br from-yellow-400 to-amber-500',
  },
  {
    type: 'yearly',
    title: '연도별 운세',
    subtitle: '내후년 운세는 어떨까?',
    cost: 2,
    image: '/images/yearly.png',
    gradient: 'bg-gradient-to-br from-violet-400 to-purple-500',
  },
  {
    type: 'daily',
    title: '오늘의 무료운세',
    subtitle: '오늘 하루 운세와 행운 키워드',
    cost: 0,
    image: '/images/daily.png',
    gradient: 'bg-gradient-to-br from-orange-400 to-yellow-500',
  },
];

const MORE_SERVICES: typeof MAIN_SERVICES = [
  { type: 'business', title: '동업 궁합', subtitle: 'N명이 사업하면 몇 점?', cost: 3, image: '/images/business.png', gradient: 'bg-gradient-to-br from-slate-500 to-blue-600' },
  { type: 'love', title: '연애 시기 분석', subtitle: '올해 연애운 타이밍은?', cost: 2, image: '/images/love.png', gradient: 'bg-gradient-to-br from-rose-400 to-pink-500' },
  { type: 'wealth', title: '재물운 특화', subtitle: '돈이 들어오는 시기와 방향', cost: 2, image: '/images/wealth.png', gradient: 'bg-gradient-to-br from-yellow-500 to-amber-600' },
  { type: 'health', title: '건강운 분석', subtitle: '올해 조심할 건강 포인트', cost: 2, image: '/images/health.png', gradient: 'bg-gradient-to-br from-emerald-400 to-green-500' },
  { type: 'career', title: '직업 적성 분석', subtitle: '타고난 직업 DNA는?', cost: 2, image: '/images/career.png', gradient: 'bg-gradient-to-br from-blue-400 to-indigo-500' },
  { type: 'pastlife', title: '전생 이야기', subtitle: '전생에 당신은 누구였을까?', cost: 2, image: '/images/pastlife.png', gradient: 'bg-gradient-to-br from-purple-400 to-violet-600' },
  { type: 'moving', title: '이사/부동산 운', subtitle: '언제 어디로 이동하면 좋을까?', cost: 2, image: '/images/moving.png', gradient: 'bg-gradient-to-br from-stone-400 to-amber-600' },
];

// 모든 서비스 구현됨

export function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { profiles, fetchProfiles } = useSajuStore();
  const { fetchCredits } = useCreditStore();
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
      fetchCredits();
    }
  }, [isAuthenticated, fetchProfiles, fetchCredits]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const handleServiceClick = (type: ServiceType) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (profiles.length === 0 && type !== 'chat') {
      navigate('/add-profile');
      return;
    }

    switch (type) {
      case 'compatibility':
      case 'business':
        navigate('/compatibility');
        break;
      case 'daily':
        navigate('/daily');
        break;
      case 'chat':
        navigate('/chat');
        break;
      default:
        // 모든 서비스 → Reading 페이지 (service 쿼리 파라미터)
        navigate(`/reading/${profiles[0].id}?service=${type}`);
        break;
    }
  };

  const handleMoreServiceClick = (type: ServiceType) => {
    handleServiceClick(type);
  };

  return (
    <Layout>
      {/* 토스트 */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-dark text-white text-sm px-5 py-2.5 rounded-full shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* 히어로 배너 */}
      <div
        onClick={() => handleServiceClick('daily')}
        className="relative -mx-4 -mt-4 px-6 pt-10 pb-8 rounded-b-3xl overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
        style={{
          background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 40%, #f59e0b 100%)',
        }}
      >
        <div className="absolute inset-0 paw-bg opacity-20" />
        <div className="relative z-10">
          <p className="text-white/90 text-sm font-medium mb-1">매일 아침, 복돌이가 챙겨주는 ✨</p>
          <h2
            className="text-3xl font-bold text-white font-serif leading-tight"
            style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.4), 0 0 20px rgba(0,0,0,0.2)' }}
          >
            하루 운세<br />지금 확인하기
          </h2>
          <span className="inline-block mt-3 text-xs bg-white/25 backdrop-blur-sm text-white rounded-full px-4 py-1.5 font-medium">
            바로 확인하기 &rarr;
          </span>
        </div>
      </div>

      {/* 로그인 안내 (비로그인) */}
      {!isAuthenticated && (
        <Card className="text-center mt-4 mb-2 bg-brown/5">
          <p className="text-dark text-sm mb-3">로그인하고 나만의 사주를 확인해보세요</p>
          <Button onClick={() => navigate('/login')} size="md">
            로그인 / 회원가입
          </Button>
        </Card>
      )}

      {/* 프로필 (로그인 상태) */}
      {isAuthenticated && profiles.length === 0 && (
        <Card className="text-center mt-4 mb-2">
          <p className="text-warm-gray mb-3">아직 등록된 프로필이 없어요</p>
          <Button onClick={() => navigate('/add-profile')} size="md">
            프로필 등록하기
          </Button>
        </Card>
      )}

      {isAuthenticated && profiles.length > 0 && (
        <Card className="mt-4 mb-2" padding="sm">
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

      {/* 메인 서비스 2-column grid */}
      <div className="mt-5 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {MAIN_SERVICES.map(service => (
            <ServiceCard
              key={service.type}
              title={service.title}
              subtitle={service.subtitle}
              cost={service.cost}
              image={service.image}
              gradient={service.gradient}
              onClick={() => handleServiceClick(service.type)}
            />
          ))}
        </div>
      </div>

      {/* 복돌이 상담 풀폭 카드 */}
      <div className="mb-6">
        <div
          onClick={() => handleServiceClick('chat')}
          className="relative h-40 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-md"
        >
          <img
            src="/images/chat.png"
            alt="복돌이 상담"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white text-xl font-bold font-serif">복돌이 상담</h3>
            <p className="text-white/80 text-xs mt-0.5">사주에 대해 궁금한 것을 자유롭게 물어보세요</p>
            <span className="inline-block mt-2 text-xs bg-white/20 backdrop-blur-sm text-white rounded-full px-3 py-1">
              🦴 1
            </span>
          </div>
        </div>
      </div>

      {/* 더 많은 운세 — 동일한 이미지 카드 그리드 */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-dark mb-3 flex items-center gap-2">
          <span>✨</span> 이런 운세는 어때요?
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {MORE_SERVICES.map(service => (
            <ServiceCard
              key={service.type}
              title={service.title}
              subtitle={service.subtitle}
              cost={service.cost}
              image={service.image}
              gradient={service.gradient}
              onClick={() => handleMoreServiceClick(service.type)}
            />
          ))}
        </div>
      </div>

      {/* 업데이트 예정 & 피드백 */}
      <div className="mb-4 text-center">
        <p className="text-xs text-warm-gray mb-3">업데이트 예정</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => showToast('피드백 감사합니다! 🐾')}
        >
          피드백 보내기
        </Button>
      </div>
    </Layout>
  );
}
