import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.replace(/\s/g, '-').toLowerCase();

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-dark-light">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-xl border border-warm-gray-light/30 bg-cream px-4 py-2.5 text-dark placeholder:text-warm-gray-light outline-none transition-all focus:border-brown focus:ring-2 focus:ring-brown/20 ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
