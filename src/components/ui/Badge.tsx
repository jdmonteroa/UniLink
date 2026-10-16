import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'study' | 'friendship' | 'dating' | 'success' | 'outline';
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  className,
  children,
}) => {
  const variants = {
    default: 'bg-haze-100 dark:bg-ink-800 text-slate-800 dark:text-slate-200 border-transparent',
    study: 'bg-mint text-slate-900 border-transparent',
    friendship: 'bg-sun text-slate-900 border-transparent',
    dating: 'bg-coral text-slate-900 border-transparent',
    success: 'bg-azure-100 text-azure-800 dark:bg-azure-950/60 dark:text-azure-300 border-transparent',
    outline: 'bg-transparent text-slate-700 dark:text-slate-300 border-slate-900/15 dark:border-white/15',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
