import DOMPurify from 'dompurify';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { FourPillars } from '@/components/saju/FourPillars.tsx';
import { OhaengBar } from '@/components/saju/OhaengBar.tsx';
import { DaeunTimeline } from '@/components/saju/DaeunTimeline.tsx';
import { ChapterAccordion } from '@/components/saju/ChapterAccordion.tsx';
import { Recommendations } from '@/components/saju/Recommendations.tsx';
import { PhotoLoading } from '@/components/ui/PhotoLoading.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { calculateSaju } from '@/core/calculator.ts';
import { createShareLink } from '@/lib/share.ts';
import type { SajuPillars, ServiceType } from '@/types/saju.ts';
import type { SajuProfile } from '@/types/user.ts';
import { supabase } from '@/lib/supabase.ts';
import { getZodiacImageUrl, getZodiacFallbackUrl } from '@/lib/zodiac-images.ts';

type ReadingPhase = 'view' | 'confirm' | 'loading' | 'result' | 'error';

export function Reading() {
  const { profileId } = useParams<{ profileId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    profiles, startReading, currentReading, error,
    clearCurrentReading, readings, fetchReadings, fetchProfiles,
    pendingProfileId, readingCache,
    processingStatus, processingInfo,
  } = useSajuStore();
  const { credits, fetchCredits } = useCreditStore();
  const [sajuData, setSajuData] = useState<SajuPillars | null>(null);
  const [shareToast, setShareToast] = useState('');
  const [directProfile, setDirectProfile] = useState<SajuProfile | null>(null);

  const serviceType = (searchParams.get('service') as ServiceType) || 'comprehensive';

  // 스토어에 프로필이 없으면 DB에서 직접 조회 (새로고침 대응)
  const storeProfile = profiles.find(p => p.id === profileId);
  const profile = storeProfile || directProfile;

  // 캐시된 결과 확인 (store readingCache 우선, 서비스 타입별)
  const cacheKey = profileId ? `${profileId}:${serviceType}` : '';
  const cachedResult = cacheKey ? readingCache[cacheKey] : undefined;

  // DB readings에서 이 프로필의 상태 확인
  const cachedReading = readings.find(
    r => r.profile_id === profileId && r.service_type === serviceType && r.processing_status === 'completed'
  );

  // 풀이 중인 reading이 있는지 (중복 방지)
  const processingReading = readings.find(
    r => r.profile_id === profileId && r.service_type === serviceType &&
      (r.processing_status === 'pending' || r.processing_status === 'processing')
  );

  // 현재 표시할 결과: store cache > currentReading > DB cache result
  const dbCachedResult = cachedReading?.result as unknown as import('@/types/saju.ts').SajuApiResponse | undefined;
  const displayResult = cachedResult ?? currentReading ?? dbCachedResult ?? null;

  // 예상 대기시간 계산 (최근 완료된 readings의 평균 duration)
  const estimatedWaitSec = useMemo(() => {
    const completed = readings.filter(r => r.processing_status === 'completed' && r.processing_duration_ms);
    if (completed.length === 0) return 45; // 기본값
    const recent = completed.slice(0, 10);
    const avg = recent.reduce((sum, r) => sum + (r.processing_duration_ms || 0), 0) / recent.length;
    return Math.round(avg / 1000);
  }, [readings]);

  // Phase를 store 상태에서 파생
  const phase: ReadingPhase = useMemo(() => {
    // 스토어에서 이 프로필을 처리 중
    if (pendingProfileId === profileId && (processingStatus === 'requesting' || processingStatus === 'processing')) {
      return 'loading';
    }
    // DB에서 풀이 중인 reading 발견
    if (processingReading) {
      return 'loading';
    }
    if (processingStatus === 'failed' && error && !displayResult) {
      return 'error';
    }
    if (displayResult) {
      return 'result';
    }
    return 'view';
  }, [pendingProfileId, profileId, processingStatus, error, displayResult, processingReading]);

  const [localPhase, setLocalPhase] = useState<ReadingPhase | null>(null);

  // 실제 사용 phase: localPhase가 있으면 그것 사용, 없으면 store 파생 phase
  const activePhase = localPhase ?? phase;

  // 프로필이 스토어에 없으면 DB에서 직접 로드
  useEffect(() => {
    if (!storeProfile && profileId) {
      fetchProfiles(); // 스토어 전체 로드 시도
      fetchCredits();
      // 동시에 직접 조회
      supabase.from('saju_profiles').select('*').eq('id', profileId).single()
        .then(({ data }) => { if (data) setDirectProfile(data as SajuProfile); });
    }
  }, [storeProfile, profileId, fetchProfiles, fetchCredits]);

  useEffect(() => {
    if (!cachedResult) {
      clearCurrentReading();
    }
    fetchReadings();

    if (profile) {
      const data = calculateSaju({
        name: profile.name,
        birthDate: new Date(profile.birth_date),
        gender: profile.gender as 'male' | 'female',
        calendarType: profile.calendar_type as 'solar' | 'lunar' | 'lunar_leap',
        useTrueSolar: profile.use_true_solar,
        longitude: profile.longitude,
      });
      setSajuData(data);
    }

    setLocalPhase(null);
  }, [profileId, profile, clearCurrentReading, fetchReadings, cachedResult]);

  // DB에 풀이 중인 reading이 있으면 자동 폴링
  useEffect(() => {
    if (!processingReading) return;
    const interval = setInterval(() => {
      fetchReadings();
    }, 5000);
    return () => clearInterval(interval);
  }, [processingReading, fetchReadings]);

  const handleRequestReading = (force = false) => {
    if (!profileId) return;
    setLocalPhase(null);
    startReading(profileId, serviceType, force);
  };

  if (!profile) {
    return (
      <Layout>
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">🐕</p>
          <p className="text-warm-gray mb-3">프로필을 찾을 수 없습니다</p>
          <Button onClick={() => navigate('/')}>홈으로</Button>
        </Card>
      </Layout>
    );
  }

  const SERVICE_LABELS: Record<string, string> = {
    comprehensive: '종합 사주풀이',
    daeun: '대운 해설',
    yearly: '연도별 운세',
    luckyday: '택일/길일',
    love: '연애 시기 분석',
    wealth: '재물운 특화',
    health: '건강운 분석',
    career: '직업 적성 분석',
    pastlife: '전생 이야기',
    moving: '이사/부동산 운',
  };

  const pillarNames = ['year', 'month', 'day', 'hour'] as const;
  const pillarLabels = { year: '년주', month: '월주', day: '일주', hour: '시주' };

  return (
    <Layout>
      {/* 띠 이미지 (텍스트 없이 꽉 차게) */}
      <div className="relative -mx-4 -mt-4 rounded-b-3xl overflow-hidden" style={{ height: '240px' }}>
        {sajuData && (
          <img
            src={getZodiacImageUrl(sajuData.ddi.animal, sajuData.pillars.year.stem, sajuData.pillars.year.branch, sajuData.zodiac.name)}
            alt={sajuData.ddi.fullName}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = getZodiacFallbackUrl(sajuData.ddi.animal); }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-cream via-transparent to-transparent" style={{ height: '40%', top: '60%' }} />
      </div>

      {/* 프로필 정보 (이미지 아래) */}
      <div className="text-center -mt-6 mb-4 relative z-10">
        <h2 className="text-xl font-bold text-dark font-serif">
          {profile.name}님의 {serviceType !== 'comprehensive' && SERVICE_LABELS[serviceType] ? SERVICE_LABELS[serviceType] : '사주풀이'}
        </h2>
        {sajuData && (
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            <span className="text-xs bg-brown/10 text-brown rounded-full px-3 py-1 font-medium">
              {sajuData.ddi.fullName}
            </span>
            <span className="text-xs bg-brown/10 text-brown rounded-full px-3 py-1 font-medium">
              {sajuData.zodiac.emoji} {sajuData.zodiac.name}
            </span>
          </div>
        )}
      </div>

      {sajuData && (
        <div className="space-y-3 mb-6">
          {/* 사주팔자 */}
          <FourPillars data={sajuData} />
          <OhaengBar count={sajuData.ohaengCount} />

          {/* 기둥별 신살 & 관계 */}
          <Card>
            <h3 className="text-sm font-medium text-warm-gray mb-3">기둥별 신살 & 관계</h3>
            <div className="grid grid-cols-4 gap-1 text-center">
              {pillarNames.map(name => (
                <div key={name} className="space-y-1">
                  <p className="text-xs font-medium text-dark">{pillarLabels[name]}</p>
                  {/* 신살 */}
                  {sajuData.sinsal.pillarSinsal[name].map((s, i) => (
                    <span key={`s-${i}`} className="block text-[10px] bg-amber-50 text-amber-700 rounded px-1 py-0.5">
                      {s}
                    </span>
                  ))}
                  {/* 관계 */}
                  {sajuData.sinsal.pillarRelations[name].map((r, i) => (
                    <span key={`r-${i}`} className="block text-[10px] bg-blue-50 text-blue-600 rounded px-1 py-0.5">
                      {r}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          {/* 귀인 */}
          {sajuData.sinsal.guiin.length > 0 && (
            <Card padding="sm">
              <h3 className="text-xs font-medium text-warm-gray mb-1.5">귀인</h3>
              <div className="flex flex-wrap gap-1">
                {sajuData.sinsal.guiin.map((g, i) => (
                  <span key={i} className="text-[10px] bg-green-50 text-green-700 rounded-full px-2 py-0.5">
                    {g}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* 전체 신살 */}
          {sajuData.sinsal.allSinsal.length > 0 && (
            <Card padding="sm">
              <h3 className="text-xs font-medium text-warm-gray mb-1.5">전체 신살</h3>
              <div className="flex flex-wrap gap-1">
                {sajuData.sinsal.allSinsal.map((s, i) => (
                  <span key={i} className="text-[10px] bg-red-50 text-red-600 rounded-full px-2 py-0.5">
                    {s}
                  </span>
                ))}
              </div>
              {sajuData.sinsal.gongmang.length > 0 && (
                <p className="text-[10px] text-warm-gray mt-1">공망: {sajuData.sinsal.gongmang.join(', ')}</p>
              )}
            </Card>
          )}

          <DaeunTimeline daeun={sajuData.daeun} />

          {/* 세운 */}
          <Card padding="sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-warm-gray">{sajuData.currentYear.year}년 세운</span>
              <span className="font-bold text-dark font-serif">
                {sajuData.currentYear.stem}{sajuData.currentYear.branch}
              </span>
              <span className="text-xs text-warm-gray">
                {sajuData.currentYear.stemSipsin} / {sajuData.currentYear.branchSipsin}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* 복돌이 풀이 섹션 */}
      <div className="mt-4">
        <Card className="bg-gradient-to-br from-amber-50/80 to-orange-50/50 border-brown/10 mb-4">
          <h3 className="text-lg font-bold text-dark font-serif flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-brown/10 flex items-center justify-center text-lg">🐕</span>
            복돌이 풀이
          </h3>
        </Card>

        {/* 결과가 있으면 (store cache / currentReading / DB cache) 전체 표시 */}
        {displayResult && (activePhase === 'view' || activePhase === 'result') ? (
          <div className="space-y-4">
            {/* 요약 */}
            <Card className="text-center bg-gradient-to-br from-brown/5 to-amber-50/30">
              <p className="text-lg font-medium text-dark font-serif">
                "{displayResult.summary}"
              </p>
              {cachedReading && (
                <p className="text-xs text-warm-gray mt-1">
                  {new Date(cachedReading.created_at).toLocaleDateString('ko-KR')} 풀이
                  {cachedReading.processing_duration_ms && ` · ${(cachedReading.processing_duration_ms / 1000).toFixed(0)}초 소요`}
                </p>
              )}
            </Card>

            {/* 챕터 */}
            {displayResult.chapters && (
              <ChapterAccordion chapters={displayResult.chapters} />
            )}

            {/* 조언 */}
            {displayResult.advice && displayResult.advice.length > 0 && (
              <Card>
                <h3 className="font-bold text-dark mb-2 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-brown/10 flex items-center justify-center text-sm">🐾</span>
                  복돌이의 조언
                </h3>
                <ul className="space-y-2">
                  {displayResult.advice.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm text-dark-light">
                      <span className="text-brown">•</span><span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(a) }} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* 행운 아이템 */}
            {displayResult.luckyItems && (
              <Card className="bg-gradient-to-br from-emerald-50/50 to-green-50/30">
                <h3 className="text-sm font-bold text-dark mb-2 text-center">🍀 행운 아이템</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(displayResult.luckyItems).map(([key, val]) => (
                    <div key={key} className="bg-white/70 rounded-xl p-2.5 text-center shadow-sm">
                      <p className="text-warm-gray text-xs">
                        {key === 'color' ? '🎨 행운 색' : key === 'number' ? '🔢 행운 숫자' : key === 'direction' ? '🧭 행운 방향' : '🍽️ 행운 음식'}
                      </p>
                      <p className="font-bold text-dark mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 공유 */}
            {cachedReading?.id && (
              <Card className="text-center bg-gradient-to-br from-sky-50/50 to-blue-50/30">
                <p className="text-sm text-dark mb-2">이 풀이를 친구에게 공유해보세요!</p>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={async () => {
                    try {
                      const url = await createShareLink(cachedReading.id);
                      await navigator.clipboard.writeText(url);
                      setShareToast('링크가 복사되었어요!');
                      setTimeout(() => setShareToast(''), 2000);
                    } catch { setShareToast('공유 링크 생성에 실패했어요'); setTimeout(() => setShareToast(''), 2000); }
                  }}
                >
                  📋 공유 링크 복사
                </Button>
              </Card>
            )}

            {/* 새로 풀이받기 */}
            <Button variant="ghost" size="lg" onClick={() => handleRequestReading(true)} className="text-warm-gray">
              다시 풀이받기 (🦴 차감)
            </Button>

            <Recommendations exclude={[serviceType]} />
          </div>
        ) : activePhase === 'view' || activePhase === 'confirm' ? (
          <Card className="text-center">
            <div className="text-4xl mb-3">🔮</div>
            <p className="text-dark font-medium mb-1">종합 사주풀이</p>
            <p className="text-sm text-warm-gray mb-4">
              복돌이가 사주를 깊이 분석하고<br />12~15개 챕터로 풀어드려요
            </p>

            <div className="bg-cream-dark rounded-xl p-3 mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-warm-gray">비용</span>
                <span className="font-medium text-dark">🦴 3개</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-warm-gray">보유</span>
                <span className={`font-medium ${(credits?.bones ?? 0) >= 3 ? 'text-green-600' : 'text-red-500'}`}>
                  🦴 {credits?.bones ?? 0}개
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-gray">예상 소요</span>
                <span className="text-dark">약 {estimatedWaitSec}초</span>
              </div>
            </div>

            {(credits?.bones ?? 0) < 3 ? (
              <p className="text-sm text-red-500 mb-3">뼈다귀가 부족합니다</p>
            ) : null}

            <Button
              size="lg"
              onClick={() => handleRequestReading(false)}
              disabled={(credits?.bones ?? 0) < 3}
            >
              🦴 3개로 풀이받기
            </Button>
          </Card>
        ) : activePhase === 'loading' ? (
          <Card className="text-center py-4 gradient-hero">
            <PhotoLoading />
            <div className="mt-2 space-y-1">
              <p className="text-xs text-warm-gray animate-pulse-warm">
                {processingStatus === 'requesting' ? '요청을 접수하고 있어요...' : '복돌이가 12~15개 챕터를 작성 중이에요'}
              </p>
              <p className="text-xs text-warm-gray-light">
                {processingStatus === 'requesting' ? '잠시만 기다려주세요' : `예상 약 ${estimatedWaitSec}초 · 페이지를 나가도 보관함에서 확인할 수 있어요`}
              </p>
            </div>
          </Card>
        ) : activePhase === 'error' ? (
          <Card className="text-center bg-gradient-to-br from-red-50/50 to-orange-50/30 border-red-200/50">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-2xl">😢</span>
            </div>
            <p className="text-red-500 mb-3 text-sm font-medium">{error || '풀이를 불러올 수 없습니다'}</p>
            {processingInfo?.refunded && (
              <p className="text-xs text-green-600 mb-3">크레딧이 자동 환불되었습니다</p>
            )}
            {processingInfo?.failure_reason && (
              <p className="text-xs text-warm-gray mb-3">{processingInfo.failure_reason}</p>
            )}
            <Button variant="secondary" onClick={() => { setLocalPhase(null); handleRequestReading(); }}>
              다시 시도
            </Button>
          </Card>
        ) : null}

        {/* 공유 토스트 */}
        {shareToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-dark text-white text-sm px-5 py-2.5 rounded-full shadow-lg animate-fade-in">
            {shareToast}
          </div>
        )}
      </div>

      {/* 플로팅 공유 버튼 */}
      {displayResult && cachedReading?.id && (
        <button
          onClick={async () => {
            try {
              const url = await createShareLink(cachedReading.id);
              await navigator.clipboard.writeText(url);
              setShareToast('링크가 복사되었어요!');
              setTimeout(() => setShareToast(''), 2000);
            } catch { setShareToast('공유 실패'); setTimeout(() => setShareToast(''), 2000); }
          }}
          className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-brown text-white shadow-lg flex items-center justify-center text-lg hover:bg-brown-dark active:scale-95 transition-all"
          title="공유하기"
        >
          📋
        </button>
      )}
    </Layout>
  );
}
