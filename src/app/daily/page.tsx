'use client';

import { useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import Image from 'next/image';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import Recommendations from '@/components/saju/Recommendations';
import { useSajuStore } from '@/stores/saju';
import { useCreditStore } from '@/stores/credit';
import { supabase } from '@/lib/supabase';
import type { SajuApiResponse } from '@/types/saju';

interface DailyCategory {
  score: number;
  message: string;
}

interface DailyResult {
  summary?: string;
  overallLuck?: number;
  overallScore?: number;
  categories?: {
    love?: DailyCategory;
    money?: DailyCategory;
    work?: DailyCategory;
    health?: DailyCategory;
  };
  advice?: string | string[];
  luckyItems?: { color: string; number: string; food: string };
  chapters?: SajuApiResponse['chapters'];
}

const CATEGORY_INFO = [
  { key: 'love', label: '연애', color: 'var(--fire)' },
  { key: 'money', label: '금전', color: 'var(--gold)' },
  { key: 'work', label: '직장', color: 'var(--water)' },
  { key: 'health', label: '건강', color: 'var(--wood)' },
] as const;

function StarScore({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span className="font-pixel text-sm tracking-wider">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < score ? 'text-[var(--gold)]' : 'text-[var(--pixel-shadow)]'}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function DailyPage() {
  const { profiles, fetchProfiles } = useSajuStore();
  const { fetchCredits } = useCreditStore();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null);
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [loadingStart, setLoadingStart] = useState(0);
  const [loadingElapsed, setLoadingElapsed] = useState(0);

  const selectedProfile = profiles[selectedIdx];

  useEffect(() => {
    fetchProfiles();
    fetchCredits();
  }, [fetchProfiles, fetchCredits]);

  // 로딩 타이머
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => setLoadingElapsed(Date.now() - loadingStart), 500);
    return () => clearInterval(interval);
  }, [isLoading, loadingStart]);

  // 오늘 결과 확인
  useEffect(() => {
    if (!selectedProfile) return;
    async function checkExisting() {
      setIsChecking(true);
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('readings')
        .select('result, og_image_url')
        .eq('profile_id', selectedProfile.id)
        .eq('service_type', 'daily')
        .eq('processing_status', 'completed')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].result) {
        setDailyResult(data[0].result as DailyResult);
        if (data[0].og_image_url) setOgImageUrl(data[0].og_image_url);
      } else {
        setDailyResult(null);
        setOgImageUrl(null);
      }
      setIsChecking(false);
    }
    checkExisting();
  }, [selectedProfile]);

  const handleGetDaily = useCallback(async (force = false) => {
    if (!selectedProfile) return;
    setIsLoading(true);
    setLoadingStart(Date.now());
    setLoadingElapsed(0);
    try {
      const { startReading } = useSajuStore.getState();
      await startReading(selectedProfile.id, 'daily', force);

      const waitForResult = () =>
        new Promise<SajuApiResponse | null>((resolve) => {
          const unsub = useSajuStore.subscribe((state) => {
            if (state.processingStatus === 'completed' && state.currentReading) {
              unsub();
              resolve(state.currentReading);
            } else if (state.processingStatus === 'failed') {
              unsub();
              resolve(null);
            }
          });
          const current = useSajuStore.getState();
          if (current.processingStatus === 'completed' && current.currentReading) {
            unsub();
            resolve(current.currentReading);
          }
        });

      const result = await waitForResult();
      if (result) {
        setDailyResult(result as DailyResult);
        // OG 이미지 조회
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
          .from('readings').select('og_image_url')
          .eq('profile_id', selectedProfile.id).eq('service_type', 'daily')
          .gte('created_at', `${today}T00:00:00`)
          .order('created_at', { ascending: false }).limit(1);
        if (data?.[0]?.og_image_url) setOgImageUrl(data[0].og_image_url);
      }
    } finally {
      setIsLoading(false);
      fetchCredits();
    }
  }, [selectedProfile, fetchCredits]);

  const overallScore = dailyResult?.overallLuck || dailyResult?.overallScore || 0;
  const cats = dailyResult?.categories;

  return (
    <AuthRequired>
      <AppShell title="오늘의 운세">
        <div className="p-4 flex flex-col gap-4 animate-fade-in">
          {/* 프로필 칩 */}
          {profiles.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {profiles.map((p, idx) => (
                <button key={p.id} type="button"
                  className={`shrink-0 px-2.5 py-1 font-pixel text-[10px] transition-all ${
                    idx === selectedIdx
                      ? 'pixel-border-accent bg-[var(--accent-light)] text-[var(--accent)]'
                      : 'pixel-border-sm bg-[var(--bg-card)] text-[var(--text-secondary)]'
                  }`}
                  onClick={() => setSelectedIdx(idx)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {isChecking ? (
            <Loading message="확인 중..." />
          ) : isLoading ? (
            /* 로딩 + 게이지 */
            <div className="flex flex-col items-center gap-4 py-8">
              <Loading message="오늘의 운세를 보고 있어요..." />
              {(() => {
                const est = 30000 * 1.2;
                const progress = Math.min((loadingElapsed / est) * 100, 95);
                return (
                  <div className="w-full max-w-[280px] flex flex-col gap-1">
                    <div className="w-full h-3 border-2 border-[var(--pixel-border)] bg-[var(--bg-secondary)]">
                      <div className="h-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[9px] text-[var(--text-muted)] text-center">{Math.round(loadingElapsed / 1000)}초 경과</p>
                  </div>
                );
              })()}
            </div>
          ) : dailyResult ? (
            <>
              {/* OG 이미지 */}
              {ogImageUrl && (
                <div className="-mx-4 -mt-2 mb-1">
                  <Image src={ogImageUrl} alt="오늘의 운세" width={480} height={252} className="w-full h-auto object-cover" unoptimized />
                </div>
              )}

              {/* 요약 + 점수 */}
              <div className="pixel-border-accent p-4 bg-[var(--accent-light)] text-center">
                {dailyResult.summary && (
                  <p className="text-sm text-[var(--text-primary)] font-bold mb-2">
                    {dailyResult.summary.replace(/<[^>]*>/g, '')}
                  </p>
                )}
                <StarScore score={overallScore} />
              </div>

              {/* 카테고리별 점수 */}
              {cats && (
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_INFO.map(({ key, label, color }) => {
                    const cat = cats[key as keyof typeof cats];
                    if (!cat) return null;
                    const score = typeof cat === 'object' ? cat.score : cat;
                    const message = typeof cat === 'object' ? cat.message : '';
                    return (
                      <div key={key} className="pixel-card p-3 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-pixel text-[10px]" style={{ color }}>{label}</span>
                          <StarScore score={score} />
                        </div>
                        {message && (
                          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{message}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 조언 */}
              {dailyResult.advice && (
                <div className="pixel-card p-4">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)] mb-2">오늘의 조언</h3>
                  {Array.isArray(dailyResult.advice) ? (
                    <ul className="flex flex-col gap-1.5">
                      {dailyResult.advice.map((item: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                          <span className="text-[var(--accent)] shrink-0">▸</span>
                          <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item, { ALLOWED_TAGS: ['strong', 'em'] }) }} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(dailyResult.advice), { ALLOWED_TAGS: ['strong', 'em', 'br'] }) }} />
                  )}
                </div>
              )}

              {/* 행운 아이템 */}
              {dailyResult.luckyItems && (
                <Recommendations luckyItems={dailyResult.luckyItems} />
              )}

              {/* 다시 보기 */}
              <button type="button"
                className="font-pixel text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] text-center"
                onClick={() => handleGetDaily(true)}>
                다시 보기 (🦴 1개)
              </button>
            </>
          ) : (
            /* 아직 안 봄 */
            <div className="flex flex-col items-center gap-5 py-10">
              <Image src="/images/pixel/daily.png" alt="오늘의 운세" width={120} height={120} className="rounded pixel-border" />
              <p className="font-pixel text-sm text-[var(--text-primary)]">오늘의 운세를 확인해보세요</p>
              <p className="text-[10px] text-[var(--text-muted)]">무료</p>
              <Button variant="primary" size="lg" loading={isLoading}
                onClick={() => handleGetDaily(false)} disabled={!selectedProfile}>
                오늘의 운세 보기
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    </AuthRequired>
  );
}
