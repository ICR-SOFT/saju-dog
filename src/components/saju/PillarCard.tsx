import type { Pillar } from '@/types/saju.ts';

const OHAENG_COLORS: Record<string, string> = {
  '목': 'bg-green-900/40 text-green-300 border-green-700/50',
  '화': 'bg-red-900/40 text-red-300 border-red-700/50',
  '토': 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  '금': 'bg-gray-700/40 text-gray-300 border-gray-600/50',
  '수': 'bg-blue-900/40 text-blue-300 border-blue-700/50',
};

const TYPE_LABEL: Record<string, string> = {
  '여기': '餘',
  '중기': '中',
  '정기': '正',
};

interface PillarCardProps {
  pillar: Pillar;
  label: string;
  isDay?: boolean;
}

export function PillarCard({ pillar, label, isDay = false }: PillarCardProps) {
  return (
    <div className={`flex flex-col items-center gap-1 ${isDay ? 'ring-2 ring-brown/30 rounded-xl' : ''}`}>
      <span className="text-xs text-warm-gray font-medium">{label}</span>

      {/* 천간 */}
      <div className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center shadow-sm ${OHAENG_COLORS[pillar.stemOhaeng]}`}>
        <span className="text-xl font-bold font-serif">{pillar.stem}</span>
        <span className="text-[10px] opacity-70">{pillar.stemHanja}</span>
      </div>

      {/* 지지 */}
      <div className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center shadow-sm ${OHAENG_COLORS[pillar.branchOhaeng]}`}>
        <span className="text-xl font-bold font-serif">{pillar.branch}</span>
        <span className="text-[10px] opacity-70">{pillar.branchHanja}</span>
      </div>

      {/* 지장간 (여기·중기·정기) — 천간 + 십신 표시 */}
      <div className="flex flex-col items-center gap-0.5 mt-0.5">
        {pillar.jijanggan.map((j, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className={`text-[9px] w-4 text-center ${
              j.type === '정기' ? 'text-brown-light font-bold' : 'text-warm-gray-light'
            }`}>
              {j.stem}
            </span>
            <span className={`text-[8px] ${
              j.type === '정기' ? 'text-brown-light/80' : 'text-warm-gray-light/60'
            }`}>
              {j.sipsin}
            </span>
          </div>
        ))}
      </div>

      {/* 천간십신 */}
      <span className="text-[10px] text-warm-gray mt-0.5">
        {pillar.stemSipsin === '일주' ? '일간' : pillar.stemSipsin}
      </span>

      {/* 12운성 */}
      <span className="text-[10px] text-warm-gray-light">{pillar.twelveStage}</span>
    </div>
  );
}
