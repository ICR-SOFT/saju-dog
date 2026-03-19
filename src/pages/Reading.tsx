import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { FourPillars } from '@/components/saju/FourPillars.tsx';
import { OhaengBar } from '@/components/saju/OhaengBar.tsx';
import { DaeunTimeline } from '@/components/saju/DaeunTimeline.tsx';
import { ChapterAccordion } from '@/components/saju/ChapterAccordion.tsx';
import { Loading } from '@/components/ui/Loading.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { calculateSaju } from '@/core/calculator.ts';
import type { SajuPillars } from '@/types/saju.ts';

export function Reading() {
  const { profileId } = useParams<{ profileId: string }>();
  const { profiles, requestReading, currentReading, isLoading, error, clearCurrentReading } = useSajuStore();
  const [sajuData, setSajuData] = useState<SajuPillars | null>(null);

  const profile = profiles.find(p => p.id === profileId);

  useEffect(() => {
    clearCurrentReading();

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

      // Edge Function이 배포되면 AI 풀이 요청
      if (profileId) {
        requestReading(profileId, 'comprehensive').catch(() => {
          // Edge Function 미배포 시 무시
        });
      }
    }
  }, [profileId, profile, requestReading, clearCurrentReading]);

  if (!profile) {
    return (
      <Layout>
        <p className="text-center text-warm-gray py-12">프로필을 찾을 수 없습니다</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <h2 className="text-xl font-bold text-dark mb-4 font-serif">
        {profile.name}님의 사주풀이
      </h2>

      {/* 사주팔자 시각화 — 항상 로컬 계산으로 즉시 표시 */}
      {sajuData && (
        <div className="space-y-3 mb-6">
          {/* 기본 정보 배지 */}
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="text-xs bg-brown/10 text-brown rounded-full px-3 py-1 font-medium">
              {sajuData.ddi.fullName}
            </span>
            <span className="text-xs bg-brown/10 text-brown rounded-full px-3 py-1 font-medium">
              {sajuData.zodiac.emoji} {sajuData.zodiac.name}
            </span>
          </div>

          <FourPillars data={sajuData} />
          <OhaengBar count={sajuData.ohaengCount} />
          <DaeunTimeline daeun={sajuData.daeun} />

          {/* 신살 */}
          {(sajuData.sinsal.allSinsal.length > 0 || sajuData.sinsal.guiin.length > 0) && (
            <Card>
              <h3 className="text-sm font-medium text-warm-gray mb-2">신살 & 귀인</h3>
              {sajuData.sinsal.guiin.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {sajuData.sinsal.guiin.map((g, i) => (
                    <span key={i} className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1">
                      {g}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {sajuData.sinsal.allSinsal.map((s, i) => (
                  <span key={i} className="text-xs bg-red-50 text-red-600 rounded-full px-2.5 py-1">
                    {s}
                  </span>
                ))}
              </div>
              {sajuData.sinsal.gongmang.length > 0 && (
                <p className="text-xs text-warm-gray mt-2">
                  공망: {sajuData.sinsal.gongmang.join(', ')}
                </p>
              )}
            </Card>
          )}

          {/* 특수 관계 */}
          {sajuData.specialFormations.length > 0 && (
            <Card>
              <h3 className="text-sm font-medium text-warm-gray mb-2">특수 관계</h3>
              <div className="flex flex-wrap gap-1.5">
                {sajuData.specialFormations.map((f, i) => (
                  <span key={i} className="text-xs bg-cream-dark rounded-full px-2.5 py-1 text-dark-light">
                    {f.description}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* 올해 세운 */}
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

      {/* AI 풀이 결과 */}
      {isLoading ? (
        <Loading message="복돌이가 사주를 분석하고 있어요..." />
      ) : error ? (
        <Card className="text-center bg-cream-dark/50">
          <p className="text-sm text-warm-gray mb-2">
            AI 풀이를 불러올 수 없습니다
          </p>
          <p className="text-xs text-warm-gray-light mb-3">
            Edge Functions 배포 후 이용 가능합니다
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => profileId && requestReading(profileId, 'comprehensive').catch(() => {})}
          >
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

          {currentReading.advice && currentReading.advice.length > 0 && (
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
    </Layout>
  );
}
