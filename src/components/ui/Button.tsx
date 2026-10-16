import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'study' | 'friendship' | 'dating';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none focus:outline-hidden focus:ring-2 focus:ring-offset-2';

  const sizes = {
    sm: 'text-xs px-3.5 py-1.5 rounded-full',
    md: 'text-sm px-5 py-2.5 rounded-full',
    lg: 'text-base px-6 h-14 rounded-full',
    icon: 'p-3 rounded-full aspect-square',
  };

  const variants = {
    primary:
      'bg-brand-600 hover:bg-brand-700 text-white shadow-glow-brand focus:ring-brand-500',
    secondary:
      'bg-haze-100 dark:bg-ink-800 hover:bg-haze-200 dark:hover:bg-ink-700 text-slate-900 dark:text-slate-100 focus:ring-haze-400',
    outline:
      'border-2 border-slate-900/15 dark:border-white/15 hover:border-slate-900 dark:hover:border-white text-slate-900 dark:text-slate-100 focus:ring-brand-500',
    ghost:
      'hover:bg-haze-100 dark:hover:bg-ink-800 text-slate-700 dark:text-slate-300 focus:ring-haze-400',
    study: 'bg-mint text-slate-900 shadow-sticker focus:ring-mode-study',
    friendship: 'bg-sun text-slate-900 shadow-sticker focus:ring-mode-friendship',
    dating: 'bg-coral text-slate-900 shadow-sticker focus:ring-mode-dating',
  };

  return (
    <button
      className={cn(baseStyles, sizes[size], variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
};
