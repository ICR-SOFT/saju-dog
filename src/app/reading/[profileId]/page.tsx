'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import DOMPurify from 'dompurify';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import CostBadge from '@/components/ui/CostBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import FourPillars from '@/components/saju/FourPillars';
import OhaengBar from '@/components/saju/OhaengBar';
import ChapterAccordion from '@/components/saju/ChapterAccordion';
import Recommendations from '@/components/saju/Recommendations';
import DaeunTimeline from '@/components/saju/DaeunTimeline';
import SinsalSummary from '@/components/saju/SinsalSummary';
import ProfileInfoBadges from '@/components/saju/ProfileInfoBadges';
import { showToast } from '@/components/ui/Toast';
import { useSajuStore } from '@/stores/saju';
import { useCreditStore } from '@/stores/credit';
import { createChatSession, sendChatMessage } from '@/lib/api';
import { CREDIT_COSTS } from '@/types/api';
import { SERVICE_NAMES } from '@/lib/services';
import type { ServiceType, SajuPillars, SajuApiResponse } from '@/types/saju';

type Phase = 'profile' | 'confirm' | 'loading' | 'result';

const LOADING_MESSAGES = [
  '사주를 분석하고 있어요...',
  '운명의 실타래를 풀고 있어요...',
  '별자리를 읽고 있어요...',
  '오행의 흐름을 살피고 있어요...',
  '천간과 지지를 해석하고 있어요...',
  '대운의 흐름을 파악하고 있어요...',
];

export default function ReadingPage() {
  return (
    <Suspense fallback={<Loading message="로딩 중..." />}>
      <ReadingContent />
    </Suspense>
  );
}

function ReadingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const profileId = params.profileId as string;
  const serviceType = (searchParams.get('service') || 'comprehensive') as ServiceType;

  const {
    profiles,
    fetchProfiles,
    currentReading,
    processingStatus,
    error,
    startReading,
    clearCurrentReading,
    isLoading: sajuLoading,
  } = useSajuStore();
  const { credits, fetchCredits } = useCreditStore();

  const [phase, setPhase] = useState<Phase>('profile');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [avgDuration, setAvgDuration] = useState<number>(60000); // 기본 60초
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);

  const profile = profiles.find((p) => p.id === profileId);
  const cost = CREDIT_COSTS[serviceType]?.bones ?? 0;
  const serviceName = SERVICE_NAMES[serviceType] || serviceType;
  const calculatedSaju = profile?.calculated_saju as SajuPillars | null;
  const { readingCache } = useSajuStore();

  // Fetch data on mount + check cache/DB
  useEffect(() => {
    fetchProfiles();
    fetchCredits();
    clearCurrentReading();

    // Check readingCache in store
    const cacheKey = `${profileId}:${serviceType}`;
    const cached = readingCache[cacheKey];
    if (cached) {
      // Use cached result directly
      useSajuStore.setState({ currentReading: cached, processingStatus: 'completed' });
      return;
    }

    // 평균 처리 시간 조회
    async function fetchAvgDuration() {
      const { data } = await (await import('@/lib/supabase')).supabase
        .from('readings')
        .select('processing_duration_ms')
        .eq('service_type', serviceType)
        .eq('processing_status', 'completed')
        .not('processing_duration_ms', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data && data.length > 0) {
        const durations = data.map((d: { processing_duration_ms: number }) => d.processing_duration_ms).filter(Boolean);
        if (durations.length > 0) {
          setAvgDuration(Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length));
        }
      }
    }
    fetchAvgDuration();

    // Check DB for existing reading (completed OR processing)
    async function checkExistingReading() {
      const { data } = await (await import('@/lib/supabase')).supabase
        .from('readings')
        .select('id, result, processing_status, created_at, processing_started_at')
        .eq('profile_id', profileId)
        .eq('service_type', serviceType)
        .in('processing_status', ['completed', 'processing', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setReadingId(data[0].id);
        if (data[0].processing_status === 'completed' && data[0].result) {
          useSajuStore.setState({
            currentReading: data[0].result as SajuApiResponse,
            processingStatus: 'completed',
          });
        } else if (data[0].processing_status === 'processing' || data[0].processing_status === 'pending') {
          // 처리 중인 reading → DB의 시작 시간 기준으로 경과 시간 계산
          const startedAt = data[0].processing_started_at || data[0].created_at;
          const dbStartTime = new Date(startedAt).getTime();
          setLoadingStartTime(dbStartTime);
          setLoadingElapsed(Date.now() - dbStartTime);

          useSajuStore.setState({
            processingStatus: 'processing',
            pendingReadingId: data[0].id,
          });
          setPhase('loading');
        }
      }
    }
    checkExistingReading();
  }, [fetchProfiles, fetchCredits, clearCurrentReading, profileId, serviceType, readingCache]);

  // Track processing status transitions
  useEffect(() => {
    if (processingStatus === 'processing') {
      setPhase('loading');
    } else if (processingStatus === 'completed' && currentReading) {
      setPhase('result');
    } else if (processingStatus === 'failed') {
      setPhase('profile');
    }
  }, [processingStatus, currentReading]);

  // Loading phase: rotate messages + elapsed timer
  useEffect(() => {
    if (phase !== 'loading') return;
    if (!loadingStartTime) setLoadingStartTime(Date.now());

    const msgInterval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    const timerInterval = setInterval(() => {
      if (loadingStartTime) {
        setLoadingElapsed(Date.now() - loadingStartTime);
      }
    }, 500);

    return () => { clearInterval(msgInterval); clearInterval(timerInterval); };
  }, [phase, loadingStartTime]);

  const handleStartReading = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const [forceReread, setForceReread] = useState(false);

  const handleConfirm = useCallback(async (question?: string) => {
    setShowConfirm(false);
    setPhase('loading');
    setLoadingStartTime(Date.now());
    setLoadingElapsed(0);
    const meta = question ? { userQuestion: question } : undefined;
    await startReading(profileId, serviceType, forceReread, meta);
    setForceReread(false);
  }, [startReading, profileId, serviceType, forceReread]);

  const handleReread = useCallback(() => {
    setForceReread(true);
    setShowConfirm(true);
  }, []);

  const handleShare = useCallback(async () => {
    if (!readingId && !useSajuStore.getState().pendingReadingId) {
      // Fallback to current URL
      const url = window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        showToast('링크가 복사되었어요!');
      } catch {
        prompt('링크를 복사하세요:', url);
      }
      return;
    }

    const targetReadingId = readingId || useSajuStore.getState().pendingReadingId;
    if (!targetReadingId) return;

    try {
      // Generate share_id UUID and save to DB
      const shareId = crypto.randomUUID();
      const { supabase } = await import('@/lib/supabase');
      const { error: updateError } = await supabase
        .from('readings')
        .update({ share_id: shareId })
        .eq('id', targetReadingId);

      if (updateError) {
        showToast('공유 링크 생성에 실패했어요');
        return;
      }

      const shareUrl = `${window.location.origin}/share/${shareId}`;
      await navigator.clipboard.writeText(shareUrl);
      showToast('공유 링크가 복사되었어요!');
    } catch {
      prompt('링크를 복사하세요:', window.location.href);
    }
  }, [readingId]);

  // Type-safe reading cast
  const reading = currentReading as SajuApiResponse | null;

  return (
    <AuthRequired>
      <AppShell title={serviceName}>
        <div className="p-4 flex flex-col gap-6 animate-fade-in">
          {/* ===== Phase 1: View Profile ===== */}
          {phase === 'profile' && (
            <>
              {!profile ? (
                <Loading message="프로필을 불러오는 중..." />
              ) : (
                <>
                  {/* Profile Info Badges */}
                  {calculatedSaju && (
                    <ProfileInfoBadges sajuData={calculatedSaju} name={profile.name} />
                  )}

                  {/* Four Pillars */}
                  {calculatedSaju?.pillars && (
                    <div className="flex flex-col gap-3">
                      <h3 className="font-pixel text-xs text-[var(--text-secondary)]">사주팔자</h3>
                      <FourPillars pillars={calculatedSaju.pillars} />
                    </div>
                  )}

                  {/* Ohaeng Bar */}
                  {calculatedSaju?.ohaengCount && (
                    <div className="flex flex-col gap-3">
                      <h3 className="font-pixel text-xs text-[var(--text-secondary)]">오행 분포</h3>
                      <OhaengBar ohaengCount={calculatedSaju.ohaengCount} />
                    </div>
                  )}

                  {/* Daeun Timeline */}
                  {(calculatedSaju?.daeun?.length ?? 0) > 0 && (
                    <DaeunTimeline daeun={calculatedSaju!.daeun} />
                  )}

                  {/* Sinsal Summary */}
                  {calculatedSaju?.sinsal && (
                    <SinsalSummary sajuData={calculatedSaju} />
                  )}

                  {/* Error */}
                  {error && (
                    <div className="pixel-card p-3 border-[var(--error)]">
                      <p className="text-xs text-[var(--error)] text-center">{error}</p>
                    </div>
                  )}

                  {/* Start Button */}
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={handleStartReading}
                    disabled={sajuLoading}
                  >
                    풀이 시작 <CostBadge cost={cost} className="ml-2" />
                  </Button>

                  {credits && (
                    <p className="text-center text-xs text-[var(--text-muted)]">
                      보유: 🦴 {credits.bones}개
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {/* ===== Phase 2: Confirm Modal ===== */}
          <ConfirmModal
            isOpen={showConfirm}
            onClose={() => { setShowConfirm(false); setForceReread(false); }}
            onConfirm={handleConfirm}
            title={forceReread ? '다시 풀이받기' : '풀이 시작'}
            message={`${cost}개를 사용하여 ${serviceName}${forceReread ? '을 다시 시작' : '을 시작'}할까요?`}
            confirmText={cost > 0 ? `${cost} 시작` : '시작'}
            cancelText="취소"
            showQuestion
            disabled={credits ? credits.bones < cost : false}
          />

          {/* ===== Phase 3: Loading ===== */}
          {phase === 'loading' && (
            <>
              {/* 로딩 중에도 프로필 정보 표시 */}
              {calculatedSaju && (
                <div className="flex flex-col gap-3">
                  <ProfileInfoBadges sajuData={calculatedSaju} name={profile?.name} />
                  <FourPillars pillars={calculatedSaju.pillars} />
                  <OhaengBar ohaengCount={calculatedSaju.ohaengCount} />
                  {(calculatedSaju.daeun?.length ?? 0) > 0 && (
                    <DaeunTimeline daeun={calculatedSaju.daeun} />
                  )}
                  {calculatedSaju.sinsal && (
                    <SinsalSummary sajuData={calculatedSaju} />
                  )}
                </div>
              )}

              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <div className="pixel-loading" role="status" aria-label="분석 중">
                  <span /><span /><span /><span />
                </div>
                <p className="font-pixel text-xs text-[var(--text-secondary)] text-center animate-fade-in" key={loadingMsgIdx}>
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </p>

                {/* Progress Bar */}
                {(() => {
                  const estimatedTotal = avgDuration * 1.2; // +20%
                  const progress = Math.min((loadingElapsed / estimatedTotal) * 100, 95);
                  const remainSec = Math.max(0, Math.round((estimatedTotal - loadingElapsed) / 1000));
                  return (
                    <div className="w-full max-w-[280px] flex flex-col gap-1">
                      <div className="w-full h-4 border-2 border-[var(--pixel-border)] bg-[var(--bg-secondary)]">
                        <div
                          className="h-full bg-[var(--accent)] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                        <span>{Math.round(loadingElapsed / 1000)}초 경과</span>
                        <span>약 {remainSec}초 남음</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* ===== Phase 4: Result ===== */}
          {phase === 'result' && reading && (
            <>
              {/* Summary (DOMPurify sanitized - safe to render) */}
              <div className="pixel-border-accent p-4 bg-[var(--accent-light)]">
                <p
                  className="text-sm text-[var(--text-primary)] leading-relaxed chapter-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reading.summary || '', { ALLOWED_TAGS: ['strong', 'em', 'br', 'span'] }) }}
                />
              </div>

              {/* Profile Info + Saju Details */}
              {calculatedSaju && (
                <div className="flex flex-col gap-3">
                  <ProfileInfoBadges sajuData={calculatedSaju} name={profile?.name} />
                  <FourPillars pillars={calculatedSaju.pillars} />
                  <OhaengBar ohaengCount={calculatedSaju.ohaengCount} />
                  {(calculatedSaju.daeun?.length ?? 0) > 0 && (
                    <DaeunTimeline daeun={calculatedSaju.daeun} />
                  )}
                  {calculatedSaju.sinsal && (
                    <SinsalSummary sajuData={calculatedSaju} />
                  )}
                </div>
              )}

              {/* Overall Score */}
              {reading.overallScore != null && (
                <div className="flex flex-col items-center gap-2">
                  <span className="font-pixel text-xs text-[var(--text-muted)]">종합 점수</span>
                  <div className="score-pixel">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`score-pixel-dot ${i < Math.round(reading.overallScore! / 10) ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                  <span className="font-pixel text-lg text-[var(--accent)]">
                    {reading.overallScore}점
                  </span>
                </div>
              )}

              {/* Chapters */}
              {reading.chapters?.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">상세 풀이</h3>
                  {reading.chapters.map((ch, i) => (
                    <ChapterAccordion key={ch.id} chapter={ch} defaultOpen={i === 0} />
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {reading.luckyItems && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">행운 아이템</h3>
                  <Recommendations luckyItems={reading.luckyItems} />
                </div>
              )}

              {/* Advice */}
              {reading.advice?.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">조언</h3>
                  <div className="pixel-card p-4">
                    <ul className="flex flex-col gap-2">
                      {reading.advice.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                          <span className="text-[var(--accent)] shrink-0">▸</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-2">
                <Button variant="secondary" className="flex-1" onClick={handleShare}>
                  공유하기
                </Button>
                <Button variant="primary" className="flex-1" onClick={() => router.push('/')}>
                  홈으로
                </Button>
              </div>

              {/* Re-read button */}
              <button
                type="button"
                className="font-pixel text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors text-center mt-1"
                onClick={handleReread}
              >
                다시 풀이받기 (🦴 {cost}개)
              </button>

              {/* Chat about this reading */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  try {
                    const session = await createChatSession(profileId);
                    await sendChatMessage(
                      session.id,
                      `[사주 풀이 내용]\n${reading.summary}\n\n위 풀이 내용에 대해 궁금한 점을 물어보세요.`,
                    );
                    router.push('/chat');
                  } catch (err) {
                    showToast(
                      err instanceof Error ? err.message : '채팅 세션 생성에 실패했어요',
                    );
                  }
                }}
              >
                이 풀이에 대해 질문하기
              </Button>
            </>
          )}
        </div>

        {/* Floating Share Button */}
        {phase === 'result' && (
          <button
            type="button"
            onClick={handleShare}
            className="fixed bottom-20 right-4 z-50 w-12 h-12 pixel-btn pixel-btn-accent flex items-center justify-center text-white text-lg"
            style={{ maxWidth: '480px' }}
            aria-label="공유하기"
          >
            ↗
          </button>
        )}
      </AppShell>
    </AuthRequired>
  );
}
