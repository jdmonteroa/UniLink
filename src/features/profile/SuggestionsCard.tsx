import React, { useEffect, useState } from 'react';
import { Lightbulb, Loader2, Send } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { useAuthStore } from '@/features/auth/authStore';
import { NoticeBanner, card, inputCls, primaryBtn, useNotice } from '@/features/events/ui';

export const SUGGESTION_MIN = 10;
export const SUGGESTION_MAX = 1000;

// Modo demo: una sugerencia por sesión (el límite semanal real lo aplica la base de datos)
let demoNextAt: string | null = null;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

/** Perfil → Sugerencias: cada persona puede mandar una por semana; las leen los administradores. */
export const SuggestionsCard: React.FC = () => {
  const isDemo = useAuthStore((s) => s.isDemo);
  const [text, setText] = useState('');
  const [nextAt, setNextAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useNotice();

  useEffect(() => {
    if (isDemo) {
      setNextAt(demoNextAt);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.rpc('get_next_suggestion_at');
      if (!cancelled) setNextAt((data as string | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  const locked = nextAt !== null && new Date(nextAt).getTime() > Date.now();
  const tooShort = text.trim().length < SUGGESTION_MIN;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || locked || tooShort) return;
    setBusy(true);
    let next: string | null = null;
    if (isDemo) {
      next = new Date(Date.now() + 7 * 86_400_000).toISOString();
      demoNextAt = next;
    } else {
      const { data, error } = await supabase.rpc('submit_suggestion', { p_body: text.trim() });
      if (error) {
        setBusy(false);
        setNotice({ kind: 'error', text: friendlyError(error, 'No se pudo enviar tu sugerencia.') });
        return;
      }
      next = data as string;
    }
    setBusy(false);
    setText('');
    setNextAt(next);
    setNotice({ kind: 'ok', text: '¡Gracias! Tu sugerencia le llegó al equipo.' });
  };

  return (
    <section className={card} aria-label="Sugerencias">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <h3 className="text-xl font-semibold leading-tight">Sugerencias</h3>
      </div>
      <p className="text-sm text-slate-500 dark:text-haze-400 -mt-2">
        Cuéntale al equipo qué mejorarías o qué te falta. Puedes mandar una por semana y la leen los administradores.
      </p>
      <NoticeBanner notice={notice} />
      {locked && nextAt ? (
        <p className="text-sm rounded-2xl bg-haze-100 dark:bg-ink-800 px-4 py-3">
          Ya enviaste una sugerencia esta semana. Podrás enviar otra el <strong>{formatDate(nextAt)}</strong>.
        </p>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <textarea
            rows={4}
            value={text}
            maxLength={SUGGESTION_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe tu sugerencia"
            aria-label="Tu sugerencia"
            className={`${inputCls} resize-none`}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-haze-400 tabular-nums">{text.trim().length}/{SUGGESTION_MAX}</span>
            <button type="submit" disabled={busy || tooShort} className={primaryBtn}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
