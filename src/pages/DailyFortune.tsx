import { useEffect, useState, useCallback, useRef } from 'react';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { PhotoLoading } from '@/components/ui/PhotoLoading.tsx';
import { Recommendations } from '@/components/saju/Recommendations.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { requestReading, pollReadingStatus } from '@/lib/api.ts';

interface DailyResult {
  summary: string;
  overallLuck: number;
  categories: {
    love: { score: number; message: string };
    money: { score: number; message: string };
    work: { score: number; message: string };
    health: { score: number; message: string };
  };
  advice: string;
  luckyItems: { color: string; number: string; food: string };
}

const SCORE_EMOJIS = ['', '😢', '😐', '🙂', '😊', '🤩'];
const CATEGORY_INFO = [
  { key: 'love' as const, label: '연애', emoji: '💕', bgColor: 'bg-gradient-to-br from-pink-50 to-rose-50', iconBg: 'bg-pink-100 ring-2 ring-pink-200/50' },
  { key: 'money' as const, label: '재물', emoji: '💰', bgColor: 'bg-gradient-to-br from-yellow-50 to-amber-50', iconBg: 'bg-yellow-100 ring-2 ring-yellow-200/50' },
  { key: 'work' as const, label: '직장', emoji: '💼', bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50', iconBg: 'bg-blue-100 ring-2 ring-blue-200/50' },
  { key: 'health' as const, label: '건강', emoji: '🏥', bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50', iconBg: 'bg-green-100 ring-2 ring-green-200/50' },
];

const POLL_INTERVAL = 5000;

export function DailyFortune() {
  const { profiles, selectedProfileIdx, readings, fetchReadings } = useSajuStore();
  const [result, setResult] = useState<DailyResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIdRef = useRef<string | null>(null);

  const profile = profiles[selectedProfileIdx] || profiles[0];

  // 오늘 날짜 문자열 (한국 시간)
  const todayStr = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

  // readings에서 오늘의 daily 결과 찾기
  const findTodayReading = useCallback(() => {
    if (!profile) return null;
    return readings.find(r => {
      if (r.profile_id !== profile.id || r.service_type !== 'daily') return false;
      const createdDate = new Date(r.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
      return createdDate === todayStr;
    });
  }, [readings, profile, todayStr]);

  // 폴링 정리
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // 초기 로드: readings 가져와서 오늘 결과 확인
  useEffect(() => {
    if (!profile?.id) return;
    fetchReadings();
  }, [profile?.id, fetchReadings]);

  // readings 변경 시 오늘 결과 확인
  useEffect(() => {
    const todayReading = findTodayReading();
    if (!todayReading) return;

    if (todayReading.processing_status === 'completed' && todayReading.result) {
      setResult(todayReading.result as unknown as DailyResult);
      setPhase('done');
      stopPolling();
    } else if (todayReading.processing_status === 'pending' || todayReading.processing_status === 'processing') {
      // 이미 요청 중인 게 있으면 폴링 시작
      if (phase !== 'loading') {
        setPhase('loading');
        pendingIdRef.current = todayReading.id;
        startPolling(todayReading.id);
      }
    } else if (todayReading.processing_status === 'failed') {
      setError(todayReading.failure_reason || '운세 생성에 실패했습니다');
      setPhase('idle');
      stopPolling();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings, profile?.id]);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = (readingId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await pollReadingStatus(readingId);
        if (status.status === 'completed' && status.result) {
          setResult(status.result as unknown as DailyResult);
          setPhase('done');
          stopPolling();
          fetchReadings();
        } else if (status.status === 'failed') {
          setError(status.failure_reason || '운세 생성에 실패했습니다');
          setPhase('idle');
          stopPolling();
        }
      } catch {
        // 폴링 실패 시 재시도
      }
    }, POLL_INTERVAL);
  };

  const fetchDaily = async () => {
    if (!profile) return;

    // 이미 오늘 결과가 있으면 스킵
    const todayReading = findTodayReading();
    if (todayReading?.processing_status === 'completed' && todayReading.result) {
      setResult(todayReading.result as unknown as DailyResult);
      setPhase('done');
      return;
    }

    setPhase('loading');
    setError('');

    try {
      const reqResult = await requestReading(profile.id, 'daily');

      // 캐시 히트
      if (reqResult.cached && reqResult.result) {
        setResult(reqResult.result as unknown as DailyResult);
        setPhase('done');
        return;
      }

      // 폴링 시작
      pendingIdRef.current = reqResult.readingId;
      startPolling(reqResult.readingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '운세를 가져올 수 없습니다');
      setPhase('idle');
    }
  };

  // 프로필이 있고 결과가 없으면 자동 요청
  useEffect(() => {
    if (!profile?.id || phase !== 'idle' || result) return;

    // readings 로드 후 오늘 결과가 없으면 자동 요청
    const todayReading = findTodayReading();
    if (todayReading) return; // readings에서 처리됨

    // readings가 로드되었는데 오늘 daily가 없으면 요청
    if (readings.length >= 0) {
      const hasAnyReading = readings.some(r => r.profile_id === profile.id);
      // readings가 빈 배열이거나, 로드되었는데 오늘 daily가 없으면
      if (readings.length === 0 || hasAnyReading || !hasAnyReading) {
        // 잠시 대기 후 요청 (fetchReadings 완료 보장)
        const timer = setTimeout(() => {
          const check = findTodayReading();
          if (!check && phase === 'idle' && !result) {
            fetchDaily();
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, readings, phase, result]);

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <Layout>
      {/* 장식 헤더 */}
      <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-5 gradient-hero rounded-b-3xl">
        <div className="flex justify-center items-center gap-2 mb-2">
          <span className="text-3xl animate-sparkle">🔮</span>
          <span className="text-2xl">✨</span>
        </div>
        <h2 className="text-xl font-bold text-dark font-serif">오늘의 운세</h2>
        <p className="text-sm text-warm-gray mt-1">{today}</p>
      </div>

      {!profile ? (
        <Card className="text-center py-8">
          <p className="text-warm-gray">프로필을 먼저 등록해주세요</p>
        </Card>
      ) : phase === 'loading' ? (
        <PhotoLoading />
      ) : error ? (
        <Card className="text-center">
          <p className="text-red-500 mb-3">{error}</p>
          <Button variant="secondary" onClick={fetchDaily}>다시 시도</Button>
        </Card>
      ) : result ? (
        <div className="space-y-3">
          {/* 총운 */}
          <Card className="text-center">
            <div className="relative w-28 h-28 mx-auto mb-3">
              {/* 색 링 */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(#C67A3C ${result.overallLuck * 20}%, #E8DFD3 ${result.overallLuck * 20}%)`,
                  padding: '4px',
                }}
              >
                <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center">
                  <span className="text-3xl">{SCORE_EMOJIS[result.overallLuck] || '🐕'}</span>
                  <span className="text-2xl font-bold text-brown font-serif mt-0.5">{result.overallLuck}/5</span>
                </div>
              </div>
            </div>
            <p className="font-medium text-dark font-serif text-lg">{result.summary}</p>
            <div className="flex justify-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} className={`text-xl ${n <= result.overallLuck ? '' : 'opacity-20'}`}>⭐</span>
              ))}
            </div>
          </Card>

          {/* 카테고리별 */}
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_INFO.map(cat => {
              const data = result.categories[cat.key];
              return (
                <Card key={cat.key} padding="sm" className={cat.bgColor}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-10 h-10 rounded-full ${cat.iconBg} flex items-center justify-center shadow-sm`}>
                      <span className="text-lg">{cat.emoji}</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-bold text-dark">{cat.label}</span>
                      <div className="flex gap-0.5 mt-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <span key={n} className={`text-[10px] ${n <= data.score ? '' : 'opacity-20'}`}>⭐</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-sm text-brown font-bold">{data.score}/5</span>
                  </div>
                  <p className="text-xs text-dark-light leading-relaxed">{data.message}</p>
                </Card>
              );
            })}
          </div>

          {/* 조언 */}
          <Card>
            <p className="text-sm text-dark-light leading-relaxed">
              🐾 {result.advice}
            </p>
          </Card>

          {/* 행운 아이템 */}
          {result.luckyItems && (
            <Card className="bg-gradient-to-br from-emerald-50/50 to-green-50/30">
              <h3 className="text-sm font-bold text-dark mb-3 text-center flex items-center justify-center gap-1.5">
                <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm">🍀</span>
                행운 아이템
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white/70 rounded-2xl px-3 py-3 shadow-sm border border-green-100/50">
                  <span className="text-lg">🎨</span>
                  <p className="text-warm-gray mt-1 mb-0.5">행운 색</p>
                  <p className="font-bold text-dark">{result.luckyItems.color}</p>
                </div>
                <div className="bg-white/70 rounded-2xl px-3 py-3 shadow-sm border border-green-100/50">
                  <span className="text-lg">🔢</span>
                  <p className="text-warm-gray mt-1 mb-0.5">행운 숫자</p>
                  <p className="font-bold text-dark">{result.luckyItems.number}</p>
                </div>
                <div className="bg-white/70 rounded-2xl px-3 py-3 shadow-sm border border-green-100/50">
                  <span className="text-lg">🍽️</span>
                  <p className="text-warm-gray mt-1 mb-0.5">행운 음식</p>
                  <p className="font-bold text-dark">{result.luckyItems.food}</p>
                </div>
              </div>
            </Card>
          )}

          {/* 공유 버튼 */}
          <div className="text-center">
            <button
              onClick={() => {
                const text = `🐕 오늘의 운세\n\n${result.summary}\n\n연애 ${result.categories.love.score}/5 | 재물 ${result.categories.money.score}/5 | 직장 ${result.categories.work.score}/5 | 건강 ${result.categories.health.score}/5\n\n${result.advice}\n\n👉 나도 보러가기: ${window.location.origin}`;
                navigator.clipboard.writeText(text);
                alert('운세가 복사되었어요! 친구에게 보내보세요 🐾');
              }}
              className="text-sm text-brown font-medium hover:text-brown-dark transition-colors"
            >
              📋 친구에게 공유하기
            </button>
          </div>

          <Recommendations exclude={['daily']} />
        </div>
      ) : null}
    </Layout>
  );
}
