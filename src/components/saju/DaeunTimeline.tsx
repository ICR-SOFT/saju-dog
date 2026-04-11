'use client';

import type { DaeunEntry } from '@/types/saju';

interface DaeunTimelineProps {
  daeun: DaeunEntry[];
}

export default function DaeunTimeline({ daeun }: DaeunTimelineProps) {
  return (
    <div className="pixel-card p-3">
      <h3 className="font-pixel text-[10px] text-[var(--text-muted)] mb-2">대운 흐름</h3>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1">
          {daeun.map((d, i) => (
            <div
              key={i}
              className={`flex-shrink-0 text-center px-2.5 py-1.5 border-2 ${
                d.isCurrent
                  ? 'bg-[var(--accent-light)] border-[var(--accent)]'
                  : 'bg-[var(--bg-secondary)] border-transparent'
              }`}
              style={{ minWidth: '3.4rem' }}
            >
              <p className="text-[8px] text-[var(--text-muted)]">{d.startAge}~{d.endAge}</p>
              <p className={`text-sm font-bold leading-tight ${d.isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                {d.stem}{d.branch}
              </p>
              <p className="text-[8px] text-[var(--text-muted)]">{d.stemSipsin}</p>
              {d.isCurrent && (
                <p className="font-pixel text-[7px] text-[var(--accent)] mt-0.5">현재</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
