import type { OhaengCount } from '@/types/saju.ts';
import { Card } from '../ui/Card.tsx';

const OHAENG_INFO = [
  { key: '목' as const, label: '목', color: 'bg-green-400', emoji: '🌳' },
  { key: '화' as const, label: '화', color: 'bg-red-400', emoji: '🔥' },
  { key: '토' as const, label: '토', color: 'bg-yellow-400', emoji: '🏔️' },
  { key: '금' as const, label: '금', color: 'bg-gray-400', emoji: '⚔️' },
  { key: '수' as const, label: '수', color: 'bg-blue-400', emoji: '💧' },
];

interface OhaengBarProps {
  count: OhaengCount;
}

export function OhaengBar({ count }: OhaengBarProps) {
  const total = Object.values(count).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <h3 className="text-sm font-medium text-warm-gray mb-3">오행 분포</h3>
      <div className="space-y-2">
        {OHAENG_INFO.map(({ key, label, color, emoji }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-sm w-6 text-center">{emoji}</span>
            <span className="text-xs w-4 text-warm-gray">{label}</span>
            <div className="flex-1 h-5 bg-cream-dark rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all duration-500`}
                style={{ width: `${(count[key] / total) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium w-4 text-right text-dark">{count[key]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
