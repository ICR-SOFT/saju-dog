interface LoadingProps {
  message?: string;
}

export default function Loading({ message }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="pixel-loading" role="status" aria-label="로딩 중">
        <span />
        <span />
        <span />
        <span />
      </div>
      {message && (
        <p className="font-pixel text-xs text-[var(--text-muted)]">
          {message}
        </p>
      )}
    </div>
  );
}
