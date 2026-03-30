import type { Pillar } from '@/types/saju.ts';

const OHAENG_COLORS: Record<string, string> = {
  '목': 'bg-green-900/40 text-green-300 border-green-700/50',
  '화': 'bg-red-900/40 text-red-300 border-red-700/50',
  '토': 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  '금': 'bg-gray-700/40 text-gray-300 border-gray-600/50',
  '수': 'bg-blue-900/40 text-blue-300 border-blue-700/50',
};

interface PillarCardProps {
  pillar: Pillar;
  label: string;
  isDay?: boolean;
}

export function PillarCard({ pillar, label, isDay = false }: PillarCardProps) {
  return (
    <div className={`flex flex-col items-center gap-0.5 ${isDay ? 'ring-2 ring-brown/30 rounded-xl p-0.5' : ''}`}>
      <span className="text-[10px] text-warm-gray font-medium">{label}</span>

      {/* 천간 */}
      <div className={`w-14 h-12 rounded-lg border flex flex-col items-center justify-center ${OHAENG_COLORS[pillar.stemOhaeng]}`}>
        <span className="text-lg font-bold font-serif leading-none">{pillar.stem}</span>
        <span className="text-[8px] opacity-60">{pillar.stemHanja}</span>
      </div>

      {/* 지지 */}
      <div className={`w-14 h-12 rounded-lg border flex flex-col items-center justify-center ${OHAENG_COLORS[pillar.branchOhaeng]}`}>
        <span className="text-lg font-bold font-serif leading-none">{pillar.branch}</span>
        <span className="text-[8px] opacity-60">{pillar.branchHanja}</span>
      </div>

      {/* 지장간 — 가로 컴팩트 */}
      <div className="flex gap-px">
        {pillar.jijanggan.map((j, i) => (
          <span
            key={i}
            className={`text-[8px] px-1 rounded ${
              j.type === '정기' ? 'text-brown-light font-bold bg-brown/10' : 'text-warm-gray-light'
            }`}
            title={`${j.type}: ${j.stem}(${j.sipsin})`}
          >
            {j.stem}
          </span>
        ))}
      </div>

      {/* 천간십신 + 12운성 */}
      <span className="text-[9px] text-warm-gray">
        {pillar.stemSipsin === '일주' ? '일간' : pillar.stemSipsin}
      </span>
      <span className="text-[8px] text-warm-gray-light">{pillar.twelveStage}</span>
    </div>
  );
}
