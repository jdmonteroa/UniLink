import React, { useCallback, useEffect, useState } from 'react';
import { Lightbulb, Check, Archive, Loader2 } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { useAuthStore } from '@/features/auth/authStore';
import { NoticeBanner, Spinner, card, formatWhen, outlineBtn, useNotice } from '@/features/events/ui';

interface Suggestion { id: string; createdAt: string; status: 'new' | 'read' | 'archived'; body: string; authorName: string }
interface Row { id: string; created_at: string; status: Suggestion['status']; body: string; author_name: string }

const DEMO: Suggestion[] = [
  { id: 'demo-s1', createdAt: new Date(Date.now() - 7_200_000).toISOString(), status: 'new', body: 'Sería genial poder filtrar a las personas por horario libre en común.', authorName: 'Valeria Torres' },
  { id: 'demo-s2', createdAt: new Date(Date.now() - 86_400_000).toISOString(), status: 'read', body: 'Me gustaría que los grupos pudieran tener una foto.', authorName: 'Diego Ramírez' },
];

const mapRow = (r: Row): Suggestion => ({ id: r.id, createdAt: r.created_at, status: r.status, body: r.body, authorName: r.author_name });

/** Bandeja de sugerencias para administradores. */
export const SuggestionsModeration: React.FC<{ onCount?: (n: number) => void }> = ({ onCount }) => {
  const isDemo = useAuthStore((s) => s.isDemo);
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  const load = useCallback(async () => {
    if (isDemo) {
      setItems((cur) => cur ?? DEMO);
      return;
    }
    const { data, error } = await supabase.rpc('get_suggestions_for_review');
    if (error) {
      setNotice({ kind: 'error', text: friendlyError(error, 'No se pudieron cargar las sugerencias.') });
      setItems([]);
      return;
    }
    setItems(((data || []) as Row[]).map(mapRow));
  }, [isDemo, setNotice]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (items) onCount?.(items.filter((i) => i.status === 'new').length);
  }, [items, onCount]);

  const setStatus = async (id: string, status: Suggestion['status']) => {
    setBusy(id + status);
    if (!isDemo) {
      const { error } = await supabase.rpc('set_suggestion_status', { p_id: id, p_status: status });
      if (error) {
        setBusy(null);
        setNotice({ kind: 'error', text: friendlyError(error, 'No se pudo actualizar la sugerencia.') });
        return;
      }
    }
    setItems((cur) => (cur ?? []).flatMap((s) => (s.id !== id ? [s] : status === 'archived' ? [] : [{ ...s, status }])));
    setBusy(null);
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-4">
      <NoticeBanner notice={notice} />
      {items.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10">
          <span className="w-14 h-14 rounded-full bg-sun text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker"><Lightbulb className="w-6 h-6" /></span>
          <h3 className="text-xl font-semibold">No hay sugerencias</h3>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s.id} className={`${card} space-y-3`}>
              <p className="text-xs text-slate-500 dark:text-haze-400">
                {s.authorName} · {formatWhen(s.createdAt)}
                {s.status === 'new' && <span className="ml-2 px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold">Nueva</span>}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{s.body}</p>
              <div className="flex gap-2">
                {s.status === 'new' && (
                  <button onClick={() => void setStatus(s.id, 'read')} disabled={busy !== null} className={`${outlineBtn} h-10 flex-1`}>
                    {busy === s.id + 'read' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Marcar leída
                  </button>
                )}
                <button onClick={() => void setStatus(s.id, 'archived')} disabled={busy !== null} className={`${outlineBtn} h-10 flex-1`}>
                  {busy === s.id + 'archived' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />} Archivar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
