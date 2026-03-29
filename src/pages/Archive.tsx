import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Logo } from '@/components/ui/Logo.tsx';
import { useSajuStore } from '@/stores/saju.ts';

const SERVICE_LABELS: Record<string, { label: string; emoji: string; borderColor: string }> = {
  comprehensive: { label: '종합 사주풀이', emoji: '🔮', borderColor: 'border-l-amber-400' },
  compatibility: { label: '궁합', emoji: '💕', borderColor: 'border-l-pink-400' },
  daily: { label: '오늘의 운세', emoji: '🌅', borderColor: 'border-l-orange-400' },
  daeun: { label: '대운 분석', emoji: '🌊', borderColor: 'border-l-teal-400' },
  yearly: { label: '연간 운세', emoji: '📅', borderColor: 'border-l-violet-400' },
  chat: { label: '멍도령 상담', emoji: '💬', borderColor: 'border-l-sky-400' },
  business: { label: '동업 궁합', emoji: '🤝', borderColor: 'border-l-slate-400' },
  luckyday: { label: '택일/길일', emoji: '🗓️', borderColor: 'border-l-yellow-400' },
  love: { label: '연애 시기', emoji: '💘', borderColor: 'border-l-rose-400' },
  wealth: { label: '재물운', emoji: '💎', borderColor: 'border-l-yellow-500' },
  health: { label: '건강운', emoji: '🏥', borderColor: 'border-l-emerald-400' },
  career: { label: '직업 적성', emoji: '🎯', borderColor: 'border-l-blue-400' },
  pastlife: { label: '전생 이야기', emoji: '🔮', borderColor: 'border-l-purple-400' },
  moving: { label: '이사운', emoji: '🏠', borderColor: 'border-l-stone-400' },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  completed: { label: '완료', className: 'bg-green-900/30 text-green-300' },
  pending: { label: '대기 중', className: 'bg-yellow-900/30 text-yellow-300 animate-pulse' },
  processing: { label: '풀이 중...', className: 'bg-blue-900/30 text-blue-300 animate-pulse' },
  failed: { label: '실패 (환불됨)', className: 'bg-red-900/30 text-red-400' },
};

export function Archive() {
  const navigate = useNavigate();
  const location = useLocation();
  const { readings, fetchReadings, profiles } = useSajuStore();

  useEffect(() => {
    fetchReadings();
    const interval = setInterval(fetchReadings, 5000);
    return () => clearInterval(interval);
  }, [fetchReadings, location.key]);

  const getProfileName = (profileId: string) => {
    return profiles.find(p => p.id === profileId)?.name || '알 수 없음';
  };

  // 예상 대기시간 (최근 완료 평균)
  const estimatedWaitSec = (() => {
    const completed = readings.filter(r => r.processing_status === 'completed' && r.processing_duration_ms);
    if (completed.length === 0) return 45;
    const recent = completed.slice(0, 10);
    return Math.round(recent.reduce((s, r) => s + (r.processing_duration_ms || 0), 0) / recent.length / 1000);
  })();

  return (
    <Layout>
      {/* 헤더 */}
      <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-5 gradient-hero rounded-b-3xl">
        <span className="text-3xl">📚</span>
        <h2 className="text-xl font-bold text-dark font-serif mt-1">보관함</h2>
        <p className="text-sm text-warm-gray mt-1">나의 사주풀이 기록</p>
      </div>

      {readings.length === 0 ? (
        <Card className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-brown/5 flex items-center justify-center">
            <Logo size="lg" animate />
          </div>
          <p className="text-warm-gray font-medium">아직 보관된 풀이가 없어요</p>
          <p className="text-warm-gray text-sm mt-1">사주풀이를 받으면 여기에 저장됩니다</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {readings.map(reading => {
            const info = SERVICE_LABELS[reading.service_type] || { label: reading.service_type, emoji: '📄', borderColor: 'border-l-gray-400' };
            const date = new Date(reading.created_at).toLocaleDateString('ko-KR');
            const status = STATUS_BADGE[reading.processing_status] || STATUS_BADGE.completed;
            const isClickable = reading.processing_status === 'completed';

            return (
              <Card
                key={reading.id}
                padding="sm"
                className={`border-l-4 ${info.borderColor} ${isClickable ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : 'opacity-80'} transition-all`}
                onClick={() => isClickable && navigate(`/archive/${reading.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">{info.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-dark text-sm">{info.label}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-warm-gray">
                      {(() => {
                        const names = [getProfileName(reading.profile_id)];
                        if (reading.secondary_profile_id) names.push(getProfileName(reading.secondary_profile_id));
                        // metadata에서 추가 프로필 확인
                        const meta = (reading as any).metadata;
                        if (meta?.allProfileIds) {
                          try {
                            const allIds = JSON.parse(meta.allProfileIds) as string[];
                            allIds.forEach(id => {
                              if (id !== reading.profile_id && id !== reading.secondary_profile_id) {
                                const n = getProfileName(id);
                                if (n !== '?') names.push(n);
                              }
                            });
                          } catch {}
                        }
                        return names.join(' & ');
                      })()} · {date}
                      {reading.processing_duration_ms && reading.processing_status === 'completed' && (
                        <span> · {(reading.processing_duration_ms / 1000).toFixed(0)}초 소요</span>
                      )}
                      {(reading.processing_status === 'pending' || reading.processing_status === 'processing') && (
                        <span> · 예상 약 {estimatedWaitSec}초</span>
                      )}
                    </p>
                  </div>
                  {isClickable && <span className="text-warm-gray-light text-lg">&rsaquo;</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
