import type { DaeunEntry } from '@/types/saju.ts';
import { Card } from '../ui/Card.tsx';

interface DaeunTimelineProps {
  daeun: DaeunEntry[];
}

export function DaeunTimeline({ daeun }: DaeunTimelineProps) {
  return (
    <Card>
      <h3 className="text-sm font-medium text-warm-gray mb-3">대운 흐름</h3>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {daeun.map((d, i) => (
          <div
            key={i}
            className={`flex-shrink-0 w-16 rounded-lg p-2 text-center transition-all ${
              d.isCurrent
                ? 'bg-brown/10 ring-2 ring-brown/40'
                : 'bg-cream-dark'
            }`}
          >
            <p className="text-[10px] text-warm-gray">{d.startAge}~{d.endAge}세</p>
            <p className="text-base font-bold font-serif text-dark">
              {d.stem}{d.branch}
            </p>
            <p className="text-[10px] text-warm-gray">{d.stemSipsin}</p>
            {d.isCurrent && (
              <p className="text-[9px] text-brown font-medium mt-0.5">현재</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
