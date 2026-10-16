import React, { useState } from 'react';

/** Colores sticker para las iniciales; cada nombre siempre obtiene el mismo. */
const FALLBACK_BG = ['bg-sun', 'bg-mint', 'bg-coral'];
const colorFor = (name: string) => FALLBACK_BG[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % FALLBACK_BG.length];

/** Foto redonda con respaldo de iniciales si no hay foto o no carga. */
export const Avatar: React.FC<{ src?: string; name: string; className?: string }> = ({ src, name, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  if (!src || failed) {
    return (
      <div
        className={`rounded-full ${colorFor(name)} text-slate-900 font-serif font-semibold flex items-center justify-center shrink-0 aspect-square ${className}`}
        aria-label={name}
      >
        <span className="text-[0.9em]">{initials || '?'}</span>
      </div>
    );
  }
  return <img src={src} alt={name} onError={() => setFailed(true)} className={`block rounded-full object-cover object-center aspect-square max-w-none shrink-0 ${className}`} />;
};
