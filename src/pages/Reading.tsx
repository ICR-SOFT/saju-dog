import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { FourPillars } from '@/components/saju/FourPillars.tsx';
import { OhaengBar } from '@/components/saju/OhaengBar.tsx';
import { DaeunTimeline } from '@/components/saju/DaeunTimeline.tsx';
import { ChapterAccordion } from '@/components/saju/ChapterAccordion.tsx';
import { Loading } from '@/components/ui/Loading.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { calculateSaju } from '@/core/calculator.ts';
import type { SajuPillars } from '@/types/saju.ts';

type ReadingPhase = 'view' | 'confirm' | 'loading' | 'result' | 'error';

export function Reading() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const { profiles, requestReading, currentReading, isLoading, error, clearCurrentReading, readings, fetchReadings } = useSajuStore();
  const { credits } = useCreditStore();
  const [sajuData, setSajuData] = useState<SajuPillars | null>(null);
  const [phase, setPhase] = useState<ReadingPhase>('view');

  const profile = profiles.find(p => p.id === profileId);

  // 기존 풀이 캐시 확인
  const cachedReading = readings.find(
    r => r.profile_id === profileId && r.service_type === 'comprehensive' && r.status === 'completed'
  );

  useEffect(() => {
    clearCurrentReading();
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
  }, [profileId, profile, clearCurrentReading, fetchReadings]);

  const handleRequestReading = async () => {
    if (!profileId) return;
    setPhase('loading');
    try {
      await requestReading(profileId, 'comprehensive');
      setPhase('result');
    } catch {
      setPhase('error');
    }
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

  const pillarNames = ['year', 'month', 'day', 'hour'] as const;
  const pillarLabels = { year: '년주', month: '월주', day: '일주', hour: '시주' };

  return (
    <Layout>
      {/* 프로필 헤더 */}
      <div className="text-center mb-4 -mx-4 -mt-4 px-4 pt-5 pb-4 gradient-hero rounded-b-3xl">
        <h2 className="text-xl font-bold text-dark font-serif">
          {profile.name}님의 사주풀이
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
      <div className="border-t-2 border-brown/20 pt-4 mt-2">
        <h3 className="text-lg font-bold text-dark font-serif mb-3">
          🐕 복돌이 풀이
        </h3>

        {/* 이미 풀이된 결과가 있는 경우 */}
        {cachedReading?.result && phase === 'view' ? (
          <div className="space-y-4">
            <Card className="text-center bg-green-50/50 border-green-200">
              <p className="text-xs text-green-600 mb-1">이전 풀이 결과</p>
              <p className="text-lg font-medium text-dark font-serif">
                "{(cachedReading.result as any).summary}"
              </p>
              <p className="text-xs text-warm-gray mt-1">
                {new Date(cachedReading.created_at).toLocaleDateString('ko-KR')} 풀이
              </p>
            </Card>

            {(cachedReading.result as any).chapters && (
              <ChapterAccordion chapters={(cachedReading.result as any).chapters} />
            )}

            <Button variant="secondary" size="lg" onClick={() => setPhase('confirm')}>
              새로 풀이받기 (🦴 3개)
            </Button>
          </div>
        ) : phase === 'view' || phase === 'confirm' ? (
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
                <span className="text-dark">약 30~60초</span>
              </div>
            </div>

            {(credits?.bones ?? 0) < 3 ? (
              <p className="text-sm text-red-500 mb-3">뼈다귀가 부족합니다</p>
            ) : null}

            <Button
              size="lg"
              onClick={handleRequestReading}
              disabled={(credits?.bones ?? 0) < 3}
            >
              🦴 3개로 풀이받기
            </Button>
          </Card>
        ) : phase === 'loading' || isLoading ? (
          <Card className="text-center py-8 gradient-hero">
            <Loading message="복돌이가 사주를 분석하고 있어요..." size="lg" />
            <div className="mt-4 space-y-1">
              <p className="text-xs text-warm-gray animate-pulse-warm">복돌이가 12~15개 챕터를 작성 중이에요</p>
              <p className="text-xs text-warm-gray-light">약 30~60초 소요됩니다</p>
            </div>
          </Card>
        ) : phase === 'error' || error ? (
          <Card className="text-center">
            <p className="text-red-500 mb-3 text-sm">{error || '풀이를 불러올 수 없습니다'}</p>
            <p className="text-xs text-warm-gray mb-3">Edge Functions 배포 상태를 확인하세요</p>
            <Button variant="secondary" onClick={() => setPhase('confirm')}>
              다시 시도
            </Button>
          </Card>
        ) : currentReading ? (
          <div className="space-y-4">
            <Card className="text-center bg-brown/5">
              <p className="text-lg font-medium text-dark font-serif">
                "{currentReading.summary}"
              </p>
            </Card>

            <ChapterAccordion chapters={currentReading.chapters} />

            {currentReading.advice?.length > 0 && (
              <Card>
                <h3 className="font-medium text-dark mb-2">복돌이의 조언</h3>
                <ul className="space-y-2">
                  {currentReading.advice.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm text-dark-light">
                      <span className="text-brown">🐾</span><span>{a}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {currentReading.luckyItems && (
              <Card>
                <h3 className="font-medium text-dark mb-2">행운 아이템</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(currentReading.luckyItems).map(([key, val]) => (
                    <div key={key} className="bg-cream-dark rounded-lg p-2 text-center">
                      <p className="text-warm-gray text-xs">
                        {key === 'color' ? '행운 색' : key === 'number' ? '행운 숫자' : key === 'direction' ? '행운 방향' : '행운 음식'}
                      </p>
                      <p className="font-medium text-dark">{val}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
