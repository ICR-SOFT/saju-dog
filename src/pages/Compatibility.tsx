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

const MAX_PEOPLE = 5;

export function Compatibility() {
  const navigate = useNavigate();
  const { profiles } = useSajuStore();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const initial: string[] = [];
    if (profiles[0]) initial.push(profiles[0].id);
    if (profiles[1]) initial.push(profiles[1].id);
    return initial;
  });
  const [result, setResult] = useState<SajuApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const availableProfiles = profiles.filter(p => !selectedIds.includes(p.id));
  const canAddMore = selectedIds.length < MAX_PEOPLE && availableProfiles.length > 0;

  const handleAddProfile = () => {
    if (!canAddMore) return;
    const next = availableProfiles[0];
    if (next) {
      setSelectedIds(prev => [...prev, next.id]);
    }
  };

  const handleRemove = (id: string) => {
    setSelectedIds(prev => prev.filter(pid => pid !== id));
  };

  const handleChange = (index: number, newId: string) => {
    setSelectedIds(prev => {
      const next = [...prev];
      next[index] = newId;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.length < 2) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await getCompatibility({
        profileIds: selectedIds,
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
          <p className="text-warm-gray mb-3">두 명 이상의 프로필이 필요해요</p>
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
          <div className="space-y-3">
            <p className="text-sm text-warm-gray mb-1">궁합을 볼 프로필을 선택하세요 (2~{MAX_PEOPLE}명)</p>

            {selectedIds.map((id, index) => {
              // Options for this select: current value + all unselected profiles
              const otherSelected = selectedIds.filter((_, i) => i !== index);
              const options = profiles.filter(p => !otherSelected.includes(p.id));

              return (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-brown/10 flex items-center justify-center text-xs font-bold text-brown shrink-0">
                    {index + 1}
                  </div>
                  <select
                    className="flex-1 rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2.5 text-dark outline-none focus:border-brown text-sm"
                    value={id}
                    onChange={e => handleChange(index, e.target.value)}
                  >
                    {options.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.relation})</option>
                    ))}
                  </select>
                  {selectedIds.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemove(id)}
                      className="w-7 h-7 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-sm transition-colors shrink-0"
                      aria-label="제거"
                    >
                      &times;
                    </button>
                  )}
                </div>
              );
            })}

            {canAddMore && (
              <button
                type="button"
                onClick={handleAddProfile}
                className="w-full rounded-xl border-2 border-dashed border-warm-gray-light/50 py-2.5 text-sm text-warm-gray hover:border-brown hover:text-brown transition-colors"
              >
                + 프로필 추가 ({selectedIds.length}/{MAX_PEOPLE})
              </button>
            )}

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <Button size="lg" onClick={handleSubmit} disabled={selectedIds.length < 2}>
              🦴 3 궁합 보기
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <Loading message="복돌이가 인연을 살펴보고 있어요..." />
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
