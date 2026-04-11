'use client';

import { useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ChapterAccordion from '@/components/saju/ChapterAccordion';
import Recommendations from '@/components/saju/Recommendations';
import { useSajuStore } from '@/stores/saju';
import { useCreditStore } from '@/stores/credit';
import { supabase } from '@/lib/supabase';
import type { SajuApiResponse, SajuChapter } from '@/types/saju';

interface DailyResult extends SajuApiResponse {
  overallScore?: number;
  categoryScores?: {
    love: number;
    money: number;
    work: number;
    health: number;
  };
}

function PixelHearts({ score, max = 5 }: { score: number; max?: number }) {
  const filled = Math.round((score / 100) * max);
  return (
    <span className="font-pixel text-sm tracking-wider">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < filled ? 'text-[var(--fire)]' : 'text-[var(--pixel-shadow)]'}>
          ♥
        </span>
      ))}
    </span>
  );
}

function CategoryScore({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-pixel text-[10px] text-[var(--text-secondary)]">{label}</span>
      <PixelHearts score={score} />
    </div>
  );
}

// Sanitize HTML content with DOMPurify to prevent XSS
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'span'],
    ALLOWED_ATTR: ['class', 'style'],
  });
}

export default function DailyPage() {
  const { profiles, fetchProfiles } = useSajuStore();
  const { fetchCredits } = useCreditStore();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isReread, setIsReread] = useState(false);

  const selectedProfile = profiles[selectedIdx];

  useEffect(() => {
    fetchProfiles();
    fetchCredits();
  }, [fetchProfiles, fetchCredits]);

  // Check if today's daily already exists
  useEffect(() => {
    if (!selectedProfile) return;

    async function checkExisting() {
      setIsChecking(true);
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('readings')
        .select('result')
        .eq('profile_id', selectedProfile.id)
        .eq('service_type', 'daily')
        .eq('processing_status', 'completed')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].result) {
        setDailyResult(data[0].result as DailyResult);
      } else {
        setDailyResult(null);
      }
      setIsChecking(false);
    }

    checkExisting();
  }, [selectedProfile]);

  const handleGetDaily = useCallback(async (force = false) => {
    if (!selectedProfile) return;
    setShowConfirm(false);
    setIsLoading(true);
    try {
      const { startReading } = useSajuStore.getState();
      await startReading(selectedProfile.id, 'daily', force);

      // Wait for result via polling in store
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
          // Check immediately in case already done
          const current = useSajuStore.getState();
          if (current.processingStatus === 'completed' && current.currentReading) {
            unsub();
            resolve(current.currentReading);
          }
        });

      const result = await waitForResult();
      if (result) {
        setDailyResult(result as DailyResult);
      }
    } finally {
      setIsLoading(false);
      fetchCredits();
    }
  }, [selectedProfile, fetchCredits]);

  return (
    <AuthRequired>
      <AppShell title="오늘의 운세" showBack>
        <div className="p-4 flex flex-col gap-6 animate-fade-in">
          {/* Profile Selector */}
          {profiles.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="font-pixel text-[10px] text-[var(--text-muted)]">프로필 선택</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {profiles.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`shrink-0 px-3 py-2 text-xs font-pixel border-2 border-[var(--pixel-border)] transition-colors ${
                      idx === selectedIdx
                        ? 'bg-[var(--accent)] text-white border-[var(--accent-hover)]'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                    onClick={() => setSelectedIdx(idx)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isChecking ? (
            <Loading message="확인 중..." />
          ) : dailyResult ? (
            /* Result */
            <>
              {/* Overall Score */}
              {dailyResult.overallScore != null && (
                <div className="pixel-border-accent p-4 bg-[var(--accent-light)] flex flex-col items-center gap-2">
                  <span className="font-pixel text-xs text-[var(--text-muted)]">오늘의 운세 점수</span>
                  <PixelHearts score={dailyResult.overallScore} />
                  <span className="font-pixel text-lg text-[var(--accent)]">
                    {dailyResult.overallScore}점
                  </span>
                </div>
              )}

              {/* Category Scores */}
              {dailyResult.categoryScores && (
                <div className="pixel-card p-4 flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">영역별 운세</h3>
                  <CategoryScore label="연애운 💕" score={dailyResult.categoryScores.love} />
                  <CategoryScore label="금전운 💰" score={dailyResult.categoryScores.money} />
                  <CategoryScore label="직장운 💼" score={dailyResult.categoryScores.work} />
                  <CategoryScore label="건강운 🏥" score={dailyResult.categoryScores.health} />
                </div>
              )}

              {/* Chapters */}
              {dailyResult.chapters?.map((ch: SajuChapter, i: number) => (
                <ChapterAccordion key={ch.id} chapter={ch} defaultOpen={i === 0} />
              ))}

              {/* Lucky Items */}
              {dailyResult.luckyItems && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">오늘의 행운</h3>
                  <Recommendations luckyItems={dailyResult.luckyItems} />
                </div>
              )}

              {/* Advice - sanitized with DOMPurify */}
              {dailyResult.advice?.length > 0 && (
                <div className="pixel-card p-4">
                  <ul className="flex flex-col gap-2">
                    {(Array.isArray(dailyResult.advice) ? dailyResult.advice : []).map((item: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                        <span className="text-[var(--accent)] shrink-0">▸</span>
                        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(item) }} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Re-read button */}
              <button
                type="button"
                className="font-pixel text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors text-center"
                onClick={() => {
                  setIsReread(true);
                  setShowConfirm(true);
                }}
              >
                다시 보기 (🦴 1개)
              </button>
            </>
          ) : (
            /* No Result Yet */
            <div className="flex flex-col items-center gap-6 py-12">
              <span className="text-5xl">☀️</span>
              <p className="font-pixel text-xs text-[var(--text-secondary)] text-center">
                오늘의 운세를 확인해보세요
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">무료</p>
              <Button
                variant="primary"
                size="lg"
                loading={isLoading}
                onClick={() => {
                  setIsReread(false);
                  setShowConfirm(true);
                }}
                disabled={!selectedProfile}
              >
                오늘의 운세 보기
              </Button>
            </div>
          )}

          {/* Confirm Modal */}
          <ConfirmModal
            isOpen={showConfirm}
            onClose={() => { setShowConfirm(false); setIsReread(false); }}
            onConfirm={() => handleGetDaily(isReread)}
            title={isReread ? '오늘의 운세 다시 보기' : '오늘의 운세'}
            message={
              isReread
                ? '1개를 사용하여 오늘의 운세를 다시 받을까요?'
                : '오늘의 운세를 확인할까요? (무료)'
            }
            confirmText="확인"
            cancelText="취소"
          />
        </div>
      </AppShell>
    </AuthRequired>
  );
}
