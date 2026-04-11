'use client';

import type { Pillar, Ohaeng } from '@/types/saju';

interface FourPillarsProps {
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar;
  };
}

const PILLAR_LABELS = ['시주', '일주', '월주', '연주'] as const;
const PILLAR_KEYS: Array<'hour' | 'day' | 'month' | 'year'> = ['hour', 'day', 'month', 'year'];

const ohaengColor: Record<Ohaeng, string> = {
  목: 'text-[var(--wood)]',
  화: 'text-[var(--fire)]',
  토: 'text-[var(--earth)]',
  금: 'text-[var(--metal)]',
  수: 'text-[var(--water)]',
};

const ohaengBg: Record<Ohaeng, string> = {
  목: 'bg-[#E8F5E9]',
  화: 'bg-[#FFEBEE]',
  토: 'bg-[#FFF8E1]',
  금: 'bg-[#F5F5F5]',
  수: 'bg-[#E3F2FD]',
};

export default function FourPillars({ pillars }: FourPillarsProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PILLAR_KEYS.map((key, i) => {
        const pillar = pillars[key];
        return (
          <div
            key={key}
            className={`pillar-card ${ohaengBg[pillar.stemOhaeng]}`}
          >
            <div className="pillar-label">{PILLAR_LABELS[i]}</div>
            <div className={`pillar-stem ${ohaengColor[pillar.stemOhaeng]}`}>
              {pillar.stem}
            </div>
            <div className={`pillar-branch ${ohaengColor[pillar.branchOhaeng]}`}>
              {pillar.branch}
            </div>
            <div className="font-pixel text-[8px] text-[var(--text-muted)] mt-1">
              {pillar.stemOhaeng}/{pillar.branchOhaeng}
            </div>
          </div>
        );
      })}
    </div>
  );
}
