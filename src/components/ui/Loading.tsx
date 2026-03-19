interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Loading({ message = '잠시만 기다려주세요...', size = 'md' }: LoadingProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-cream-dark border-t-brown`} />
      <p className="text-warm-gray text-sm">{message}</p>
    </div>
  );
}
