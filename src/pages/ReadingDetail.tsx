import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { ChapterAccordion } from '@/components/saju/ChapterAccordion.tsx';
import { Recommendations } from '@/components/saju/Recommendations.tsx';
import { Loading } from '@/components/ui/Loading.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { supabase } from '@/lib/supabase.ts';
import { useSajuStore } from '@/stores/saju.ts';
import { createShareLink } from '@/lib/share.ts';
import type { Reading } from '@/types/user.ts';
import type { SajuApiResponse, ServiceType } from '@/types/saju.ts';

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

  useEffect(() => {
    if (!readingId) return;

    const fetchReading = async () => {
      setIsLoading(true);
      setError('');
      try {
        const { data, error: fetchError } = await supabase
          .from('readings')
          .select('*')
          .eq('id', readingId)
          .single();

        if (fetchError) throw new Error(fetchError.message);
        setReading(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '풀이를 불러올 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReading();
  }, [readingId]);

  const profileName = reading
    ? profiles.find(p => p.id === reading.profile_id)?.name ?? '알 수 없음'
    : '';

  const serviceInfo = reading
    ? SERVICE_LABELS[reading.service_type] ?? { label: reading.service_type, emoji: '📄' }
    : { label: '', emoji: '' };

  const result = reading?.result as unknown as SajuApiResponse | null;

  if (isLoading) {
    return (
      <Layout>
        <Loading message="풀이를 불러오는 중..." />
      </Layout>
    );
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
      <div className="text-center mb-6 -mx-4 -mt-4 px-4 pt-6 pb-5 gradient-hero rounded-b-3xl">
        <button
          onClick={() => navigate('/archive')}
          className="absolute left-4 top-5 flex items-center gap-1 text-warm-gray text-sm hover:text-dark transition-colors"
        >
          <span>←</span>
          <span>보관함</span>
        </button>
        <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-brown/10 flex items-center justify-center border border-brown/10">
          <span className="text-3xl">{serviceInfo.emoji}</span>
        </div>
        <h2 className="text-xl font-bold text-dark font-serif">
          {serviceInfo.label}
        </h2>
        <p className="text-sm text-warm-gray mt-1">
          {profileName} · {new Date(reading.created_at).toLocaleDateString('ko-KR')}
        </p>
      </div>

      {result ? (
        <div className="space-y-4">
          {/* 요약 */}
          {result.summary && (
            <Card className="text-center bg-brown/5">
              <p className="text-lg font-medium text-dark font-serif">
                "{result.summary}"
              </p>
            </Card>
          )}

          {/* 챕터 */}
          {result.chapters && result.chapters.length > 0 && (
            <ChapterAccordion chapters={result.chapters} />
          )}

          {/* 조언 */}
          {result.advice && result.advice.length > 0 && (
            <Card>
              <h3 className="font-medium text-dark mb-2">복돌이의 조언</h3>
              <ul className="space-y-2">
                {result.advice.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-dark-light">
                    <span className="text-brown">🐾</span><span>{a}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 행운 아이템 */}
          {result.luckyItems && (
            <Card>
              <h3 className="font-medium text-dark mb-2">행운 아이템</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(result.luckyItems).map(([key, val]) => (
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

          {/* 공유 버튼 */}
          <Card className="text-center bg-gradient-to-r from-amber-50 to-orange-50 border-brown/10">
            <p className="text-sm text-warm-gray mb-2">친구에게 사주풀이를 공유해보세요</p>
            <Button
              size="lg"
              onClick={async () => {
                if (!reading) return;
                try {
                  const url = await createShareLink(reading.id);
                  await navigator.clipboard.writeText(url);
                  setShareToast('링크가 복사되었어요!');
                  setTimeout(() => setShareToast(''), 2000);
                } catch {
                  setShareToast('공유 링크 생성에 실패했어요');
                  setTimeout(() => setShareToast(''), 2000);
                }
              }}
            >
              🔗 공유하기
            </Button>
          </Card>

          <Recommendations exclude={[reading.service_type as ServiceType]} />
        </div>
      ) : (
        <Card className="text-center py-8">
          <p className="text-warm-gray">결과 데이터가 없습니다</p>
        </Card>
      )}

      {/* 공유 토스트 */}
      {shareToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-dark text-white text-sm px-5 py-2.5 rounded-full shadow-lg">
          {shareToast}
        </div>
      )}
    </Layout>
  );
}
