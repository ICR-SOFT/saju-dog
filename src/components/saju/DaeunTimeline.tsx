import type { DaeunEntry } from '@/types/saju.ts';
import { Card } from '../ui/Card.tsx';

interface DaeunTimelineProps {
  daeun: DaeunEntry[];
}

export function DaeunTimeline({ daeun }: DaeunTimelineProps) {
  return (
    <Card>
      <h3 className="text-sm font-bold text-dark mb-3 flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-full bg-brown/10 flex items-center justify-center text-xs">🌊</span>
        대운 흐름
      </h3>
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {daeun.map((d, i) => (
          <div
            key={i}
            className={`flex-shrink-0 w-16 rounded-xl p-2 text-center transition-all ${
              d.isCurrent
                ? 'ring-2 ring-brown/50 shadow-md'
                : 'bg-cream-dark'
            }`}
            style={d.isCurrent ? {
              background: 'linear-gradient(135deg, #D4A84325 0%, #E8C46920 100%)',
            } : undefined}
          >
            <p className="text-[10px] text-warm-gray">{d.startAge}~{d.endAge}세</p>
            <p className={`text-base font-bold font-serif ${d.isCurrent ? 'text-brown' : 'text-dark'}`}>
              {d.stem}{d.branch}
            </p>
            <p className="text-[10px] text-warm-gray">{d.stemSipsin}</p>
            {d.isCurrent && (
              <p className="text-[9px] text-white bg-brown rounded-full px-2 py-0.5 mt-1 font-medium">현재</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
