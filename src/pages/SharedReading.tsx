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
import { getSharedReading } from '@/lib/share.ts';
import { calculateSaju } from '@/core/calculator.ts';
import type { Reading } from '@/types/user.ts';
import type { SajuApiResponse, SajuPillars } from '@/types/saju.ts';

const SERVICE_LABELS: Record<string, { label: string; emoji: string }> = {
  comprehensive: { label: '종합 사주풀이', emoji: '🔮' },
  compatibility: { label: '궁합', emoji: '💕' },
  daily: { label: '오늘의 운세', emoji: '🌅' },
  daeun: { label: '대운 분석', emoji: '🌊' },
  yearly: { label: '연간 운세', emoji: '📅' },
  business: { label: '동업 궁합', emoji: '🤝' },
  luckyday: { label: '길일 추천', emoji: '🗓️' },
  love: { label: '연애 시기 분석', emoji: '💘' },
  wealth: { label: '재물운 특화', emoji: '💎' },
  health: { label: '건강운 분석', emoji: '🏥' },
  career: { label: '직업 적성 분석', emoji: '🎯' },
  pastlife: { label: '전생 이야기', emoji: '🔮' },
  moving: { label: '이사/부동산 운', emoji: '🏠' },
};

export function SharedReading() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const [reading, setReading] = useState<(Reading & { saju_profiles?: any }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sajuData, setSajuData] = useState<SajuPillars | null>(null);

  useEffect(() => {
    if (!shareId) return;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getSharedReading(shareId);
        setReading(data as any);

        // 프로필 데이터가 있으면 만세력 계산
        const profile = data.saju_profiles;
        if (profile?.calculated_saju) {
          // DB에 저장된 calculated_saju 직접 사용
          setSajuData(profile.calculated_saju as SajuPillars);
        } else if (profile?.birth_date) {
          // 없으면 직접 계산
          const saju = calculateSaju({
            name: profile.name || '',
            birthDate: new Date(profile.birth_date),
            gender: (profile.gender || 'male') as 'male' | 'female',
            calendarType: (profile.calendar_type || 'solar') as 'solar' | 'lunar' | 'lunar_leap',
            useTrueSolar: true,
            longitude: 126.978,
          });
          setSajuData(saju);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '풀이를 찾을 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [shareId]);

  const serviceInfo = reading
    ? SERVICE_LABELS[reading.service_type] ?? { label: reading.service_type, emoji: '📄' }
    : { label: '', emoji: '' };

  const result = reading?.result as unknown as SajuApiResponse | null;
  const profileName = reading?.saju_profiles?.name || '';

  if (isLoading) return <Layout><Loading message="풀이를 불러오는 중..." /></Layout>;

  if (error || !reading) {
    return (
      <Layout>
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">🐕</p>
          <p className="text-warm-gray mb-3">{error || '공유된 풀이를 찾을 수 없습니다'}</p>
          <Button onClick={() => navigate('/')}>홈으로 가기</Button>
        </Card>
      </Layout>
    );
  }

  const pillarNames = ['year', 'month', 'day', 'hour'] as const;
  const pillarLabels = { year: '년주', month: '월주', day: '일주', hour: '시주' };

  return (
    <Layout>
      {/* 브랜딩 헤더 */}
      <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-6 rounded-b-3xl relative overflow-hidden gradient-hero">
        <div className="absolute inset-0 paw-bg opacity-30" />
        <div className="relative z-10">
          <div className="flex justify-center items-center gap-2 mb-2">
            <img src="/images/logo.png" alt="사주독" className="w-10 h-10 rounded-full shadow-sm" />
          </div>
          <p className="text-xs text-warm-gray mb-2 font-medium">사주독 — 사주로 보는 나의 이야기</p>
          <span className="text-4xl">{serviceInfo.emoji}</span>
          <h2 className="text-xl font-bold text-dark font-serif mt-2">
            {profileName ? `${profileName}님의 ${serviceInfo.label}` : serviceInfo.label}
          </h2>
          <p className="text-sm text-warm-gray mt-1">
            {new Date(reading.created_at).toLocaleDateString('ko-KR')}
          </p>
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
      </div>

      {/* 만세력 정보 */}
      {sajuData && (
        <div className="space-y-3 mb-6">
          <FourPillars data={sajuData} />
          <OhaengBar count={sajuData.ohaengCount} />

          {/* 기둥별 신살 & 관계 */}
          <Card>
            <h3 className="text-sm font-bold text-dark mb-3 flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-brown/10 flex items-center justify-center text-xs">⚡</span>
              기둥별 신살 & 관계
            </h3>
            <div className="grid grid-cols-4 gap-1 text-center">
              {pillarNames.map(name => (
                <div key={name} className="space-y-1">
                  <p className="text-xs font-medium text-dark">{pillarLabels[name]}</p>
                  {sajuData.sinsal.pillarSinsal[name].map((s, i) => (
                    <span key={`s-${i}`} className="block text-[10px] bg-amber-50 text-amber-700 rounded px-1 py-0.5">{s}</span>
                  ))}
                  {sajuData.sinsal.pillarRelations[name].map((r, i) => (
                    <span key={`r-${i}`} className="block text-[10px] bg-blue-50 text-blue-600 rounded px-1 py-0.5">{r}</span>
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
                  <span key={i} className="text-[10px] bg-green-50 text-green-700 rounded-full px-2 py-0.5">{g}</span>
                ))}
              </div>
            </Card>
          )}

          <DaeunTimeline daeun={sajuData.daeun} />
        </div>
      )}

      {/* 풀이 결과 */}
      {result ? (
        <div className="space-y-4">
          {result.summary && (
            <Card className="text-center bg-gradient-to-br from-brown/5 to-amber-50/30">
              <p className="text-lg font-medium text-dark font-serif">"{result.summary}"</p>
            </Card>
          )}

          {result.overallScore !== undefined && (
            <Card className="text-center">
              <p className="text-5xl font-bold text-brown font-serif">{result.overallScore}</p>
              <p className="text-sm text-warm-gray mt-1">점수</p>
            </Card>
          )}

          {result.chapters && <ChapterAccordion chapters={result.chapters} />}

          {result.advice && result.advice.length > 0 && (
            <Card>
              <h3 className="font-bold text-dark mb-2 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-brown/10 flex items-center justify-center text-sm">🐾</span>
                복돌이의 조언
              </h3>
              <ul className="space-y-2">
                {result.advice.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-dark-light">
                    <span className="text-brown">•</span><span>{a}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {result.luckyItems && (
            <Card className="bg-gradient-to-br from-emerald-50/50 to-green-50/30">
              <h3 className="text-sm font-bold text-dark mb-2 text-center">🍀 행운 아이템</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(result.luckyItems).map(([key, val]) => (
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
        </div>
      ) : (
        <Card className="text-center py-8">
          <p className="text-warm-gray">결과 데이터가 없습니다</p>
        </Card>
      )}

      {/* CTA */}
      <div className="mt-8 text-center">
        <Card className="border-brown/15 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FECACA20 50%, #FDE68A40 100%)' }}>
          <div className="absolute inset-0 paw-bg opacity-20" />
          <div className="relative z-10">
            <span className="text-4xl animate-float inline-block">🐕</span>
            <p className="font-bold text-dark text-lg mt-2 font-serif">나도 사주 보러 가기</p>
            <p className="text-sm text-warm-gray mb-4">사주독에서 나만의 운세를 확인해보세요</p>
            <Button onClick={() => navigate('/')} size="lg">사주독 시작하기</Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
