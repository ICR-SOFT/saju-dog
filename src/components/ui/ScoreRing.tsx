interface ScoreRingProps {
  score: number;
  maxScore?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  label?: string;
}

export function ScoreRing({ score, maxScore = 100, size = 'md', color = '#ec4899', label = '점' }: ScoreRingProps) {
  const sizes = { sm: 'w-20 h-20', md: 'w-28 h-28', lg: 'w-36 h-36' };
  const textSizes = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-5xl' };
  const pct = (score / maxScore) * 100;

  return (
    <div className={`relative ${sizes[size]} mx-auto`}>
      <div className="absolute inset-0 rounded-full" style={{
        background: `conic-gradient(${color} ${pct}%, #E8DFD3 ${pct}%)`,
        padding: '4px',
      }}>
        <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center">
          <span className={`${textSizes[size]} font-bold text-dark font-serif`}>{score}</span>
          <span className="text-xs text-warm-gray">{label}</span>
        </div>
      </div>
    </div>
  );
}
