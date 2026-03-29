import DOMPurify from 'dompurify';
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
import { ScoreRing } from '@/components/ui/ScoreRing.tsx';
import { getSharedReading } from '@/lib/share.ts';
import { supabase } from '@/lib/supabase.ts';
import { calculateSaju } from '@/core/calculator.ts';
import { ProfileInfoBadges } from '@/components/saju/ProfileInfoBadges.tsx';
import { getZodiacImageUrl, getCompatibilityImageUrl } from '@/lib/zodiac-images.ts';
import type { Reading } from '@/types/user.ts';
import type { SajuApiResponse, SajuPillars } from '@/types/saju.ts';

interface DailyResult {
  summary: string;
  overallLuck: number;
  categories: {
    love: { score: number; message: string };
    money: { score: number; message: string };
    work: { score: number; message: string };
    health: { score: number; message: string };
  };
  advice: string;
  luckyItems: { color: string; number: string; food: string };
}

const DAILY_SCORE_EMOJIS = ['', '😢', '😐', '🙂', '😊', '🤩'];
const DAILY_CATEGORY_INFO = [
  { key: 'love' as const, label: '연애', emoji: '💕', bgColor: 'bg-gradient-to-br from-pink-900/25 to-rose-900/25', iconBg: 'bg-pink-900/40 ring-2 ring-pink-700/30' },
  { key: 'money' as const, label: '재물', emoji: '💰', bgColor: 'bg-gradient-to-br from-yellow-900/25 to-amber-900/25', iconBg: 'bg-yellow-900/40 ring-2 ring-yellow-700/30' },
  { key: 'work' as const, label: '직장', emoji: '💼', bgColor: 'bg-gradient-to-br from-blue-900/25 to-indigo-900/25', iconBg: 'bg-blue-900/40 ring-2 ring-blue-700/30' },
  { key: 'health' as const, label: '건강', emoji: '🏥', bgColor: 'bg-gradient-to-br from-green-900/25 to-emerald-900/25', iconBg: 'bg-green-900/40 ring-2 ring-green-700/30' },
];

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
  const [allCompatNames, setAllCompatNames] = useState('');

  useEffect(() => {
    if (!shareId) return;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getSharedReading(shareId);
        setReading(data as any);

        // 궁합인 경우 모든 프로필 이름 조회
        if ((data.service_type === 'compatibility' || data.service_type === 'business')) {
          const names = [data.saju_profiles?.name || ''];

          if (data.secondary_profile_id) {
            const { data: sec } = await supabase.from('saju_profiles').select('name').eq('id', data.secondary_profile_id).single();
            if (sec?.name) names.push(sec.name);
          }

          // metadata에서 추가 프로필
          const meta = (data as any).metadata;
          if (meta?.allProfileIds) {
            try {
              const allIds = JSON.parse(meta.allProfileIds) as string[];
              for (const id of allIds) {
                if (id !== data.profile_id && id !== data.secondary_profile_id) {
                  const { data: ep } = await supabase.from('saju_profiles').select('name').eq('id', id).single();
                  if (ep?.name) names.push(ep.name);
                }
              }
            } catch {}
          }

          setAllCompatNames(names.filter(Boolean).join(' & '));
        }

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
  const isCompatibility = reading?.service_type === 'compatibility';
  const isDaily = reading?.service_type === 'daily';

  if (isLoading) return <Layout><Loading message="풀이를 불러오는 중..." /></Layout>;

  if (error || !reading) {
    return (
      <Layout>
        <Card className="text-center py-12">
          <img src="/images/logo.png" alt="멍도령" className="w-12 h-12 mx-auto mb-3 rounded-full" />
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
      {/* 이미지 (텍스트 없이) */}
      <div className="relative -mx-4 -mt-4 rounded-b-3xl overflow-hidden" style={{ height: isCompatibility ? '200px' : '240px' }}>
        {sajuData && !isCompatibility && (
          <img src={getZodiacImageUrl(sajuData.ddi.animal)} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {isCompatibility && (
          <img src={getCompatibilityImageUrl()} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {!sajuData && !isCompatibility && <div className="absolute inset-0 gradient-hero paw-bg opacity-30" />}
        <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/50 to-transparent" style={{ height: '40%', top: '60%' }} />
        <div className="absolute left-4 top-5 z-20 flex items-center gap-2">
          <img src="/images/logo.png" alt="운명전쟁" className="w-10 h-10 rounded-full shadow-sm border border-white/30" />
        </div>
      </div>

      {/* 텍스트 (이미지 아래) */}
      <div className="text-center -mt-6 mb-4 relative z-10">
        <p className="text-xs text-warm-gray mb-2 font-medium">운명전쟁 — 사주로 읽는 나의 운명</p>
        <span className="text-4xl">{serviceInfo.emoji}</span>
        <h2 className="text-xl font-bold text-dark font-serif mt-2">
          {isCompatibility && allCompatNames
            ? `${allCompatNames}의 궁합`
            : profileName ? `${profileName}님의 ${serviceInfo.label}` : serviceInfo.label}
        </h2>
        <p className="text-sm text-warm-gray mt-1">
          {new Date(reading.created_at).toLocaleDateString('ko-KR')}
        </p>
        {sajuData && !isCompatibility && (
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            <span className="text-xs bg-brown/10 text-brown rounded-full px-3 py-1 font-medium">
              {sajuData.ddi.fullName}
            </span>
            <span className="text-xs bg-brown/10 text-brown rounded-full px-3 py-1 font-medium">
              {sajuData.zodiac.emoji} {sajuData.zodiac.name}
            </span>
          </div>
        )}
        {reading?.saju_profiles?.birth_date && !isCompatibility && (
          <ProfileInfoBadges
            birthDate={reading.saju_profiles.birth_date}
            calendarType={reading.saju_profiles.calendar_type || 'solar'}
            gender={reading.saju_profiles.gender || 'male'}
            className="mt-2"
          />
        )}
      </div>

      {/* 만세력 정보 (궁합/일간 운세는 개인 사주 데이터 표시 안 함) */}
      {sajuData && !isCompatibility && !isDaily && (
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
                    <span key={`s-${i}`} className="block text-[10px] bg-amber-900/30 text-amber-300 rounded px-1 py-0.5">{s}</span>
                  ))}
                  {sajuData.sinsal.pillarRelations[name].map((r, i) => (
                    <span key={`r-${i}`} className="block text-[10px] bg-blue-900/30 text-blue-300 rounded px-1 py-0.5">{r}</span>
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
                  <span key={i} className="text-[10px] bg-green-900/30 text-green-300 rounded-full px-2 py-0.5">{g}</span>
                ))}
              </div>
            </Card>
          )}

          <DaeunTimeline daeun={sajuData.daeun} />
        </div>
      )}

      {/* 풀이 결과 */}
      {result ? (
        isDaily ? (() => {
          const daily = result as unknown as DailyResult;
          return (
            <div className="space-y-3">
              {/* 총운 */}
              <Card className="text-center">
                <ScoreRing score={daily.overallLuck} maxScore={5} size="lg" color="#C67A3C" label="" />
                <div className="mt-3 flex items-center justify-center gap-1">
                  <span className="text-2xl">{DAILY_SCORE_EMOJIS[daily.overallLuck] || '🐕'}</span>
                </div>
                <p className="font-medium text-dark font-serif text-lg mt-2">{daily.summary}</p>
                <div className="flex justify-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <span key={n} className={`text-xl ${n <= daily.overallLuck ? '' : 'opacity-20'}`}>⭐</span>
                  ))}
                </div>
              </Card>

              {/* 카테고리별 */}
              <div className="grid grid-cols-2 gap-2">
                {DAILY_CATEGORY_INFO.map(cat => {
                  const data = daily.categories[cat.key];
                  return (
                    <Card key={cat.key} padding="sm" className={cat.bgColor}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-10 h-10 rounded-full ${cat.iconBg} flex items-center justify-center shadow-sm`}>
                          <span className="text-lg">{cat.emoji}</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-xs font-bold text-dark">{cat.label}</span>
                          <div className="flex gap-0.5 mt-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} className={`text-[10px] ${n <= data.score ? '' : 'opacity-20'}`}>⭐</span>
                            ))}
                          </div>
                        </div>
                        <span className="text-sm text-brown font-bold">{data.score}/5</span>
                      </div>
                      <p className="text-xs text-dark-light leading-relaxed">{data.message}</p>
                    </Card>
                  );
                })}
              </div>

              {/* 조언 */}
              {daily.advice && (
                <Card>
                  <h3 className="font-bold text-dark mb-2 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-brown/10 flex items-center justify-center text-sm">🐾</span>
                    멍도령의 조언
                  </h3>
                  <p className="text-sm text-dark-light leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(daily.advice) }} />
                </Card>
              )}

              {/* 행운 아이템 */}
              {daily.luckyItems && (
                <Card className="bg-gradient-to-br from-emerald-900/20 to-green-900/15">
                  <h3 className="text-sm font-bold text-dark mb-3 text-center flex items-center justify-center gap-1.5">
                    <span className="w-7 h-7 rounded-full bg-green-900/40 flex items-center justify-center text-sm">🍀</span>
                    행운 아이템
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-cream/70 rounded-2xl px-3 py-3 shadow-sm border border-green-700/30">
                      <span className="text-lg">🎨</span>
                      <p className="text-warm-gray mt-1 mb-0.5">행운 색</p>
                      <p className="font-bold text-dark">{daily.luckyItems.color}</p>
                    </div>
                    <div className="bg-cream/70 rounded-2xl px-3 py-3 shadow-sm border border-green-700/30">
                      <span className="text-lg">🔢</span>
                      <p className="text-warm-gray mt-1 mb-0.5">행운 숫자</p>
                      <p className="font-bold text-dark">{daily.luckyItems.number}</p>
                    </div>
                    <div className="bg-cream/70 rounded-2xl px-3 py-3 shadow-sm border border-green-700/30">
                      <span className="text-lg">🍽️</span>
                      <p className="text-warm-gray mt-1 mb-0.5">행운 음식</p>
                      <p className="font-bold text-dark">{daily.luckyItems.food}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          );
        })()
        : (
        <div className="space-y-4">
          {result.overallScore !== undefined && (
            <Card className="text-center py-6">
              {isCompatibility
                ? <ScoreRing score={result.overallScore} size="lg" color="#ec4899" />
                : <>
                    <p className="text-5xl font-bold text-brown font-serif">{result.overallScore}</p>
                    <p className="text-sm text-warm-gray mt-1">점수</p>
                  </>
              }
            </Card>
          )}

          {result.summary && (
            <Card className="text-center bg-gradient-to-br from-brown/10 to-amber-900/20">
              <p className="text-lg font-medium text-dark font-serif" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(`"${result.summary}"`) }} />
            </Card>
          )}

          {result.chapters && <ChapterAccordion chapters={result.chapters} />}

          {result.advice && result.advice.length > 0 && (
            <Card>
              <h3 className="font-bold text-dark mb-2 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-brown/10 flex items-center justify-center text-sm">🐾</span>
                멍도령의 조언
              </h3>
              <ul className="space-y-2">
                {result.advice.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-dark-light">
                    <span className="text-brown">•</span><span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(a) }} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {result.luckyItems && (
            <Card className="bg-gradient-to-br from-emerald-900/20 to-green-900/15">
              <h3 className="text-sm font-bold text-dark mb-2 text-center">🍀 행운 아이템</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(result.luckyItems).map(([key, val]) => (
                  <div key={key} className="bg-cream/70 rounded-xl p-2.5 text-center shadow-sm">
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
        )
      ) : (
        <Card className="text-center py-8">
          <p className="text-warm-gray">결과 데이터가 없습니다</p>
        </Card>
      )}

      {/* CTA */}
      <div className="mt-8 text-center">
        <Card className="border-brown/15 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #D4A84320 0%, #B8922F10 50%, #D4A84315 100%)' }}>
          <div className="absolute inset-0 paw-bg opacity-20" />
          <div className="relative z-10">
            <img src="/images/logo.png" alt="멍도령" className="w-12 h-12 rounded-full animate-float inline-block" />
            <p className="font-bold text-dark text-lg mt-2 font-serif">나도 사주 보러 가기</p>
            <p className="text-sm text-warm-gray mb-4">운명전쟁에서 나만의 운세를 확인해보세요</p>
            <Button onClick={() => navigate('/')} size="lg">운명전쟁 시작하기</Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
