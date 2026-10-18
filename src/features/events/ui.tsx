import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { eventCategoryLabel, type EventCategory } from '@/features/events/eventsStore';

/** Estilos compartidos por las pantallas de eventos y moderación. */
export const inputCls =
  'w-full px-4 py-3 rounded-lg bg-white/70 dark:bg-white/[0.04] border-2 border-slate-900/10 dark:border-white/10 text-base text-slate-900 dark:text-slate-50 outline-none transition-colors focus:border-slate-900 dark:focus:border-slate-50 placeholder:text-slate-500 dark:placeholder:text-haze-400';
export const labelCls = 'block mb-1.5 text-sm font-semibold';
export const card = 'rounded-3xl bg-white dark:bg-ink-850 p-5 shadow-soft-sm space-y-4';
export const primaryBtn =
  'inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none';
export const outlineBtn =
  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full border-2 border-slate-900/15 dark:border-white/15 hover:border-slate-900 dark:hover:border-white text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none';
export const iconBtn =
  'w-9 h-9 flex items-center justify-center rounded-full text-slate-600 dark:text-haze-300 hover:bg-haze-100 dark:hover:bg-ink-800 hover:text-slate-900 dark:hover:text-slate-50 transition';
export const chip = (on: boolean) =>
  `px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
    on
      ? 'bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900'
      : 'bg-haze-100 dark:bg-ink-800 text-slate-700 dark:text-haze-300 hover:bg-haze-200 dark:hover:bg-ink-700'
  }`;

const CATEGORY_BG: Record<EventCategory, string> = {
  mercadito: 'bg-sun',
  reunion: 'bg-mint',
  academico: 'bg-mint',
  cultural: 'bg-coral',
  deportivo: 'bg-sun',
  aviso: 'bg-coral',
  otro: 'bg-haze-200 dark:bg-ink-700 dark:text-slate-100',
};

export const CategoryBadge: React.FC<{ category: EventCategory }> = ({ category }) => (
  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-900 ${CATEGORY_BG[category]}`}>
    {eventCategoryLabel(category)}
  </span>
);

/** Imagen del evento, o un cuadro de color con la inicial si no tiene. */
export const EventThumb: React.FC<{ title: string; category: EventCategory; imageUrl: string; className?: string }> = ({
  title,
  category,
  imageUrl,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);
  if (imageUrl && !failed) {
    return <img src={imageUrl} alt="" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center font-serif font-semibold text-slate-900 ${CATEGORY_BG[category]} ${className}`} aria-hidden>
      <span className="text-[1.6em]">{title.trim()[0]?.toUpperCase() || '?'}</span>
    </div>
  );
};

export const formatWhen = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

export type Notice = { kind: 'error' | 'ok'; text: string } | null;

export const NoticeBanner: React.FC<{ notice: Notice }> = ({ notice }) => (
  <AnimatePresence>
    {notice && (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        role="status"
        className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
          notice.kind === 'error'
            ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
            : 'bg-mint/40 dark:bg-mint/10 text-azure-900 dark:text-azure-200'
        }`}
      >
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{notice.text}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

export const useNotice = () => {
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
};

export const Spinner: React.FC = () => (
  <div className="flex justify-center py-12" role="status" aria-label="Cargando">
    <div className="flex gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full bg-mint animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2.5 h-2.5 rounded-full bg-sun animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2.5 h-2.5 rounded-full bg-coral animate-bounce" />
    </div>
  </div>
);
