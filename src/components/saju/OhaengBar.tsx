'use client';

import type { OhaengCount, Ohaeng } from '@/types/saju';

interface OhaengBarProps {
  ohaengCount: OhaengCount;
}

const ELEMENTS: Array<{ key: Ohaeng; label: string; color: string }> = [
  { key: '목', label: '목', color: 'var(--wood)' },
  { key: '화', label: '화', color: 'var(--fire)' },
  { key: '토', label: '토', color: 'var(--earth)' },
  { key: '금', label: '금', color: 'var(--metal)' },
  { key: '수', label: '수', color: 'var(--water)' },
];

export default function OhaengBar({ ohaengCount }: OhaengBarProps) {
  const total = Object.values(ohaengCount).reduce((sum, v) => sum + v, 0) || 1;

  return (
    <div className="flex flex-col gap-2">
      {/* Bar */}
      <div className="ohaeng-bar">
        {ELEMENTS.map(({ key, color }) => {
          const count = ohaengCount[key];
          if (count === 0) return null;
          const widthPercent = (count / total) * 100;
          return (
            <div
              key={key}
              style={{ width: `${widthPercent}%`, backgroundColor: color }}
              className="h-full transition-all duration-300"
              title={`${key}: ${count}`}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-between px-1">
        {ELEMENTS.map(({ key, label, color }) => (
          <div key={key} className="flex flex-col items-center gap-0.5">
            <span
              className="font-pixel text-[10px]"
              style={{ color }}
            >
              {label}
            </span>
            <span className="font-pixel text-[10px] text-[var(--text-muted)]">
              {ohaengCount[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
