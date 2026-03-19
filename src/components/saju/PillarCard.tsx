import type { Pillar } from '@/types/saju.ts';

const OHAENG_COLORS: Record<string, string> = {
  '목': 'bg-green-100 text-green-700 border-green-300',
  '화': 'bg-red-100 text-red-700 border-red-300',
  '토': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  '금': 'bg-gray-100 text-gray-700 border-gray-300',
  '수': 'bg-blue-100 text-blue-700 border-blue-300',
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
      <div className={`w-14 h-14 rounded-lg border flex flex-col items-center justify-center ${OHAENG_COLORS[pillar.stemOhaeng]}`}>
        <span className="text-xl font-bold font-serif">{pillar.stem}</span>
        <span className="text-[10px] opacity-70">{pillar.stemHanja}</span>
      </div>

      {/* 지지 */}
      <div className={`w-14 h-14 rounded-lg border flex flex-col items-center justify-center ${OHAENG_COLORS[pillar.branchOhaeng]}`}>
        <span className="text-xl font-bold font-serif">{pillar.branch}</span>
        <span className="text-[10px] opacity-70">{pillar.branchHanja}</span>
      </div>

      {/* 천간십신 */}
      <span className="text-[10px] text-warm-gray">
        {pillar.stemSipsin === '일주' ? '일간' : pillar.stemSipsin}
      </span>

      {/* 지지십신 */}
      <span className="text-[10px] text-warm-gray-light">
        {pillar.branchSipsin}
      </span>

      {/* 12운성 */}
      <span className="text-[10px] text-warm-gray-light">{pillar.twelveStage}</span>
    </div>
  );
}
