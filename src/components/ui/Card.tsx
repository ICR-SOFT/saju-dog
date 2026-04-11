interface CardProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export default function Card({ className = '', children, onClick }: CardProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={`pixel-card p-4 ${onClick ? 'cursor-pointer w-full text-left' : ''} ${className}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Tag>
  );
}
