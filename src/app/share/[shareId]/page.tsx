'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DOMPurify from 'dompurify';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button';
import ChapterAccordion from '@/components/saju/ChapterAccordion';
import Recommendations from '@/components/saju/Recommendations';
import ProfileInfoBadges from '@/components/saju/ProfileInfoBadges';
import FourPillars from '@/components/saju/FourPillars';
import OhaengBar from '@/components/saju/OhaengBar';
import DaeunTimeline from '@/components/saju/DaeunTimeline';
import SinsalSummary from '@/components/saju/SinsalSummary';
import DailyResultView from '@/components/saju/DailyResultView';
import { supabase } from '@/lib/supabase';
import { SERVICE_NAMES } from '@/lib/services';
import type { ServiceType, SajuPillars, SajuApiResponse, SajuChapter } from '@/types/saju';
import type { SajuProfile } from '@/types/user';

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const shareId = params.shareId as string;

  const [result, setResult] = useState<SajuApiResponse | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('comprehensive');
  const [profileData, setProfileData] = useState<SajuProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedReading() {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('readings')
        .select('result, service_type, profile_id, og_image_url')
        .eq('share_id', shareId)
        .eq('processing_status', 'completed')
        .single();

      if (fetchError || !data) {
        setError('공유된 풀이를 찾을 수 없어요');
        setIsLoading(false);
        return;
      }

      setResult(data.result as SajuApiResponse);
      setServiceType(data.service_type as ServiceType);
      if (data.og_image_url) setOgImageUrl(data.og_image_url);

      // Load profile for saju details
      if (data.profile_id) {
        const { data: pData } = await supabase
          .from('saju_profiles')
          .select('*')
          .eq('id', data.profile_id)
          .single();
        if (pData) setProfileData(pData as SajuProfile);
      }

      setIsLoading(false);
    }

    fetchSharedReading();
  }, [shareId]);

  const serviceName = SERVICE_NAMES[serviceType] || serviceType;
  const isCompatibility = serviceType === 'compatibility' || serviceType === 'business';
  const isDaily = serviceType === 'daily';
  const calculatedSaju = profileData?.calculated_saju as SajuPillars | null;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Simple Header */}
      <header className="border-b-2 border-[var(--pixel-border)] bg-[var(--bg-primary)]">
        <div className="flex items-center justify-center h-12 px-4">
          <h1 className="font-pixel text-sm text-[var(--accent)]">사주독</h1>
        </div>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6 animate-fade-in">
        {isLoading ? (
          <Loading message="풀이 결과를 불러오는 중..." />
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <span className="text-4xl">🐕</span>
            <p className="font-pixel text-xs text-[var(--error)]">{error}</p>
            <Button variant="primary" onClick={() => router.push('/')}>
              사주독에서 나도 보기
            </Button>
          </div>
        ) : result && serviceType === 'daily' ? (
          <>
            {ogImageUrl && (
              <div className="-mx-4 -mt-4 mb-2">
                <img src={ogImageUrl} alt={serviceName} className="w-full h-auto object-cover" />
              </div>
            )}
            <DailyResultView result={result as unknown as Record<string, unknown>} />
            <div className="mt-4 mb-8">
              <Button variant="primary" className="w-full" onClick={() => router.push('/')}>
                사주독에서 나도 보기
              </Button>
            </div>
          </>
        ) : result ? (
          <>
            {/* OG 이미지 */}
            {ogImageUrl && (
              <div className="-mx-4 -mt-4 mb-2">
                <img src={ogImageUrl} alt={serviceName} className="w-full h-auto object-cover" />
              </div>
            )}

            {/* Service Name */}
            <div className="text-center">
              <span className="font-pixel text-xs text-[var(--text-muted)]">{serviceName}</span>
            </div>

            {/* Summary (sanitized with DOMPurify) */}
            <div className="pixel-border-accent p-4 bg-[var(--accent-light)]">
              <p
                className="text-sm text-[var(--text-primary)] leading-relaxed chapter-content"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.summary || '', { ALLOWED_TAGS: ['strong', 'em', 'br', 'span'] }) }}
              />
            </div>

            {/* Profile Info + Saju Details (hidden for compatibility/daily) */}
            {calculatedSaju && !isCompatibility && !isDaily && (
              <div className="flex flex-col gap-3">
                <ProfileInfoBadges sajuData={calculatedSaju} name={profileData?.name} />

                {calculatedSaju.pillars && (
                  <>
                    <h3 className="font-pixel text-xs text-[var(--text-secondary)]">사주팔자</h3>
                    <FourPillars pillars={calculatedSaju.pillars} />
                  </>
                )}

                {calculatedSaju.ohaengCount && (
                  <>
                    <h3 className="font-pixel text-xs text-[var(--text-secondary)]">오행 분포</h3>
                    <OhaengBar ohaengCount={calculatedSaju.ohaengCount} />
                  </>
                )}

                {(calculatedSaju.daeun?.length ?? 0) > 0 && (
                  <>
                    <h3 className="font-pixel text-xs text-[var(--text-secondary)]">대운 흐름</h3>
                    <DaeunTimeline daeun={calculatedSaju.daeun} />
                  </>
                )}

                {calculatedSaju.sinsal && (
                  <>
                    <h3 className="font-pixel text-xs text-[var(--text-secondary)]">신살 분석</h3>
                    <SinsalSummary sajuData={calculatedSaju} />
                  </>
                )}
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
            {result.chapters?.map((ch: SajuChapter, i: number) => (
              <ChapterAccordion key={ch.id} chapter={ch} defaultOpen={i === 0} />
            ))}

            {/* Recommendations */}
            {result.luckyItems && (
              <div className="flex flex-col gap-3">
                <h3 className="font-pixel text-xs text-[var(--text-secondary)]">행운 아이템</h3>
                <Recommendations luckyItems={result.luckyItems} />
              </div>
            )}

            {/* Advice */}
            {result.advice?.length > 0 && (
              <div className="pixel-card p-4">
                <ul className="flex flex-col gap-2">
                  {(Array.isArray(result.advice) ? result.advice : []).map((item: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="text-[var(--accent)] shrink-0">▸</span>
                      <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item, { ALLOWED_TAGS: ['strong', 'em', 'br'] }) }} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            <div className="mt-4 mb-8">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => router.push('/')}
              >
                사주독에서 나도 보기
              </Button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
