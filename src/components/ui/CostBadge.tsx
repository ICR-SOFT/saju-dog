interface CostBadgeProps {
  cost: number;
  className?: string;
}

export default function CostBadge({ cost, className = '' }: CostBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        font-pixel text-xs
        px-2 py-0.5
        bg-[var(--gold-light)] text-[var(--gold)]
        border border-[var(--gold)]
        ${className}
      `}
    >
      🦴 {cost}
    </span>
  );
}
