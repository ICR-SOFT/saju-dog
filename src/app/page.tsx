'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AppShell from '@/components/layout/AppShell';
import CostBadge from '@/components/ui/CostBadge';
import BannerSlider from '@/components/ui/BannerSlider';
import { useAuthStore } from '@/stores/auth';
import { useSajuStore } from '@/stores/saju';
import { useCreditStore } from '@/stores/credit';

interface ServiceItem {
  type: string;
  title: string;
  subtitle: string;
  cost: number;
  image: string;
}

const MAIN_SERVICES: ServiceItem[] = [
  { type: 'comprehensive', title: '종합 사주', subtitle: '타고난 운명을 12챕터로 깊이 풀어드려요', cost: 3, image: '/images/pixel/comprehensive.png' },
  { type: 'compatibility', title: '궁합', subtitle: '두 사람의 인연과 케미를 확인해요', cost: 3, image: '/images/pixel/compatibility.png' },
  { type: 'daeun', title: '대운 분석', subtitle: '언제 물 들어오는지 알려드려요', cost: 2, image: '/images/pixel/daeun.png' },
  { type: 'luckyday', title: '길일 택일', subtitle: 'Top 3 길일을 골라드려요', cost: 2, image: '/images/pixel/luckyday.png' },
  { type: 'yearly', title: '올해 운세', subtitle: '내후년 운세는 어떨까?', cost: 2, image: '/images/pixel/yearly.png' },
  { type: 'daily', title: '오늘의 운세', subtitle: '오늘 하루 운세와 행운 키워드', cost: 0, image: '/images/pixel/daily.png' },
];

const MORE_SERVICES: ServiceItem[] = [
  { type: 'business', title: '동업 궁합', subtitle: 'N명이 사업하면 몇 점?', cost: 3, image: '/images/pixel/business.png' },
  { type: 'love', title: '연애 시기', subtitle: '올해 연애운 타이밍은?', cost: 2, image: '/images/pixel/love.png' },
  { type: 'wealth', title: '재물운', subtitle: '돈이 들어오는 시기와 방향', cost: 2, image: '/images/pixel/wealth.png' },
  { type: 'health', title: '건강운', subtitle: '올해 조심할 건강 포인트', cost: 2, image: '/images/pixel/health.png' },
  { type: 'career', title: '직업 적성', subtitle: '타고난 직업 DNA는?', cost: 2, image: '/images/pixel/career.png' },
  { type: 'pastlife', title: '전생', subtitle: '전생에 당신은 누구였을까?', cost: 2, image: '/images/pixel/pastlife.png' },
  { type: 'moving', title: '이사운', subtitle: '언제 어디로 이동하면 좋을까?', cost: 2, image: '/images/pixel/moving.png' },
];

const NEW_SERVICES: ServiceItem[] = [
  { type: 'mbti', title: '사주 MBTI', subtitle: '사주로 보는 16가지 성격유형', cost: 2, image: '/images/pixel/mbti.png' },
  { type: 'pet', title: '반려동물', subtitle: '나와 찰떡인 반려동물은?', cost: 2, image: '/images/pixel/pet.png' },
  { type: 'travel', title: '여행 운세', subtitle: '올해 최고의 여행 방위는?', cost: 2, image: '/images/pixel/travel.png' },
  { type: 'food', title: '식복', subtitle: '오행으로 보는 행운 음식', cost: 2, image: '/images/pixel/food.png' },
  { type: 'color', title: '퍼스널컬러', subtitle: '오행 퍼스널컬러 진단', cost: 2, image: '/images/pixel/color.png' },
  { type: 'study', title: '합격 기운', subtitle: '시험/학업 운세와 공부법', cost: 2, image: '/images/pixel/study.png' },
  { type: 'ancestor', title: '조상 음덕', subtitle: '가문에서 받은 기운 분석', cost: 2, image: '/images/pixel/ancestor.png' },
  { type: 'child', title: '자녀운', subtitle: '미래 자녀의 타고난 특성', cost: 2, image: '/images/pixel/child.png' },
  { type: 'secret', title: '숨겨진 재능', subtitle: '사주 속 잠든 능력 발굴', cost: 2, image: '/images/pixel/secret.png' },
  { type: 'timing', title: '황금 타이밍', subtitle: '인생 전환점 종합 분석', cost: 2, image: '/images/pixel/timing.png' },
];

function ServiceCard({ service, onClick }: { service: ServiceItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="service-card relative overflow-hidden w-full text-left"
      style={{ aspectRatio: '1/1' }}
    >
      <Image
        src={service.image}
        alt={service.title}
        fill
        className="object-cover"
        sizes="(max-width: 480px) 50vw, 240px"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2.5" style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.8)' }}>
        <p className="font-pixel text-[11px] text-white leading-tight font-bold">
          {service.title}
        </p>
        <p className="text-[9px] text-white/90 mt-0.5 leading-tight">
          {service.subtitle}
        </p>
        <div className="mt-1">
          <CostBadge cost={service.cost} className="text-[8px]" />
        </div>
      </div>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, initialize } = useAuthStore();
  const { profiles, selectedProfileIdx, selectProfile, fetchProfiles } = useSajuStore();
  const { credits, fetchCredits } = useCreditStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
      fetchCredits();
    }
  }, [isAuthenticated, fetchProfiles, fetchCredits]);

  const handleServiceClick = (serviceType: string) => {
    const selectedProfile = profiles[selectedProfileIdx];
    if (serviceType === 'daily') { router.push('/daily'); return; }
    if (serviceType === 'compatibility' || serviceType === 'business') { router.push('/compatibility'); return; }
    if (!selectedProfile) { router.push('/profile/add'); return; }
    router.push(`/reading/${selectedProfile.id}?service=${serviceType}`);
  };

  // Not logged in: hero screen
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--bg-primary)]">
        <div className="text-center animate-fade-in">
          <Image
            src="/images/mascot-new.png"
            alt="사주독"
            width={96}
            height={96}
            className="mx-auto mb-4 rounded-full pixel-border"
          />
          <h1 className="font-pixel text-3xl text-[var(--text-primary)] mb-2">
            사주독
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-8">
            멍도령과 함께하는<br />사주 풀이 서비스
          </p>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="pixel-btn pixel-btn-accent text-white font-pixel px-8 py-3 text-sm w-full"
          >
            시작하기
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="pixel-loading" role="status" aria-label="로딩 중">
          <span /><span /><span /><span />
        </div>
      </div>
    );
  }

  return (
    <AppShell title="사주독" showNav>
      <div className="px-3 py-3">
        {/* Profile selector */}
        <section className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {profiles.map((profile, idx) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => selectProfile(idx)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 min-w-[72px] transition-all ${
                  selectedProfileIdx === idx
                    ? 'pixel-border-accent bg-[var(--accent-light)]'
                    : 'pixel-border-sm bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span className="font-pixel text-[10px] text-[var(--text-primary)] truncate max-w-[56px]">
                  {profile.name}
                </span>
                <span className="text-[9px] text-[var(--text-muted)]">
                  {profile.relation || '본인'}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => router.push('/profile/add')}
              className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[72px] pixel-border-sm bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
            >
              <span className="text-lg text-[var(--text-muted)]">+</span>
              <span className="font-pixel text-[10px] text-[var(--text-muted)]">추가</span>
            </button>
          </div>
          {profiles[selectedProfileIdx] && (
            <button
              type="button"
              onClick={() => router.push(`/profile/${profiles[selectedProfileIdx].id}/edit`)}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] mt-1"
            >
              프로필 수정
            </button>
          )}
        </section>

        {/* Banner Slider */}
        <BannerSlider onNavigate={(path) => {
          const selectedProfile = profiles[selectedProfileIdx];
          if (path.startsWith('/reading/') && selectedProfile) {
            router.push(path.replace(':profileId', selectedProfile.id));
          } else {
            router.push(path);
          }
        }} />

        {/* Main services - 2 column image cards */}
        <section className="mb-4">
          <h2 className="font-pixel text-xs text-[var(--text-primary)] mb-2">주요 서비스</h2>
          <div className="grid grid-cols-2 gap-2">
            {MAIN_SERVICES.map((service) => (
              <ServiceCard
                key={service.type}
                service={service}
                onClick={() => handleServiceClick(service.type)}
              />
            ))}
          </div>
        </section>

        {/* 멍도령 Chat banner */}
        <section className="mb-4">
          <button
            type="button"
            onClick={() => router.push('/chat')}
            className="service-card relative w-full overflow-hidden"
            style={{ height: '100px' }}
          >
            <Image
              src="/images/pixel/chat.png"
              alt="멍도령 상담"
              fill
              className="object-cover"
              sizes="480px"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
            <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}>
              <p className="font-pixel text-sm text-white font-bold">멍도령 상담</p>
              <p className="text-[10px] text-white/90 mt-0.5">멍도령에게 직접 물어보세요</p>
            </div>
          </button>
        </section>

        {/* More services */}
        <section className="mb-4">
          <h2 className="font-pixel text-xs text-[var(--text-primary)] mb-2">더 많은 풀이</h2>
          <div className="grid grid-cols-3 gap-2">
            {MORE_SERVICES.map((service) => (
              <ServiceCard
                key={service.type}
                service={service}
                onClick={() => handleServiceClick(service.type)}
              />
            ))}
          </div>
        </section>

        {/* New services */}
        <section className="mb-4">
          <h2 className="font-pixel text-xs text-[var(--text-primary)] mb-2">신규 서비스</h2>
          <div className="grid grid-cols-3 gap-2">
            {NEW_SERVICES.map((service) => (
              <ServiceCard
                key={service.type}
                service={service}
                onClick={() => handleServiceClick(service.type)}
              />
            ))}
          </div>
        </section>

        {/* Credit display */}
        <div className="text-center py-3 border-t-2 border-[var(--pixel-border)]">
          <span className="font-pixel text-sm text-[var(--gold)]">
            {credits?.bones ?? 0}개
          </span>
          <span className="text-[10px] text-[var(--text-muted)] ml-1">보유 중</span>
        </div>
      </div>
    </AppShell>
  );
}
