'use client';

import { type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'pixel-btn pixel-btn-accent text-white font-bold',
  secondary: 'pixel-btn bg-[var(--bg-primary)] text-[var(--text-primary)]',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors',
  danger: 'pixel-btn bg-[var(--error)] text-white border-[#c62828] shadow-[var(--pixel-size)_var(--pixel-size)_0_#c62828]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2 font-pixel
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${isDisabled ? 'opacity-50 cursor-not-allowed !transform-none !shadow-none' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="pixel-loading" aria-label="로딩 중">
          <span />
          <span />
          <span />
          <span />
        </span>
      ) : (
        children
      )}
    </button>
  );
}
