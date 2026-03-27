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
      <h3 className="text-sm font-bold text-dark mb-3 flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-full bg-brown/10 flex items-center justify-center text-xs">☯️</span>
        오행 분포
      </h3>
      <div className="space-y-2.5">
        {OHAENG_INFO.map(({ key, label, color, emoji }) => (
          <div key={key} className="flex items-center gap-2">
            <div className="flex items-center gap-1 w-14">
              <span className="text-sm">{emoji}</span>
              <span className="text-xs font-medium text-dark">{label}</span>
            </div>
            <div className="flex-1 h-6 bg-cream-dark rounded-full overflow-hidden">
              {count[key] > 0 && (
                <div
                  className={`h-full ${color} rounded-full transition-all duration-500 flex items-center justify-end pr-1.5`}
                  style={{ width: `${Math.max((count[key] / total) * 100, 8)}%` }}
                >
                  <span className="text-[10px] font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {count[key]}
                  </span>
                </div>
              )}
            </div>
            <span className="text-xs font-bold w-5 text-right text-dark">{count[key]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
