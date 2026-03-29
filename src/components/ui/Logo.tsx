interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animate?: boolean;
}

const SIZES = {
  sm: 'w-7 h-7',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
};

export function Logo({ size = 'md', className = '', animate = false }: LogoProps) {
  return (
    <img
      src="/images/logo.png"
      alt="멍도령"
      className={`${SIZES[size]} rounded-full object-cover ${animate ? 'animate-float' : ''} ${className}`}
    />
  );
}
