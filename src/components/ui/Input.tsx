'use client';

import { type InputHTMLAttributes, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = '', id: externalId, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = externalId ?? generatedId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="font-pixel text-xs text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3 py-2.5 text-sm
          bg-[var(--bg-primary)] text-[var(--text-primary)]
          border-2 border-[var(--pixel-border)]
          shadow-[2px_2px_0_var(--pixel-shadow)]
          outline-none
          placeholder:text-[var(--text-muted)]
          focus:border-[var(--accent)] focus:shadow-[2px_2px_0_var(--accent-light)]
          transition-colors
          ${error ? 'border-[var(--error)] shadow-[2px_2px_0_var(--error)]' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="font-pixel text-[10px] text-[var(--error)] mt-0.5">
          {error}
        </p>
      )}
    </div>
  );
}
