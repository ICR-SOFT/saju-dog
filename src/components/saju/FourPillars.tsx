import type { SajuPillars } from '@/types/saju.ts';
import { PillarCard } from './PillarCard.tsx';
import { Card } from '../ui/Card.tsx';

interface FourPillarsProps {
  data: SajuPillars;
}

export function FourPillars({ data }: FourPillarsProps) {
  const { pillars } = data;

  return (
    <Card padding="sm" className="bg-gradient-to-br from-cream-dark to-cream/30">
      <h3 className="text-[10px] text-warm-gray mb-2 text-center">사주팔자</h3>
      <div className="flex gap-1.5">
        <PillarCard pillar={pillars.hour} label="시주" />
        <PillarCard pillar={pillars.day} label="일주" isDay />
        <PillarCard pillar={pillars.month} label="월주" />
        <PillarCard pillar={pillars.year} label="년주" />
      </div>
    </Card>
  );
}
