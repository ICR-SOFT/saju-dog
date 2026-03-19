import type { SajuPillars } from '@/types/saju.ts';
import { PillarCard } from './PillarCard.tsx';
import { Card } from '../ui/Card.tsx';

interface FourPillarsProps {
  data: SajuPillars;
}

export function FourPillars({ data }: FourPillarsProps) {
  const { pillars } = data;

  return (
    <Card className="bg-gradient-to-br from-white to-cream-dark/30">
      <h3 className="text-sm font-bold text-dark mb-3 text-center flex items-center justify-center gap-1.5">
        <span className="w-6 h-6 rounded-full bg-brown/10 flex items-center justify-center text-xs">🏛️</span>
        사주팔자
      </h3>
      <div className="flex justify-center gap-3">
        <PillarCard pillar={pillars.hour} label="시주" />
        <PillarCard pillar={pillars.day} label="일주" isDay />
        <PillarCard pillar={pillars.month} label="월주" />
        <PillarCard pillar={pillars.year} label="년주" />
      </div>
    </Card>
  );
}
