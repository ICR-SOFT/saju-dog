import { useState } from 'react';
import { Card } from '../ui/Card.tsx';
import type { SajuPillars } from '@/types/saju.ts';

interface SinsalSummaryProps {
  sajuData: SajuPillars;
}

const PILLAR_LABELS = { year: '년', month: '월', day: '일', hour: '시' } as const;
const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;

export function SinsalSummary({ sajuData }: SinsalSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { sinsal } = sajuData;
  const totalSinsal = sinsal.allSinsal.length;
  const totalGuiin = sinsal.guiin.length;

  // 요약: 주요 신살 3개 + 귀인 수
  const preview = sinsal.allSinsal.slice(0, 3).join(' · ');

  return (
    <Card padding="sm">
      {/* 헤더 (항상 보임) — 클릭으로 토글 */}
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-full bg-brown/10 flex items-center justify-center text-xs shrink-0">⚡</span>
          <span className="text-sm font-medium text-dark">신살 · 관계 · 귀인</span>
          <span className="text-[10px] text-warm-gray shrink-0">
            {totalSinsal}개{totalGuiin > 0 ? ` · 귀인 ${totalGuiin}` : ''}
          </span>
        </div>
        <span className={`text-warm-gray text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* 미리보기 (접힌 상태) */}
      {!isOpen && totalSinsal > 0 && (
        <p className="text-[10px] text-warm-gray-light mt-1.5 truncate">
          {preview}{totalSinsal > 3 ? ` 외 ${totalSinsal - 3}개` : ''}
        </p>
      )}

      {/* 펼친 내용 */}
      {isOpen && (
        <div className="mt-3 space-y-3">
          {/* 기둥별 신살 & 관계 — 가로 컴팩트 */}
          <div className="grid grid-cols-4 gap-1 text-center">
            {PILLAR_KEYS.map(name => {
              const sinsals = sinsal.pillarSinsal[name];
              const relations = sinsal.pillarRelations[name];
              if (sinsals.length === 0 && relations.length === 0) return (
                <div key={name}>
                  <p className="text-[10px] font-medium text-warm-gray mb-1">{PILLAR_LABELS[name]}</p>
                  <span className="text-[10px] text-warm-gray-light">—</span>
                </div>
              );
              return (
                <div key={name} className="space-y-0.5">
                  <p className="text-[10px] font-medium text-warm-gray mb-1">{PILLAR_LABELS[name]}</p>
                  {sinsals.map((s, i) => (
                    <span key={`s-${i}`} className="block text-[9px] bg-amber-900/25 text-amber-300 rounded px-0.5 py-px">{s}</span>
                  ))}
                  {relations.map((r, i) => (
                    <span key={`r-${i}`} className="block text-[9px] bg-blue-900/25 text-blue-300 rounded px-0.5 py-px">{r}</span>
                  ))}
                </div>
              );
            })}
          </div>

          {/* 귀인 + 전체 신살 + 공망 — 한 영역 */}
          <div className="flex flex-wrap gap-1">
            {sinsal.guiin.map((g, i) => (
              <span key={`g-${i}`} className="text-[9px] bg-green-900/25 text-green-300 rounded-full px-1.5 py-0.5">✦ {g}</span>
            ))}
            {sinsal.allSinsal.map((s, i) => (
              <span key={`a-${i}`} className="text-[9px] bg-cream-dark text-warm-gray-light rounded-full px-1.5 py-0.5">{s}</span>
            ))}
            {sinsal.gongmang.length > 0 && (
              <span className="text-[9px] bg-red-900/20 text-red-400 rounded-full px-1.5 py-0.5">
                공망: {sinsal.gongmang.join('·')}
              </span>
            )}
          </div>

          {/* 세운 */}
          <div className="flex items-center justify-between pt-2 border-t border-warm-gray-light/10">
            <span className="text-[10px] text-warm-gray">{sajuData.currentYear.year}년 세운</span>
            <span className="text-sm font-bold text-dark font-serif">
              {sajuData.currentYear.stem}{sajuData.currentYear.branch}
            </span>
            <span className="text-[10px] text-warm-gray">
              {sajuData.currentYear.stemSipsin}/{sajuData.currentYear.branchSipsin}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
