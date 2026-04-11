'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import FourPillars from '@/components/saju/FourPillars';
import OhaengBar from '@/components/saju/OhaengBar';
import ChapterAccordion from '@/components/saju/ChapterAccordion';
import Recommendations from '@/components/saju/Recommendations';
import DaeunTimeline from '@/components/saju/DaeunTimeline';
import SinsalSummary from '@/components/saju/SinsalSummary';
import ProfileInfoBadges from '@/components/saju/ProfileInfoBadges';
import DOMPurify from 'dompurify';
import { showToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/auth';
import { useSajuStore } from '@/stores/saju';
import { supabase } from '@/lib/supabase';
import { createChatSession, sendChatMessage } from '@/lib/api';
import { SERVICE_NAMES } from '@/lib/services';
import type { ServiceType, SajuApiResponse, SajuPillars } from '@/types/saju';
import type { Reading, SajuProfile } from '@/types/user';

export default function ArchiveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const readingId = params.readingId as string;
  const { profiles } = useSajuStore();

  const [reading, setReading] = useState<Reading | null>(null);
  const [profileData, setProfileData] = useState<SajuProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return; // 세션 준비 후 fetch

    async function loadReading() {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('readings')
        .select('*')
        .eq('id', readingId)
        .single();

      if (fetchError) {
        setError('풀이 결과를 불러올 수 없어요');
        setIsLoading(false);
        return;
      }

      setReading(data);

      // Load profile for FourPillars / OhaengBar
      let profile = profiles.find((p) => p.id === data.profile_id) ?? null;
      if (!profile && data.profile_id) {
        const { data: pData } = await supabase
          .from('saju_profiles')
          .select('*')
          .eq('id', data.profile_id)
          .single();
        if (pData) profile = pData as SajuProfile;
      }
      if (profile) setProfileData(profile);

      setIsLoading(false);
    }

    loadReading();
  }, [readingId, profiles, isAuthenticated]);

  const handleShare = useCallback(async () => {
    if (!reading) return;

    let shareId = reading.share_id;
    if (!shareId) {
      // Generate share_id and save to DB
      shareId = crypto.randomUUID();
      const { error: updateError } = await supabase
        .from('readings')
        .update({ share_id: shareId })
        .eq('id', reading.id);
      if (updateError) {
        showToast('공유 링크 생성에 실패했어요');
        return;
      }
      setReading({ ...reading, share_id: shareId });
    }

    const shareUrl = `${window.location.origin}/share/${shareId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('공유 링크가 복사되었어요!');
    } catch {
      prompt('링크를 복사하세요:', shareUrl);
    }
  }, [reading]);

  const serviceType = (reading?.service_type || 'comprehensive') as ServiceType;
  const serviceName = SERVICE_NAMES[serviceType] || reading?.service_type || '';
  const result = reading?.result as SajuApiResponse | null;
  const isCompatibility = serviceType === 'compatibility' || serviceType === 'business';
  const isDaily = serviceType === 'daily';
  const calculatedSaju = profileData?.calculated_saju as SajuPillars | null;

  return (
    <AuthRequired>
      <AppShell title={serviceName}>
        <div className="p-4 flex flex-col gap-6 animate-fade-in">
          {/* OG 이미지 (상단 전체 너비) */}
          {reading?.og_image_url && (
            <div className="-mx-4 -mt-4 mb-2">
              <Image
                src={reading.og_image_url}
                alt={serviceName}
                width={480}
                height={252}
                className="w-full h-auto object-cover"
                unoptimized
              />
            </div>
          )}

          {isLoading ? (
            <Loading message="결과를 불러오는 중..." />
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <p className="font-pixel text-xs text-[var(--error)]">{error}</p>
              <Button variant="secondary" onClick={() => router.push('/archive')}>
                목록으로
              </Button>
            </div>
          ) : result ? (
            <>
              {/* Summary - DOMPurify 필수 적용 */}
              <div className="pixel-border-accent p-4 bg-[var(--accent-light)]">
                <p
                  className="text-sm text-[var(--text-primary)] leading-relaxed chapter-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.summary || '', { ALLOWED_TAGS: ['strong', 'em', 'br', 'span'] }) }}
                />
              </div>

              {/* Four Pillars (not for compatibility/daily) */}
              {calculatedSaju?.pillars && !isCompatibility && !isDaily && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">사주팔자</h3>
                  <FourPillars pillars={calculatedSaju.pillars} />
                </div>
              )}

              {/* Ohaeng Bar */}
              {calculatedSaju?.ohaengCount && !isCompatibility && !isDaily && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">오행 분포</h3>
                  <OhaengBar ohaengCount={calculatedSaju.ohaengCount} />
                </div>
              )}

              {/* Profile Info Badges */}
              {calculatedSaju && !isCompatibility && !isDaily && (
                <ProfileInfoBadges sajuData={calculatedSaju} name={profileData?.name} />
              )}

              {/* Daeun Timeline */}
              {(calculatedSaju?.daeun?.length ?? 0) > 0 && !isCompatibility && !isDaily && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">대운 흐름</h3>
                  <DaeunTimeline daeun={calculatedSaju!.daeun} />
                </div>
              )}

              {/* Sinsal Summary */}
              {calculatedSaju?.sinsal && !isCompatibility && !isDaily && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">신살 분석</h3>
                  <SinsalSummary sajuData={calculatedSaju} />
                </div>
              )}

              {/* Overall Score */}
              {result.overallScore != null && (
                <div className="flex flex-col items-center gap-2">
                  <span className="font-pixel text-xs text-[var(--text-muted)]">종합 점수</span>
                  <div className="score-pixel">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`score-pixel-dot ${i < Math.round(result.overallScore! / 10) ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                  <span className="font-pixel text-lg text-[var(--accent)]">
                    {result.overallScore}점
                  </span>
                </div>
              )}

              {/* Chapters */}
              {result.chapters?.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">상세 풀이</h3>
                  {result.chapters.map((ch, i) => (
                    <ChapterAccordion key={ch.id} chapter={ch} defaultOpen={i === 0} />
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {result.luckyItems && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">행운 아이템</h3>
                  <Recommendations luckyItems={result.luckyItems} />
                </div>
              )}

              {/* Advice */}
              {result.advice && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">조언</h3>
                  <div className="pixel-card p-4">
                    {Array.isArray(result.advice) ? (
                      <ul className="flex flex-col gap-2">
                        {result.advice.map((item: string, i: number) => (
                          <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                            <span className="text-[var(--accent)] shrink-0">▸</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{String(result.advice)}</p>
                    )}
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

              {/* Chat about this reading */}
              {reading?.profile_id && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const session = await createChatSession(reading.profile_id);
                      await sendChatMessage(
                        session.id,
                        `[사주 풀이 내용]\n${result.summary}\n\n위 풀이 내용에 대해 궁금한 점을 물어보세요.`,
                      );
                      router.push(`/chat?sessionId=${session.id}`);
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : '채팅 세션 생성에 실패했어요',
                      );
                    }
                  }}
                >
                  이 풀이에 대해 질문하기
                </Button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-16">
              <p className="font-pixel text-xs text-[var(--text-muted)]">
                결과가 아직 없어요
              </p>
            </div>
          )}
        </div>

        {/* Floating Share Button */}
        {result && (
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
