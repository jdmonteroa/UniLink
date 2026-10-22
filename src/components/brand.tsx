import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ConnectionMode } from '@/features/theme/themeStore';

/** Colores "sticker" de la identidad (ver src/styles/index.css). */
export const STICKER = {
  crimson: '#A30021',
  sun: '#FFC93C',
  mint: '#8FE3C0',
  coral: '#FF9DB0',
} as const;

/** Color de cada modo de conexión. */
export const MODE_COLOR: Record<ConnectionMode, string> = {
  friendship: STICKER.sun,
  dating: STICKER.coral,
};

export const CONFETTI_COLORS = [STICKER.crimson, STICKER.sun, STICKER.mint, STICKER.coral];

/** Resorte compartido por las microinteracciones. */
export const spring = { type: 'spring', stiffness: 380, damping: 26 } as const;

/** Logotipo: "uni" + "link" en itálica carmesí + punto girasol. */
export const Wordmark: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn('font-serif font-semibold leading-none tracking-tight', className)}>
    uni<span className="italic text-brand-600 dark:text-brand-400">link</span>
    <span className="inline-block w-[0.28em] h-[0.28em] ml-[0.06em] rounded-full bg-sun" aria-hidden />
  </span>
);

/** Subrayado a mano alzada que se dibuja bajo una palabra destacada. */
export const Squiggle: React.FC<{ className?: string; delay?: number }> = ({ className, delay = 0.25 }) => {
  const reduceMotion = useReducedMotion();
  return (
    <svg
      viewBox="0 0 200 14"
      preserveAspectRatio="none"
      className={cn('absolute left-0 -bottom-[0.1em] w-full h-[0.22em] text-sun pointer-events-none', className)}
      aria-hidden
    >
      <motion.path
        d="M2 9 C 30 2, 50 13, 80 7 S 130 2, 160 8 S 190 10, 198 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
};

/** Palabra destacada: itálica carmesí con subrayado girasol. */
export const Highlight: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay }) => (
  <span className="relative inline-block italic text-brand-600 dark:text-brand-400">
    {children}
    <Squiggle delay={delay} />
  </span>
);
