'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DOMPurify from 'dompurify';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import CostBadge from '@/components/ui/CostBadge';
import Loading from '@/components/ui/Loading';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ChapterAccordion from '@/components/saju/ChapterAccordion';
import { useSajuStore } from '@/stores/saju';
import { useCreditStore } from '@/stores/credit';
import { CREDIT_COSTS } from '@/types/api';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ui/Toast';
import { requestReading, pollReadingStatus } from '@/lib/api';
import type { SajuApiResponse, SajuChapter } from '@/types/saju';

const MAX_PEOPLE = 5;
const POLL_INTERVAL = 3000;

const RELATION_PRESETS = [
  { label: '연인/부부', value: '연인/부부', emoji: '💕' },
  { label: '친구/동료', value: '친구/동료', emoji: '🤝' },
  { label: '동업/사업', value: '동업/사업 파트너', emoji: '💼' },
  { label: '가족', value: '가족', emoji: '👨‍👩‍👧‍👦' },
  { label: '상사/부하', value: '직장 상사와 부하', emoji: '🏢' },
];

function formatBirthDate(dateStr: string) {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  const h = d.getHours();
  const m = d.getMinutes();
  const hourNames: Record<number, string> = {
    0:'자',1:'자',2:'축',3:'축',4:'인',5:'인',6:'묘',7:'묘',8:'진',9:'진',10:'사',11:'사',
    12:'오',13:'오',14:'미',15:'미',16:'신',17:'신',18:'유',19:'유',20:'술',21:'술',22:'해',23:'해',
  };
  return `${date} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}(${hourNames[h]}시)`;
}

export default function CompatibilityPage() {
  const router = useRouter();
  const { profiles, fetchProfiles, readings, fetchReadings } = useSajuStore();
  const { credits, fetchCredits } = useCreditStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [relationType, setRelationType] = useState('');
  const [isCustomRelation, setIsCustomRelation] = useState(false);
  const [isRoleInput, setIsRoleInput] = useState(false);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [avgDuration, setAvgDuration] = useState(80000);

  const cost = CREDIT_COSTS.compatibility.bones;
  const getProfileName = (id: string) => profiles.find(p => p.id === id)?.name || '?';

  // 궁합 내역에서 모든 참여자 이름 가져오기
  const getCompatNames = (r: typeof readings[0]) => {
    const names = [getProfileName(r.profile_id)];
    if (r.secondary_profile_id) names.push(getProfileName(r.secondary_profile_id));
    const meta = r.metadata as Record<string, string> | undefined;
    if (meta?.allProfileIds) {
      try {
        const allIds = JSON.parse(meta.allProfileIds) as string[];
        allIds.forEach(id => {
          if (id !== r.profile_id && id !== r.secondary_profile_id) {
            const n = getProfileName(id);
            if (n !== '?') names.push(n);
          }
        });
      } catch { /* ignore */ }
    }
    return names.join(' & ');
  };

  useEffect(() => {
    fetchProfiles();
    fetchCredits();
    fetchReadings();
  }, [fetchProfiles, fetchCredits, fetchReadings]);

  // 처리 중인 reading 있으면 5초마다 자동 갱신
  useEffect(() => {
    const hasProcessing = readings.some(r =>
      (r.service_type === 'compatibility' || r.service_type === 'business') &&
      (r.processing_status === 'processing' || r.processing_status === 'pending')
    );
    if (!hasProcessing) return;
    const interval = setInterval(() => fetchReadings(), 5000);
    return () => clearInterval(interval);
  }, [readings, fetchReadings]);

  useEffect(() => {
    if (initialized || profiles.length < 2) return;
    setSelectedIds([profiles[0].id, profiles[1].id]);
    setInitialized(true);
  }, [profiles, initialized]);

  const availableProfiles = profiles.filter(p => !selectedIds.includes(p.id));
  const canAddMore = selectedIds.length < MAX_PEOPLE && availableProfiles.length > 0;
  const compatReadings = readings.filter(r =>
    (r.service_type === 'compatibility' || r.service_type === 'business') &&
    ['completed', 'processing', 'pending'].includes(r.processing_status)
  );

  const handleAnalyze = useCallback(async (question?: string) => {
    if (selectedIds.length < 2) return;
    setShowConfirm(false);
    setError(null);

    try {
      const meta: Record<string, string> = {};
      if (question) meta.userQuestion = question;
      if (isRoleInput) {
        const roleParts = selectedIds.map(id => {
          const name = getProfileName(id);
          const role = roles[id];
          return role ? `${name}(${role})` : name;
        });
        meta.relationType = `${roleParts.join(' ')} ${relationType || ''}`.trim();
      } else if (relationType) {
        meta.relationType = relationType;
      }
      if (selectedIds.length > 2) meta.allProfileIds = JSON.stringify(selectedIds);

      await requestReading(
        selectedIds[0], 'compatibility', selectedIds[1], true,
        Object.keys(meta).length > 0 ? meta : undefined,
      );
      fetchCredits();
      fetchReadings(); // 목록 갱신 → processing 상태로 보임
      showToast('궁합 분석을 요청했어요!');
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청에 실패했어요');
    }
  }, [selectedIds, relationType, isRoleInput, roles, fetchCredits, fetchReadings]);

  if (profiles.length < 2) {
    return (
      <AuthRequired>
        <AppShell title="궁합" showBack>
          <div className="p-4 flex flex-col items-center gap-4 py-16">
            <p className="font-pixel text-xs text-[var(--text-muted)]">두 명 이상의 프로필이 필요해요</p>
            <Button variant="primary" onClick={() => router.push('/profile/add')}>프로필 추가하기</Button>
          </div>
        </AppShell>
      </AuthRequired>
    );
  }

  return (
    <AuthRequired>
      <AppShell title="궁합" showBack>
        <div className="p-4 flex flex-col gap-5 animate-fade-in">

          {/* 프로필 선택 */}
          {(
            <div className="flex flex-col gap-3">
              <label className="font-pixel text-[10px] text-[var(--text-muted)]">
                프로필 선택 (2~{MAX_PEOPLE}명)
              </label>

              {selectedIds.map((id, index) => {
                const otherSelected = selectedIds.filter((_, i) => i !== index);
                const options = profiles.filter(p => !otherSelected.includes(p.id));
                return (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-7 h-7 pixel-border-accent flex items-center justify-center font-pixel text-xs text-[var(--accent)] shrink-0">
                      {index + 1}
                    </div>
                    <select
                      className="flex-1 border-2 border-[var(--pixel-border)] bg-[var(--bg-card)] px-2 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      value={id}
                      onChange={e => setSelectedIds(prev => { const n = [...prev]; n[index] = e.target.value; return n; })}
                    >
                      {options.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.relation}) {formatBirthDate(p.birth_date)} {p.gender === 'male' ? '남' : '여'}
                        </option>
                      ))}
                    </select>
                    {isRoleInput && (
                      <input type="text" value={roles[id] || ''}
                        onChange={e => setRoles(prev => ({ ...prev, [id]: e.target.value }))}
                        placeholder="역할"
                        className="w-16 border-2 border-[var(--pixel-border)] bg-[var(--bg-card)] px-2 py-2 text-xs outline-none focus:border-[var(--accent)] shrink-0" />
                    )}
                    {selectedIds.length > 2 && (
                      <button type="button" onClick={() => setSelectedIds(prev => prev.filter((_, i) => i !== index))}
                        className="w-7 h-7 pixel-border flex items-center justify-center text-[var(--error)] text-sm shrink-0">x</button>
                    )}
                  </div>
                );
              })}

              {canAddMore && (
                <button type="button"
                  onClick={() => { const next = availableProfiles[0]; if (next) setSelectedIds(prev => [...prev, next.id]); }}
                  className="w-full border-2 border-dashed border-[var(--pixel-shadow)] py-2 text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  + 프로필 추가 ({selectedIds.length}/{MAX_PEOPLE})
                </button>
              )}
            </div>
          )}

          {/* 관계 유형 */}
          {(
            <div className="flex flex-col gap-2">
              <label className="font-pixel text-[10px] text-[var(--text-muted)]">어떤 관계인가요?</label>
              <div className="flex flex-wrap gap-1.5">
                {RELATION_PRESETS.map(r => (
                  <button key={r.label} type="button"
                    onClick={() => { setRelationType(r.value); setIsCustomRelation(false); setIsRoleInput(false); }}
                    className={`text-xs px-3 py-1.5 border-2 transition-all ${
                      !isCustomRelation && !isRoleInput && relationType === r.value
                        ? 'bg-[var(--accent)] text-white border-[var(--accent-hover)]'
                        : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--pixel-shadow)] hover:border-[var(--accent)]'
                    }`}>
                    {r.emoji} {r.label}
                  </button>
                ))}
                <button type="button"
                  onClick={() => { setIsRoleInput(true); setIsCustomRelation(false); setRelationType(''); }}
                  className={`text-xs px-3 py-1.5 border-2 transition-all ${
                    isRoleInput ? 'bg-[var(--accent)] text-white border-[var(--accent-hover)]'
                      : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--pixel-shadow)] hover:border-[var(--accent)]'
                  }`}>
                  역할 입력
                </button>
                <button type="button"
                  onClick={() => { setIsCustomRelation(true); setIsRoleInput(false); setRelationType(''); }}
                  className={`text-xs px-3 py-1.5 border-2 transition-all ${
                    isCustomRelation ? 'bg-[var(--accent)] text-white border-[var(--accent-hover)]'
                      : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--pixel-shadow)] hover:border-[var(--accent)]'
                  }`}>
                  직접 입력
                </button>
              </div>
              {isCustomRelation && (
                <input type="text" value={relationType}
                  placeholder="관계를 직접 입력 (예: 룸메이트, 선후배)"
                  className="border-2 border-[var(--pixel-border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
                  onChange={e => setRelationType(e.target.value)} />
              )}
              {isRoleInput && (
                <input type="text" value={relationType}
                  placeholder="관계 입력 (예: 동업관계, 팀 프로젝트)"
                  className="border-2 border-[var(--pixel-border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
                  onChange={e => setRelationType(e.target.value)} />
              )}
            </div>
          )}

          {error && (
            <div className="pixel-card p-3 border-[var(--error)]">
              <p className="text-xs text-[var(--error)] text-center">{error}</p>
            </div>
          )}

          <Button variant="primary" size="lg" className="w-full"
            onClick={() => setShowConfirm(true)} disabled={selectedIds.length < 2}>
            궁합 보기 <CostBadge cost={cost} className="ml-2" />
          </Button>

          {credits && (
            <p className="text-center text-xs text-[var(--text-muted)]">보유: {credits.bones}개</p>
          )}

          {/* 궁합 내역 (처리중 + 완료) */}
          {compatReadings.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="font-pixel text-xs text-[var(--text-secondary)]">궁합 내역</h3>
              {compatReadings.slice(0, 10).map(r => {
                const isProcessing = r.processing_status === 'processing' || r.processing_status === 'pending';
                const elapsed = Date.now() - new Date(r.created_at).getTime();
                const progress = Math.min((elapsed / (90000 * 1.2)) * 100, 95);
                return (
                  <button key={r.id} type="button"
                    className={`pixel-card p-3 w-full text-left flex flex-wrap items-center gap-3 ${isProcessing ? 'opacity-80' : ''}`}
                    onClick={() => !isProcessing && router.push(`/archive/${r.id}`)}
                    disabled={isProcessing}>
                    <span className="text-lg shrink-0">💕</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-pixel text-[10px] truncate">{getCompatNames(r)}</p>
                      <p className="text-[9px] text-[var(--text-muted)]">
                        {new Date(r.created_at).toLocaleDateString('ko-KR')}
                        {!isProcessing && r.result && ` · ${(r.result as Record<string, unknown>).overallScore || '?'}점`}
                      </p>
                    </div>
                    {isProcessing ? (
                      <span className="font-pixel text-[9px] text-[var(--warning)]">분석중</span>
                    ) : (
                      <span className="font-pixel text-[9px] text-[var(--success)]">완료</span>
                    )}
                    {isProcessing && (
                      <div className="w-full h-2 border border-[var(--warning)] bg-[var(--bg-secondary)]">
                        <div className="h-full bg-[var(--warning)] transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <ConfirmModal
            isOpen={showConfirm}
            onClose={() => setShowConfirm(false)}
            onConfirm={handleAnalyze}
            title="궁합 분석"
            message={`${selectedIds.map(id => getProfileName(id)).join(' & ')}의 궁합을 분석할까요?`}
            confirmText={`${cost} 시작`}
            showQuestion
            disabled={credits ? credits.bones < cost : false}
          />
        </div>
      </AppShell>
    </AuthRequired>
  );
}
