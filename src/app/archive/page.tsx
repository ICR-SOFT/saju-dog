'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Loading from '@/components/ui/Loading';
import { useSajuStore } from '@/stores/saju';
import { SERVICE_NAMES } from '@/lib/services';
import type { ServiceType } from '@/types/saju';

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <span className="font-pixel text-[10px] text-[var(--success)]">✅ 완료</span>;
    case 'processing':
    case 'pending':
      return (
        <span className="font-pixel text-[10px] text-[var(--warning)] inline-flex items-center gap-1">
          <span className="pixel-loading inline-flex"><span /><span /><span /></span>
          처리중
        </span>
      );
    case 'failed':
      return <span className="font-pixel text-[10px] text-[var(--error)]">❌ 실패</span>;
    default:
      return null;
  }
}

export default function ArchivePage() {
  const router = useRouter();
  const { readings, fetchReadings, isLoading, profiles, fetchProfiles } = useSajuStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchReadings();
    fetchProfiles();
  }, [fetchReadings, fetchProfiles]);

  // 5-second auto-refresh polling when any readings are processing/pending
  useEffect(() => {
    const hasProcessing = readings.some(
      (r) => r.processing_status === 'processing' || r.processing_status === 'pending',
    );

    if (hasProcessing) {
      pollRef.current = setInterval(() => {
        fetchReadings();
      }, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [readings, fetchReadings]);

  return (
    <AuthRequired>
      <AppShell title="풀이 기록" showNav>
        <div className="p-4 flex flex-col gap-3 animate-fade-in">
          {isLoading && readings.length === 0 ? (
            <Loading message="기록을 불러오는 중..." />
          ) : readings.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <pre className="font-pixel text-[10px] text-[var(--text-muted)] leading-tight text-center whitespace-pre">
{`   / \\__
  (    @\\___
  /         O
 /   (_____/
/_____/   U`}
              </pre>
              <p className="font-pixel text-xs text-[var(--text-muted)] text-center">
                아직 풀이 기록이 없어요
              </p>
              <button
                type="button"
                className="font-pixel text-xs text-[var(--accent)] hover:underline"
                onClick={() => router.push('/')}
              >
                첫 번째 풀이 시작하기 →
              </button>
            </div>
          ) : (
            /* Reading List */
            readings.map((reading) => {
              const serviceType = reading.service_type as ServiceType;
              const name = SERVICE_NAMES[serviceType] || reading.service_type;
              const date = new Date(reading.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              // 궁합: 모든 참여자 이름 표시
              const getNames = () => {
                const names = [];
                const p1 = profiles.find(p => p.id === reading.profile_id);
                if (p1) names.push(p1.name);
                if (reading.secondary_profile_id) {
                  const p2 = profiles.find(p => p.id === reading.secondary_profile_id);
                  if (p2) names.push(p2.name);
                }
                const meta = reading.metadata as Record<string, string> | null;
                if (meta?.allProfileIds) {
                  try {
                    const allIds = JSON.parse(meta.allProfileIds) as string[];
                    allIds.forEach(id => {
                      if (id !== reading.profile_id && id !== reading.secondary_profile_id) {
                        const p = profiles.find(pr => pr.id === id);
                        if (p) names.push(p.name);
                      }
                    });
                  } catch { /* ignore */ }
                }
                return names.length > 0 ? names.join(' & ') : null;
              };
              const profileNames = getNames();

              return (
                <button
                  key={reading.id}
                  type="button"
                  className="pixel-card p-4 w-full text-left flex items-center gap-3"
                  onClick={() => {
                    if (reading.processing_status === 'completed') {
                      router.push(`/archive/${reading.id}`);
                    }
                  }}
                  disabled={reading.processing_status !== 'completed'}
                >
                  <Image src={`/images/pixel/${serviceType}.png`} alt={name} width={36} height={36} className="shrink-0 rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel text-xs text-[var(--text-primary)] truncate">
                      {name}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {profileNames && <span className="text-[var(--text-secondary)]">{profileNames} · </span>}
                      {date}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {statusBadge(reading.processing_status)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </AppShell>
    </AuthRequired>
  );
}
