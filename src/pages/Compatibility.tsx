import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { PhotoLoading } from '@/components/ui/PhotoLoading.tsx';
import { Recommendations } from '@/components/saju/Recommendations.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { requestReading, pollReadingStatus } from '@/lib/api.ts';

const MAX_PEOPLE = 5;

type Phase = 'select' | 'loading' | 'done';

export function Compatibility() {
  const navigate = useNavigate();
  const { profiles, readings, fetchReadings } = useSajuStore();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const initial: string[] = [];
    if (profiles[0]) initial.push(profiles[0].id);
    if (profiles[1]) initial.push(profiles[1].id);
    return initial;
  });
  const [phase, setPhase] = useState<Phase>('select');
  const [error, setError] = useState('');

  // 궁합 내역 (completed)
  const compatReadings = readings.filter(r => r.service_type === 'compatibility' && r.processing_status === 'completed');
  // 진행 중인 궁합
  const pendingCompat = readings.find(r => r.service_type === 'compatibility' && (r.processing_status === 'pending' || r.processing_status === 'processing'));

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  // 페이지 로드 시 진행 중인 궁합이 있으면 폴링
  useEffect(() => {
    if (!pendingCompat) return;
    setPhase('loading');
    const poll = setInterval(async () => {
      try {
        const status = await pollReadingStatus(pendingCompat.id);
        if (status.status === 'completed') {
          setPhase('done');
          fetchReadings();
          clearInterval(poll);
        } else if (status.status === 'failed') {
          setPhase('select');
          setError('궁합 분석에 실패했어요. 크레딧이 환불되었어요.');
          fetchReadings();
          clearInterval(poll);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, [pendingCompat?.id, fetchReadings]);

  const availableProfiles = profiles.filter(p => !selectedIds.includes(p.id));
  const canAddMore = selectedIds.length < MAX_PEOPLE && availableProfiles.length > 0;

  const handleSubmit = async () => {
    if (selectedIds.length < 2) return;
    setPhase('loading');
    setError('');
    try {
      const reqResult = await requestReading(selectedIds[0], 'compatibility', selectedIds[1]);
      useCreditStore.getState().fetchCredits();

      if (reqResult.cached && reqResult.result) {
        setPhase('done');
        fetchReadings();
        return;
      }

      // 직접 폴링 시작
      const readingId = reqResult.readingId;
      const poll = setInterval(async () => {
        try {
          const status = await pollReadingStatus(readingId);
          if (status.status === 'completed') {
            setPhase('done');
            fetchReadings();
            clearInterval(poll);
          } else if (status.status === 'failed') {
            setPhase('select');
            setError(status.failure_reason || '궁합 분석에 실패했어요. 크레딧이 환불되었어요.');
            fetchReadings();
            clearInterval(poll);
          }
        } catch {}
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '궁합 요청에 실패했습니다');
      setPhase('select');
    }
  };

  const getProfileName = (id: string) => profiles.find(p => p.id === id)?.name || '?';

  if (profiles.length < 2) {
    return (
      <Layout>
        <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-5 gradient-hero rounded-b-3xl">
          <span className="text-3xl">💕</span>
          <h2 className="text-xl font-bold text-dark font-serif mt-1">궁합</h2>
        </div>
        <Card className="text-center py-8">
          <span className="text-3xl">💕</span>
          <p className="text-warm-gray mb-3 mt-2 font-medium">두 명 이상의 프로필이 필요해요</p>
          <Button onClick={() => navigate('/add-profile')}>프로필 추가하기</Button>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-5 gradient-hero rounded-b-3xl">
        <span className="text-3xl">💕</span>
        <h2 className="text-xl font-bold text-dark font-serif mt-1">궁합</h2>
        <p className="text-sm text-warm-gray mt-1">두 사람의 인연과 케미를 확인해요</p>
      </div>

      {/* 로딩 중 */}
      {phase === 'loading' && (
        <Card className="text-center py-4 gradient-hero mb-4">
          <PhotoLoading />
          <p className="text-xs text-warm-gray animate-pulse-warm mt-2">복돌이가 인연을 살펴보고 있어요...</p>
          <p className="text-xs text-warm-gray-light">페이지를 나가도 보관함에서 확인할 수 있어요</p>
        </Card>
      )}

      {/* 프로필 선택 (로딩 중이 아닐 때) */}
      {phase !== 'loading' && (
        <Card className="mb-4">
          <div className="space-y-3">
            <p className="text-sm text-warm-gray mb-1">궁합을 볼 프로필을 선택하세요 (2~{MAX_PEOPLE}명)</p>

            {selectedIds.map((id, index) => {
              const otherSelected = selectedIds.filter((_, i) => i !== index);
              const options = profiles.filter(p => !otherSelected.includes(p.id));
              return (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-200 to-rose-300 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm ring-2 ring-white">
                    {index + 1}
                  </div>
                  <select
                    className="flex-1 rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2.5 text-dark outline-none focus:border-brown text-sm"
                    value={id}
                    onChange={e => setSelectedIds(prev => { const n = [...prev]; n[index] = e.target.value; return n; })}
                  >
                    {options.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.relation})</option>
                    ))}
                  </select>
                  {selectedIds.length > 2 && (
                    <button type="button" onClick={() => setSelectedIds(prev => prev.filter((_, i) => i !== index))}
                      className="w-7 h-7 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center text-sm shrink-0">
                      &times;
                    </button>
                  )}
                </div>
              );
            })}

            {canAddMore && (
              <button type="button" onClick={() => { const next = availableProfiles[0]; if (next) setSelectedIds(prev => [...prev, next.id]); }}
                className="w-full rounded-xl border-2 border-dashed border-warm-gray-light/50 py-2.5 text-sm text-warm-gray hover:border-brown hover:text-brown transition-colors">
                + 프로필 추가 ({selectedIds.length}/{MAX_PEOPLE})
              </button>
            )}

            {error && <p className="text-sm text-red-500 text-center bg-red-50 rounded-xl p-2">{error}</p>}

            <Button size="lg" onClick={handleSubmit} disabled={selectedIds.length < 2}>
              🦴 3 궁합 보기
            </Button>
          </div>
        </Card>
      )}

      {/* 궁합 내역 */}
      {compatReadings.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-dark mb-2 flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-xs">💕</span>
            궁합 내역
          </h3>
          <div className="space-y-2">
            {compatReadings.map(r => (
              <Card key={r.id} padding="sm"
                className="cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
                onClick={() => navigate(`/archive/${r.id}`)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center">
                    <span>💕</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark">
                      {getProfileName(r.profile_id)} & {r.secondary_profile_id ? getProfileName(r.secondary_profile_id) : '?'}
                    </p>
                    <p className="text-xs text-warm-gray">
                      {new Date(r.created_at).toLocaleDateString('ko-KR')}
                      {r.result && ` · ${(r.result as any).overallScore || '?'}점`}
                    </p>
                  </div>
                  <span className="text-warm-gray-light">&rsaquo;</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Recommendations exclude={['compatibility']} />
    </Layout>
  );
}
