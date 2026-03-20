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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // profiles 로드 후 초기 선택
  useEffect(() => {
    if (initialized || profiles.length < 2) return;
    setSelectedIds([profiles[0].id, profiles[1].id]);
    setInitialized(true);
  }, [profiles, initialized]);
  const [phase, setPhase] = useState<Phase>('select');
  const [error, setError] = useState('');
  const [relationType, setRelationType] = useState('');
  const [isCustomRelation, setIsCustomRelation] = useState(false);
  const [isRoleInput, setIsRoleInput] = useState(false);
  const [roles, setRoles] = useState<Record<string, string>>({});

  const RELATION_PRESETS = [
    { label: '연인/부부', value: '연인/부부', emoji: '💕' },
    { label: '친구/동료', value: '친구/동료', emoji: '🤝' },
    { label: '동업/사업', value: '동업/사업 파트너', emoji: '💼' },
    { label: '가족', value: '가족', emoji: '👨‍👩‍👧‍👦' },
    { label: '상사/부하', value: '직장 상사와 부하', emoji: '🏢' },
  ];

  const getProfileName = (id: string) => profiles.find(p => p.id === id)?.name || '?';

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
      // 항상 새로 요청 (force=true)
      // N명 궁합: 모든 프로필 ID를 metadata에 포함
      const meta: Record<string, string> = {};

      // 역할 입력 모드: "라태웅(개발자) 김정민(운영) 동업관계" 형태로 합침
      if (isRoleInput) {
        const roleParts = selectedIds.map(id => {
          const name = getProfileName(id);
          const role = roles[id];
          return role ? `${name}(${role})` : name;
        });
        const combined = `${roleParts.join(' ')} ${relationType || ''}`.trim();
        meta.relationType = combined;
      } else if (relationType) {
        meta.relationType = relationType;
      }

      if (selectedIds.length > 2) meta.allProfileIds = JSON.stringify(selectedIds);

      const reqResult = await requestReading(
        selectedIds[0], 'compatibility', selectedIds[1], true,
        Object.keys(meta).length > 0 ? meta : undefined,
      );
      useCreditStore.getState().fetchCredits();

      if (reqResult.cached && reqResult.result) {
        // 캐시 히트해도 결과가 있으면 바로 보관함에 추가되어 있음
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
                <div key={index} className="space-y-1">
                  <div className="flex items-center gap-2">
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
                    {isRoleInput && (
                      <input
                        type="text"
                        value={roles[id] || ''}
                        onChange={e => setRoles(prev => ({ ...prev, [id]: e.target.value }))}
                        placeholder="역할"
                        className="w-20 rounded-lg border border-warm-gray-light/50 bg-white px-2 py-2 text-dark text-xs outline-none focus:border-brown shrink-0"
                      />
                    )}
                    {selectedIds.length > 2 && (
                      <button type="button" onClick={() => setSelectedIds(prev => prev.filter((_, i) => i !== index))}
                        className="w-7 h-7 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center text-sm shrink-0">
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {canAddMore && (
              <button type="button" onClick={() => { const next = availableProfiles[0]; if (next) setSelectedIds(prev => [...prev, next.id]); }}
                className="w-full rounded-xl border-2 border-dashed border-warm-gray-light/50 py-2.5 text-sm text-warm-gray hover:border-brown hover:text-brown transition-colors">
                + 프로필 추가 ({selectedIds.length}/{MAX_PEOPLE})
              </button>
            )}

            {/* 관계 유형 선택 */}
            <div>
              <p className="text-sm font-medium text-dark-light mb-2">어떤 관계인가요?</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {RELATION_PRESETS.map(r => (
                  <button key={r.label} type="button"
                    onClick={() => { setRelationType(r.value); setIsCustomRelation(false); setIsRoleInput(false); }}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all border ${
                      !isCustomRelation && !isRoleInput && relationType === r.value
                        ? 'bg-brown text-cream border-brown'
                        : 'bg-white text-dark border-cream-dark hover:border-brown/30'
                    }`}>
                    {r.emoji} {r.label}
                  </button>
                ))}
                <button type="button"
                  onClick={() => { setIsRoleInput(true); setIsCustomRelation(false); setRelationType(''); }}
                  className={`text-xs px-3 py-1.5 rounded-full transition-all border ${
                    isRoleInput
                      ? 'bg-brown text-cream border-brown'
                      : 'bg-white text-dark border-cream-dark hover:border-brown/30'
                  }`}>
                  🏷️ 역할 입력
                </button>
                <button type="button"
                  onClick={() => { setIsCustomRelation(true); setIsRoleInput(false); setRelationType(''); }}
                  className={`text-xs px-3 py-1.5 rounded-full transition-all border ${
                    isCustomRelation
                      ? 'bg-brown text-cream border-brown'
                      : 'bg-white text-dark border-cream-dark hover:border-brown/30'
                  }`}>
                  ✏️ 직접 입력
                </button>
              </div>
              {/* 직접 입력 (전체 관계) */}
              {isCustomRelation && (
                <input
                  type="text"
                  value={relationType}
                  placeholder="관계를 직접 입력하세요 (예: 룸메이트, 선후배)"
                  className="w-full rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2 text-dark text-sm outline-none focus:border-brown"
                  onChange={e => setRelationType(e.target.value)}
                />
              )}
              {/* 역할 입력 모드 — 관계 유형도 입력 가능 */}
              {isRoleInput && (
                <input
                  type="text"
                  value={relationType}
                  placeholder="관계를 입력하세요 (예: 동업관계, 팀 프로젝트)"
                  className="w-full rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2 text-dark text-sm outline-none focus:border-brown"
                  onChange={e => setRelationType(e.target.value)}
                />
              )}
            </div>

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
                      {(() => {
                        const names = [getProfileName(r.profile_id)];
                        if (r.secondary_profile_id) names.push(getProfileName(r.secondary_profile_id));
                        const meta = (r as any).metadata;
                        if (meta?.allProfileIds) {
                          try {
                            const allIds = JSON.parse(meta.allProfileIds) as string[];
                            allIds.forEach(id => {
                              if (id !== r.profile_id && id !== r.secondary_profile_id) {
                                const n = getProfileName(id);
                                if (n !== '?') names.push(n);
                              }
                            });
                          } catch {}
                        }
                        return names.join(' & ');
                      })()}
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
