'use client';

interface RecommendationsProps {
  luckyItems: {
    color: string;
    number: string;
    direction: string;
    food: string;
  };
}

const ITEMS = [
  { key: 'color' as const, emoji: '🎨', label: '색상' },
  { key: 'number' as const, emoji: '🔢', label: '숫자' },
  { key: 'direction' as const, emoji: '🧭', label: '방위' },
  { key: 'food' as const, emoji: '🍽️', label: '음식' },
];

export default function Recommendations({ luckyItems }: RecommendationsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ITEMS.map(({ key, emoji, label }) => (
        <div key={key} className="pixel-card p-3 flex flex-col items-center gap-1.5">
          <span className="text-xl">{emoji}</span>
          <span className="font-pixel text-[10px] text-[var(--text-muted)]">{label}</span>
          <span className="text-sm font-medium text-[var(--text-primary)] text-center">
            {luckyItems[key]}
          </span>
        </div>
      ))}
    </div>
  );
}
