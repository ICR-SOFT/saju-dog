import type { OhaengCount } from '@/types/saju.ts';
import { Card } from '../ui/Card.tsx';

const OHAENG_INFO = [
  { key: '목' as const, label: '목', color: '#4ade80', emoji: '🌳' },
  { key: '화' as const, label: '화', color: '#f87171', emoji: '🔥' },
  { key: '토' as const, label: '토', color: '#facc15', emoji: '🏔️' },
  { key: '금' as const, label: '금', color: '#9ca3af', emoji: '⚔️' },
  { key: '수' as const, label: '수', color: '#60a5fa', emoji: '💧' },
];

interface OhaengBarProps {
  count: OhaengCount;
}

export function OhaengBar({ count }: OhaengBarProps) {
  const total = Object.values(count).reduce((a, b) => a + b, 0) || 1;

  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-warm-gray shrink-0">오행</span>
        {/* 가로 스택 바 */}
        <div className="flex-1 h-5 rounded-full overflow-hidden flex bg-cream-dark">
          {OHAENG_INFO.map(({ key, color }) =>
            count[key] > 0 ? (
              <div
                key={key}
                className="h-full flex items-center justify-center transition-all duration-500"
                style={{ width: `${(count[key] / total) * 100}%`, backgroundColor: color }}
              >
                <span className="text-[9px] font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                  {count[key]}
                </span>
              </div>
            ) : null,
          )}
        </div>
        {/* 범례 */}
        <div className="flex gap-1.5 shrink-0">
          {OHAENG_INFO.map(({ key, label, color }) => (
            <span key={key} className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: count[key] > 0 ? color : '#2a2a3a' }} />
              <span className={`text-[9px] ${count[key] > 0 ? 'text-dark' : 'text-warm-gray-light/40'}`}>{label}{count[key]}</span>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
