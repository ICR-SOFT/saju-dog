import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
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
        <h3 className="text-white text-lg font-bold font-serif" style={{ textShadow: '0 2px 4px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.8), 0 0 24px rgba(0,0,0,0.5)' }}>{title}</h3>
        <p className="text-white/90 text-xs mt-0.5" style={{ textShadow: '0 2px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.7)' }}>{subtitle}</p>
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

const NEW_SERVICES: typeof MAIN_SERVICES = [
  { type: 'mbti', title: '사주 MBTI', subtitle: '사주로 보는 16가지 성격유형', cost: 2, image: '/images/mbti.png', gradient: 'bg-gradient-to-br from-fuchsia-400 to-purple-500' },
  { type: 'pet', title: '반려동물 궁합', subtitle: '나와 찰떡인 반려동물은?', cost: 2, image: '/images/pet.png', gradient: 'bg-gradient-to-br from-amber-400 to-orange-400' },
  { type: 'travel', title: '여행 운세', subtitle: '올해 최고의 여행 방위는?', cost: 2, image: '/images/travel.png', gradient: 'bg-gradient-to-br from-cyan-400 to-teal-500' },
  { type: 'food', title: '식복 분석', subtitle: '오행으로 보는 행운 음식', cost: 2, image: '/images/food.png', gradient: 'bg-gradient-to-br from-red-400 to-orange-500' },
  { type: 'color', title: '사주 컬러', subtitle: '오행 퍼스널컬러 진단', cost: 2, image: '/images/color.png', gradient: 'bg-gradient-to-br from-pink-400 to-violet-500' },
  { type: 'study', title: '합격 기운', subtitle: '시험/학업 운세와 공부법', cost: 2, image: '/images/study.png', gradient: 'bg-gradient-to-br from-sky-400 to-blue-500' },
  { type: 'ancestor', title: '조상 음덕', subtitle: '가문에서 받은 기운 분석', cost: 2, image: '/images/ancestor.png', gradient: 'bg-gradient-to-br from-amber-600 to-yellow-700' },
  { type: 'child', title: '자녀운', subtitle: '미래 자녀의 타고난 특성', cost: 2, image: '/images/child.png', gradient: 'bg-gradient-to-br from-pink-300 to-rose-400' },
  { type: 'secret', title: '숨겨진 재능', subtitle: '사주 속 잠든 능력 발굴', cost: 2, image: '/images/secret.png', gradient: 'bg-gradient-to-br from-indigo-400 to-purple-600' },
  { type: 'timing', title: '황금 타이밍', subtitle: '인생 전환점 종합 분석', cost: 2, image: '/images/timing.png', gradient: 'bg-gradient-to-br from-yellow-400 to-amber-500' },
];

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { profiles, selectedProfileIdx, selectProfile, fetchProfiles, deleteProfile } = useSajuStore();
  const { fetchCredits } = useCreditStore();
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
      fetchCredits();
    }
  }, [isAuthenticated, fetchProfiles, fetchCredits, location.key]);

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
      default: {
        const activeProfile = profiles[selectedProfileIdx] || profiles[0];
        navigate(`/reading/${activeProfile.id}?service=${type}`);
        break;
      }
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
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-warm-gray">사주를 볼 프로필</p>
            <Button variant="ghost" size="sm" onClick={() => navigate('/add-profile')}>
              +추가
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {profiles.map((p, i) => (
              <button
                key={p.id}
                onClick={() => selectProfile(i)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                  i === selectedProfileIdx
                    ? 'bg-brown text-cream shadow-md ring-2 ring-brown/30'
                    : 'bg-cream-dark text-dark hover:bg-brown/10'
                }`}
              >
                <span className="text-sm">{p.gender === 'male' ? '👦' : '👧'}</span>
                <div className="text-left">
                  <p className={`text-sm font-medium ${i === selectedProfileIdx ? 'text-cream' : 'text-dark'}`}>{p.name}</p>
                  <p className={`text-[10px] ${i === selectedProfileIdx ? 'text-cream/70' : 'text-warm-gray'}`}>{p.relation}</p>
                </div>
              </button>
            ))}
          </div>
          {/* 선택된 프로필 수정/삭제 */}
          {profiles[selectedProfileIdx] && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-cream-dark">
              <p className="text-xs text-warm-gray">
                {profiles[selectedProfileIdx].name} · {profiles[selectedProfileIdx].gender === 'male' ? '남' : '여'} · {new Date(profiles[selectedProfileIdx].birth_date).toLocaleDateString('ko-KR')}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => navigate(`/edit-profile/${profiles[selectedProfileIdx].id}`)}
                  className="text-xs text-brown hover:text-brown-dark px-2 py-1 rounded-lg hover:bg-brown/5 transition-colors"
                >
                  수정
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`${profiles[selectedProfileIdx].name} 프로필을 삭제할까요?`)) return;
                    try {
                      await deleteProfile(profiles[selectedProfileIdx].id);
                      selectProfile(0);
                      showToast('프로필이 삭제되었어요');
                    } catch { showToast('삭제에 실패했어요'); }
                  }}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          )}
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

      {/* 멍도령 상담 풀폭 카드 */}
      <div className="mb-6">
        <div
          onClick={() => handleServiceClick('chat')}
          className="relative h-40 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-md"
        >
          <img
            src="/images/chat.png"
            alt="멍도령 상담"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white text-xl font-bold font-serif">멍도령 상담</h3>
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

      {/* 신규 서비스 */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-dark mb-3 flex items-center gap-2">
          <span>🔮</span> 새로운 풀이
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {NEW_SERVICES.map(service => (
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
