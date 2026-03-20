import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { FourPillars } from '@/components/saju/FourPillars.tsx';
import { OhaengBar } from '@/components/saju/OhaengBar.tsx';
import { DaeunTimeline } from '@/components/saju/DaeunTimeline.tsx';
import { ChapterAccordion } from '@/components/saju/ChapterAccordion.tsx';
import { Recommendations } from '@/components/saju/Recommendations.tsx';
import { Loading } from '@/components/ui/Loading.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { supabase } from '@/lib/supabase.ts';
import { useSajuStore } from '@/stores/saju.ts';
import { createShareLink } from '@/lib/share.ts';
import { calculateSaju } from '@/core/calculator.ts';
import type { Reading, SajuProfile } from '@/types/user.ts';
import type { SajuApiResponse, SajuPillars, ServiceType } from '@/types/saju.ts';

const SERVICE_LABELS: Record<string, { label: string; emoji: string }> = {
  comprehensive: { label: '종합 사주풀이', emoji: '🔮' },
  compatibility: { label: '궁합', emoji: '💕' },
  daily: { label: '오늘의 운세', emoji: '🌅' },
  daeun: { label: '대운 분석', emoji: '🌊' },
  yearly: { label: '연간 운세', emoji: '📅' },
  chat: { label: '복돌이 상담', emoji: '💬' },
  business: { label: '동업 궁합', emoji: '🤝' },
  luckyday: { label: '길일 추천', emoji: '🗓️' },
  love: { label: '연애 시기 분석', emoji: '💘' },
  wealth: { label: '재물운 특화', emoji: '💎' },
  health: { label: '건강운 분석', emoji: '🏥' },
  career: { label: '직업 적성 분석', emoji: '🎯' },
  pastlife: { label: '전생 이야기', emoji: '🔮' },
  moving: { label: '이사/부동산 운', emoji: '🏠' },
};

export function ReadingDetail() {
  const { readingId } = useParams<{ readingId: string }>();
  const navigate = useNavigate();
  const { profiles } = useSajuStore();
  const [reading, setReading] = useState<Reading | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareToast, setShareToast] = useState('');
  const [sajuData, setSajuData] = useState<SajuPillars | null>(null);

  useEffect(() => {
    if (!readingId) return;
    (async () => {
      setIsLoading(true);
      try {
        const { data, error: e } = await supabase.from('readings').select('*').eq('id', readingId).single();
        if (e) throw new Error(e.message);
        setReading(data);

        // 프로필에서 만세력 계산
        const profile = profiles.find(p => p.id === data.profile_id);
        if (profile) {
          const saju = calculateSaju({
            name: profile.name,
            birthDate: new Date(profile.birth_date),
            gender: profile.gender as 'male' | 'female',
            calendarType: profile.calendar_type as 'solar' | 'lunar' | 'lunar_leap',
            useTrueSolar: profile.use_true_solar,
            longitude: profile.longitude,
          });
          setSajuData(saju);
        } else if (data.profile_id) {
          // 프로필이 스토어에 없으면 직접 조회
          const { data: pData } = await supabase.from('saju_profiles').select('*').eq('id', data.profile_id).single();
          if (pData) {
            const p = pData as SajuProfile;
            const saju = calculateSaju({
              name: p.name,
              birthDate: new Date(p.birth_date),
              gender: p.gender as 'male' | 'female',
              calendarType: p.calendar_type as 'solar' | 'lunar' | 'lunar_leap',
              useTrueSolar: p.use_true_solar,
              longitude: p.longitude,
            });
            setSajuData(saju);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '풀이를 불러올 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [readingId, profiles]);

  const profileName = reading
    ? profiles.find(p => p.id === reading.profile_id)?.name ?? '알 수 없음'
    : '';

  const serviceInfo = reading
    ? SERVICE_LABELS[reading.service_type] ?? { label: reading.service_type, emoji: '📄' }
    : { label: '', emoji: '' };

  const result = reading?.result as unknown as SajuApiResponse | null;

  const handleShare = async () => {
    if (!reading) return;
    try {
      const url = await createShareLink(reading.id);
      await navigator.clipboard.writeText(url);
      setShareToast('링크가 복사되었어요!');
    } catch { setShareToast('공유 실패'); }
    setTimeout(() => setShareToast(''), 2000);
  };

  if (isLoading) {
    return <Layout><Loading message="풀이를 불러오는 중..." /></Layout>;
  }

  if (error || !reading) {
    return (
      <Layout>
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">🐕</p>
          <p className="text-warm-gray mb-3">{error || '풀이를 찾을 수 없습니다'}</p>
          <Button onClick={() => navigate('/archive')}>보관함으로</Button>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* 헤더 */}
      <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-5 gradient-hero rounded-b-3xl relative">
        <button
          onClick={() => navigate('/archive')}
          className="absolute left-4 top-5 flex items-center gap-1 text-warm-gray text-sm hover:text-dark"
        >
          ← 보관함
        </button>
        <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-brown/10 flex items-center justify-center border border-brown/10">
          <span className="text-3xl">{serviceInfo.emoji}</span>
        </div>
        <h2 className="text-xl font-bold text-dark font-serif">{serviceInfo.label}</h2>
        <p className="text-sm text-warm-gray mt-1">
          {profileName} · {new Date(reading.created_at).toLocaleDateString('ko-KR')}
          {reading.processing_duration_ms && ` · ${(reading.processing_duration_ms / 1000).toFixed(0)}초`}
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
              {(['year', 'month', 'day', 'hour'] as const).map(name => (
                <div key={name} className="space-y-1">
                  <p className="text-xs font-medium text-dark">{{ year: '년주', month: '월주', day: '일주', hour: '시주' }[name]}</p>
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

          {/* 전체 신살 */}
          {sajuData.sinsal.allSinsal.length > 0 && (
            <Card padding="sm">
              <h3 className="text-xs font-medium text-warm-gray mb-1.5">전체 신살</h3>
              <div className="flex flex-wrap gap-1">
                {sajuData.sinsal.allSinsal.map((s, i) => (
                  <span key={i} className="text-[10px] bg-red-50 text-red-600 rounded-full px-2 py-0.5">{s}</span>
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

          <Recommendations exclude={[reading.service_type as ServiceType]} />
        </div>
      ) : (
        <Card className="text-center py-8">
          <p className="text-warm-gray">결과 데이터가 없습니다</p>
        </Card>
      )}

      {/* 플로팅 공유 버튼 */}
      {result && (
        <button
          onClick={handleShare}
          className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-brown text-white shadow-lg flex items-center justify-center text-lg hover:bg-brown-dark active:scale-95 transition-all"
          title="공유하기"
        >
          📋
        </button>
      )}

      {shareToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-dark text-white text-sm px-5 py-2.5 rounded-full shadow-lg animate-fade-in">
          {shareToast}
        </div>
      )}
    </Layout>
  );
}
