import { Card } from '../ui/Card.tsx';
import type { SajuPillars } from '@/types/saju.ts';

interface SinsalSummaryProps {
  sajuData: SajuPillars;
}

const PILLAR_LABELS = { year: '년', month: '월', day: '일', hour: '시' } as const;
const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;

export function SinsalSummary({ sajuData }: SinsalSummaryProps) {
  const { sinsal } = sajuData;

  return (
    <Card padding="sm">
      <h3 className="text-[10px] text-warm-gray mb-2">신살 · 관계 · 귀인</h3>

      {/* 기둥별 — 가로 4열 컴팩트 */}
      <div className="grid grid-cols-4 gap-1 text-center mb-2">
        {PILLAR_KEYS.map(name => {
          const sinsals = sinsal.pillarSinsal[name];
          const relations = sinsal.pillarRelations[name];
          return (
            <div key={name}>
              <p className="text-[9px] text-warm-gray mb-0.5">{PILLAR_LABELS[name]}</p>
              {sinsals.length === 0 && relations.length === 0 && (
                <span className="text-[9px] text-warm-gray-light/40">—</span>
              )}
              {sinsals.map((s, i) => (
                <span key={`s-${i}`} className="block text-[8px] bg-amber-900/20 text-amber-300 rounded px-0.5 py-px mb-px">{s}</span>
              ))}
              {relations.map((r, i) => (
                <span key={`r-${i}`} className="block text-[8px] bg-blue-900/20 text-blue-300 rounded px-0.5 py-px mb-px">{r}</span>
              ))}
            </div>
          );
        })}
      </div>

      {/* 귀인 + 전체 신살 + 공망 — 태그 한 줄 */}
      <div className="flex flex-wrap gap-1">
        {sinsal.guiin.map((g, i) => (
          <span key={`g-${i}`} className="text-[8px] bg-green-900/20 text-green-300 rounded-full px-1.5 py-px">✦{g}</span>
        ))}
        {sinsal.allSinsal.map((s, i) => (
          <span key={`a-${i}`} className="text-[8px] bg-cream-dark text-warm-gray-light rounded-full px-1.5 py-px">{s}</span>
        ))}
        {sinsal.gongmang.length > 0 && (
          <span className="text-[8px] bg-red-900/15 text-red-400 rounded-full px-1.5 py-px">
            공망:{sinsal.gongmang.join('·')}
          </span>
        )}
      </div>

      {/* 세운 */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-warm-gray-light/10">
        <span className="text-[10px] text-warm-gray">{sajuData.currentYear.year}년 세운</span>
        <span className="text-xs font-bold text-dark font-serif">
          {sajuData.currentYear.stem}{sajuData.currentYear.branch}
        </span>
        <span className="text-[10px] text-warm-gray">
          {sajuData.currentYear.stemSipsin}/{sajuData.currentYear.branchSipsin}
        </span>
      </div>
    </Card>
  );
}
