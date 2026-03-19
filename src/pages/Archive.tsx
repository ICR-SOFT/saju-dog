import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { useSajuStore } from '@/stores/saju.ts';

const SERVICE_LABELS: Record<string, { label: string; emoji: string }> = {
  comprehensive: { label: '종합 사주풀이', emoji: '🔮' },
  compatibility: { label: '궁합', emoji: '💕' },
  daily: { label: '오늘의 운세', emoji: '🌅' },
  daeun: { label: '대운 분석', emoji: '🌊' },
  yearly: { label: '연간 운세', emoji: '📅' },
  chat: { label: '복돌이 상담', emoji: '💬' },
  business: { label: '동업 궁합', emoji: '🤝' },
  luckyday: { label: '택일/길일', emoji: '🗓️' },
  love: { label: '연애 시기', emoji: '💘' },
  wealth: { label: '재물운', emoji: '💎' },
  health: { label: '건강운', emoji: '🏥' },
  career: { label: '직업 적성', emoji: '🎯' },
  pastlife: { label: '전생 이야기', emoji: '🔮' },
  moving: { label: '이사운', emoji: '🏠' },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  completed: { label: '완료', className: 'bg-green-100 text-green-700' },
  pending: { label: '대기 중', className: 'bg-yellow-100 text-yellow-700 animate-pulse' },
  processing: { label: '풀이 중...', className: 'bg-blue-100 text-blue-700 animate-pulse' },
  failed: { label: '실패 (환불됨)', className: 'bg-red-100 text-red-600' },
};

export function Archive() {
  const navigate = useNavigate();
  const { readings, fetchReadings, profiles } = useSajuStore();

  useEffect(() => {
    fetchReadings();
    // 풀이 중인 게 있으면 5초마다 갱신
    const interval = setInterval(fetchReadings, 5000);
    return () => clearInterval(interval);
  }, [fetchReadings]);

  const getProfileName = (profileId: string) => {
    return profiles.find(p => p.id === profileId)?.name || '알 수 없음';
  };

  return (
    <Layout>
      <h2 className="text-xl font-bold text-dark mb-4 font-serif">보관함</h2>

      {readings.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-warm-gray">아직 보관된 풀이가 없어요</p>
          <p className="text-warm-gray text-sm mt-1">사주풀이를 받으면 여기에 저장됩니다</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {readings.map(reading => {
            const info = SERVICE_LABELS[reading.service_type] || { label: reading.service_type, emoji: '📄' };
            const date = new Date(reading.created_at).toLocaleDateString('ko-KR');
            const status = STATUS_BADGE[reading.processing_status] || STATUS_BADGE.completed;
            const isClickable = reading.processing_status === 'completed';

            return (
              <Card
                key={reading.id}
                padding="sm"
                className={`${isClickable ? 'cursor-pointer hover:shadow-md' : 'opacity-80'} transition-all`}
                onClick={() => isClickable && navigate(`/archive/${reading.id}`)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{info.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-dark text-sm">{info.label}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-warm-gray">
                      {getProfileName(reading.profile_id)} · {date}
                      {reading.processing_duration_ms && reading.processing_status === 'completed' && (
                        <span> · {(reading.processing_duration_ms / 1000).toFixed(0)}초</span>
                      )}
                    </p>
                  </div>
                  {isClickable && <span className="text-warm-gray-light">&rsaquo;</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
