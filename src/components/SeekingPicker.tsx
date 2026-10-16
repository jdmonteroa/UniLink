import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { SEEKING_OPTIONS, type Seeking } from '@/features/auth/authStore';
import { spring } from '@/components/brand';

/**
 * Selector "Quiero conocer: Mujeres · Hombres · Todos".
 * Pensado para ir sobre un fondo de color sticker (tarjeta de modo activo).
 */
export const SeekingPicker: React.FC<{
  value: Seeking;
  onChange: (value: Seeking) => void;
  label: string;
  disabled?: boolean;
}> = ({ value, onChange, label, disabled }) => {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-900/70">Quiero conocer</span>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 p-1 rounded-full bg-white/55">
        {SEEKING_OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`relative h-9 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${
                on ? 'text-slate-50' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {on && <motion.span layoutId={`seeking-${id}`} transition={spring} className="absolute inset-0 rounded-full bg-slate-900" />}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
