import { useEffect } from 'react';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { useSajuStore } from '@/stores/saju.ts';

const SERVICE_LABELS: Record<string, { label: string; emoji: string }> = {
  comprehensive: { label: '종합 사주풀이', emoji: '🔮' },
  compatibility: { label: '궁합', emoji: '💕' },
  daily: { label: '오늘의 운세', emoji: '🌅' },
  daeun: { label: '대운 분석', emoji: '🌊' },
  yearly: { label: '연간 운세', emoji: '📅' },
  chat: { label: 'AI 상담', emoji: '💬' },
};

export function Archive() {
  const { readings, fetchReadings, profiles } = useSajuStore();

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const getProfileName = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    return profile?.name || '알 수 없음';
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

            return (
              <Card
                key={reading.id}
                padding="sm"
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  // TODO: 상세 보기 페이지로 이동
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{info.emoji}</span>
                  <div className="flex-1">
                    <p className="font-medium text-dark text-sm">{info.label}</p>
                    <p className="text-xs text-warm-gray">
                      {getProfileName(reading.profile_id)} · {date}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
