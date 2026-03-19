import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { Loading } from '@/components/ui/Loading.tsx';
import { Recommendations } from '@/components/saju/Recommendations.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { getDailyFortune } from '@/lib/api.ts';

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

export function DailyFortune() {
  const { profiles } = useSajuStore();
  const [result, setResult] = useState<DailyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const profile = profiles[0];

  useEffect(() => {
    if (profile?.id) {
      fetchDaily();
    }
  }, [profile?.id]);

  const fetchDaily = async () => {
    if (!profile) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await getDailyFortune({ profileId: profile.id });
      setResult(data as unknown as DailyResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '운세를 가져올 수 없습니다');
    } finally {
      setIsLoading(false);
    }
  };

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
      ) : isLoading ? (
        <Loading message="복돌이가 오늘의 운세를 보고 있어요..." />
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
