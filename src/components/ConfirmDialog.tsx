import React, { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, HeartCrack, UserX, Info } from 'lucide-react';
import { spring } from '@/components/brand';

/**
 * Diálogo de confirmación con el diseño de UniLink (reemplaza a confirm() / alert()).
 *
 * Uso:
 *   const ok = await confirmDialog({ title: '¿Bloquear?', message: '...', confirmLabel: 'Bloquear', tone: 'danger' });
 *   if (!ok) return;
 *
 * Para un aviso con un solo botón: await confirmDialog({ ..., cancelLabel: null }).
 * <ConfirmDialogHost /> debe estar montado una vez (ver App.tsx).
 */

type Tone = 'danger' | 'warning' | 'info';
type IconName = 'alert' | 'heart-crack' | 'user-x' | 'info';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  /** null = sin botón de cancelar (aviso simple). */
  cancelLabel?: string | null;
  tone?: Tone;
  icon?: IconName;
}

interface DialogState {
  current: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  open: (opts: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
}

const useDialogStore = create<DialogState>((set, get) => ({
  current: null,
  open: (opts) =>
    new Promise<boolean>((resolve) => {
      get().current?.resolve(false); // si había otro abierto, se cancela
      set({ current: { ...opts, resolve } });
    }),
  close: (ok) => {
    const cur = get().current;
    if (!cur) return;
    cur.resolve(ok);
    set({ current: null });
  },
}));

export const confirmDialog = (opts: ConfirmOptions) => useDialogStore.getState().open(opts);

const ICONS: Record<IconName, typeof AlertTriangle> = {
  alert: AlertTriangle,
  'heart-crack': HeartCrack,
  'user-x': UserX,
  info: Info,
};

const TONE_STICKER: Record<Tone, string> = {
  danger: 'bg-coral',
  warning: 'bg-sun',
  info: 'bg-mint',
};

export const ConfirmDialogHost: React.FC = () => {
  const current = useDialogStore((s) => s.current);
  const close = useDialogStore((s) => s.close);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape cancela; Tab se queda dentro del diálogo
  useEffect(() => {
    if (!current) return;
    const previous = document.activeElement as HTMLElement | null;
    // En acciones destructivas el foco inicial va a "Cancelar"
    (current.tone === 'danger' && cancelRef.current ? cancelRef.current : confirmRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Tab' && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>('button');
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [current, close]);

  const tone = current?.tone ?? 'info';
  const Icon = ICONS[current?.icon ?? (tone === 'info' ? 'info' : 'alert')];
  const cancelLabel = current?.cancelLabel === undefined ? 'Cancelar' : current.cancelLabel;

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={() => close(false)}
        >
          <motion.div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={current.message ? 'confirm-message' : undefined}
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.98 }}
            transition={spring}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-haze-50 dark:bg-ink-900 dark:ring-1 dark:ring-white/10 text-slate-900 dark:text-slate-50 p-6 shadow-soft-lg"
          >
            <motion.span
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: -6 }}
              transition={{ type: 'spring', stiffness: 450, damping: 16, delay: 0.05 }}
              className={`w-14 h-14 rounded-full ${TONE_STICKER[tone]} text-slate-900 flex items-center justify-center shadow-sticker`}
              aria-hidden
            >
              <Icon className="w-6 h-6" />
            </motion.span>

            <h2 id="confirm-title" className="mt-5 text-2xl font-semibold leading-tight">
              {current.title}
            </h2>
            {current.message && (
              <p id="confirm-message" className="mt-2 text-base text-slate-600 dark:text-haze-300 leading-relaxed">
                {current.message}
              </p>
            )}

            <div className={`mt-6 grid gap-2 ${cancelLabel ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {cancelLabel && (
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => close(false)}
                  className="h-12 rounded-full text-sm font-semibold border-2 border-slate-900/10 dark:border-white/10 hover:border-slate-900 dark:hover:border-slate-50 transition-colors"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                ref={confirmRef}
                type="button"
                onClick={() => close(true)}
                className={`h-12 rounded-full text-sm font-semibold transition hover:-translate-y-0.5 active:scale-[0.97] ${
                  tone === 'info'
                    ? 'bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900'
                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-glow-brand'
                }`}
              >
                {current.confirmLabel ?? 'Aceptar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
