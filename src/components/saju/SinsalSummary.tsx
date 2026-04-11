'use client';

import type { SajuPillars } from '@/types/saju';

interface SinsalSummaryProps {
  sajuData: SajuPillars;
}

const PILLAR_LABELS = { year: '년', month: '월', day: '일', hour: '시' } as const;
const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;

export default function SinsalSummary({ sajuData }: SinsalSummaryProps) {
  const { sinsal } = sajuData;

  return (
    <div className="pixel-card p-3">
      <h3 className="font-pixel text-[10px] text-[var(--text-muted)] mb-2">신살 / 관계 / 귀인</h3>

      <div className="grid grid-cols-4 gap-1 text-center mb-2">
        {PILLAR_KEYS.map(name => {
          const sinsals = sinsal.pillarSinsal[name];
          const relations = sinsal.pillarRelations[name];
          return (
            <div key={name}>
              <p className="font-pixel text-[9px] text-[var(--text-muted)] mb-0.5">{PILLAR_LABELS[name]}</p>
              {sinsals.length === 0 && relations.length === 0 && (
                <span className="text-[9px] text-[var(--text-muted)]">—</span>
              )}
              {sinsals.map((s, i) => (
                <span key={`s-${i}`} className="block text-[8px] bg-[var(--gold-light)] text-[var(--accent)] px-0.5 py-px mb-px">{s}</span>
              ))}
              {relations.map((r, i) => (
                <span key={`r-${i}`} className="block text-[8px] bg-[#E3F2FD] text-[var(--water)] px-0.5 py-px mb-px">{r}</span>
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1">
        {sinsal.guiin.map((g, i) => (
          <span key={`g-${i}`} className="text-[8px] bg-[#E8F5E9] text-[var(--wood)] px-1.5 py-px">*{g}</span>
        ))}
        {sinsal.allSinsal.map((s, i) => (
          <span key={`a-${i}`} className="text-[8px] bg-[var(--bg-secondary)] text-[var(--text-muted)] px-1.5 py-px">{s}</span>
        ))}
        {sinsal.gongmang.length > 0 && (
          <span className="text-[8px] bg-[#FFEBEE] text-[var(--fire)] px-1.5 py-px">
            공망:{sinsal.gongmang.join('·')}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 pt-1.5 border-t-2 border-[var(--pixel-shadow)]">
        <span className="text-[10px] text-[var(--text-muted)]">{sajuData.currentYear.year}년 세운</span>
        <span className="text-xs font-bold text-[var(--text-primary)]">
          {sajuData.currentYear.stem}{sajuData.currentYear.branch}
        </span>
        <span className="text-[10px] text-[var(--text-muted)]">
          {sajuData.currentYear.stemSipsin}/{sajuData.currentYear.branchSipsin}
        </span>
      </div>
    </div>
  );
}
