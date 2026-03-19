import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { Loading } from '@/components/ui/Loading.tsx';
import { ChapterAccordion } from '@/components/saju/ChapterAccordion.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { getCompatibility } from '@/lib/api.ts';
import type { SajuApiResponse } from '@/types/saju.ts';

export function Compatibility() {
  const navigate = useNavigate();
  const { profiles } = useSajuStore();
  const [primaryId, setPrimaryId] = useState(profiles[0]?.id || '');
  const [secondaryId, setSecondaryId] = useState('');
  const [result, setResult] = useState<SajuApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!primaryId || !secondaryId) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await getCompatibility({
        primaryProfileId: primaryId,
        secondaryProfileId: secondaryId,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '궁합 분석에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  if (profiles.length < 2) {
    return (
      <Layout>
        <h2 className="text-xl font-bold text-dark mb-4 font-serif">궁합</h2>
        <Card className="text-center py-8">
          <p className="text-4xl mb-3">💕</p>
          <p className="text-warm-gray mb-3">두 명의 프로필이 필요해요</p>
          <p className="text-sm text-warm-gray-light mb-4">현재 {profiles.length}개 등록됨</p>
          <Button onClick={() => navigate('/add-profile')}>프로필 추가하기</Button>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <h2 className="text-xl font-bold text-dark mb-4 font-serif">궁합</h2>

      {!result ? (
        <Card>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-dark-light block mb-1.5">첫 번째 사람</label>
              <select
                className="w-full rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2.5 text-dark outline-none focus:border-brown"
                value={primaryId}
                onChange={e => setPrimaryId(e.target.value)}
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.relation})</option>
                ))}
              </select>
            </div>

            <div className="text-center text-2xl">💕</div>

            <div>
              <label className="text-sm font-medium text-dark-light block mb-1.5">두 번째 사람</label>
              <select
                className="w-full rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2.5 text-dark outline-none focus:border-brown"
                value={secondaryId}
                onChange={e => setSecondaryId(e.target.value)}
              >
                <option value="">선택하세요</option>
                {profiles.filter(p => p.id !== primaryId).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.relation})</option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <Button size="lg" onClick={handleSubmit} disabled={!secondaryId}>
              🦴 3 궁합 보기
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <Loading message="복돌이가 두 분의 인연을 살펴보고 있어요..." />
      ) : (
        <div className="space-y-4">
          {/* 점수 */}
          {result.overallScore !== undefined && (
            <Card className="text-center">
              <p className="text-5xl font-bold text-brown font-serif">{result.overallScore}</p>
              <p className="text-sm text-warm-gray mt-1">궁합 점수</p>
              <p className="text-base font-medium text-dark mt-2 font-serif">"{result.summary}"</p>
            </Card>
          )}

          <ChapterAccordion chapters={result.chapters} />

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

          <Button variant="secondary" size="lg" onClick={() => setResult(null)}>
            다른 궁합 보기
          </Button>
        </div>
      )}
    </Layout>
  );
}
