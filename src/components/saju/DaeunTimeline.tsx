import type { DaeunEntry } from '@/types/saju.ts';
import { Card } from '../ui/Card.tsx';

interface DaeunTimelineProps {
  daeun: DaeunEntry[];
}

export function DaeunTimeline({ daeun }: DaeunTimelineProps) {
  return (
    <Card padding="sm">
      <h3 className="text-[10px] text-warm-gray mb-2">대운 흐름</h3>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1">
          {daeun.map((d, i) => (
            <div
              key={i}
              className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-center border-2 ${
                d.isCurrent
                  ? 'bg-brown/15 border-brown/50'
                  : 'bg-cream-dark border-transparent'
              }`}
              style={{ minWidth: '3.4rem' }}
            >
              <p className="text-[8px] text-warm-gray-light">{d.startAge}~{d.endAge}</p>
              <p className={`text-sm font-bold font-serif leading-tight ${d.isCurrent ? 'text-brown' : 'text-dark'}`}>
                {d.stem}{d.branch}
              </p>
              <p className="text-[8px] text-warm-gray-light">{d.stemSipsin}</p>
              {d.isCurrent && (
                <p className="text-[7px] text-brown font-medium mt-0.5">현재</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
