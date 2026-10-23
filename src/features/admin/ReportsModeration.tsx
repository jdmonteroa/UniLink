import React, { useCallback, useEffect, useState } from 'react';
import { Flag, Loader2, Check, X, Eye } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { useAuthStore } from '@/features/auth/authStore';
import { NoticeBanner, Spinner, card, formatWhen, outlineBtn, primaryBtn, useNotice } from '@/features/events/ui';

interface ReportMessage { sender: string; content: string; at: string }
interface ReportItem {
  id: string;
  createdAt: string;
  status: string;
  reason: string;
  description: string;
  reporterName: string;
  reportedName: string;
  reportsAgainst: number;
  messages: ReportMessage[];
}

interface Row {
  id: string; created_at: string; status: string; reason: string; description: string | null;
  reporter_name: string; reported_name: string; reports_against: number; messages: ReportMessage[] | null;
}

const REASONS: Record<string, string> = {
  harassment: 'Acoso o amenazas',
  sexual_content: 'Contenido sexual no deseado',
  fake_profile: 'Perfil falso',
  spam: 'Spam o estafa',
  other: 'Otro motivo',
};

const DEMO: ReportItem[] = [
  {
    id: 'demo-r1', createdAt: new Date(Date.now() - 3_600_000).toISOString(), status: 'pending', reason: 'harassment',
    description: 'Me sigue escribiendo aunque le dije que no.', reporterName: 'Valeria Torres', reportedName: 'Marco Ruiz', reportsAgainst: 2,
    messages: [
      { sender: 'Marco Ruiz', content: 'Contéstame, sé dónde estudias', at: new Date(Date.now() - 4_000_000).toISOString() },
      { sender: 'Valeria Torres', content: 'Ya te dije que no me escribas', at: new Date(Date.now() - 3_900_000).toISOString() },
    ],
  },
];

const mapRow = (r: Row): ReportItem => ({
  id: r.id, createdAt: r.created_at, status: r.status, reason: r.reason, description: r.description || '',
  reporterName: r.reporter_name, reportedName: r.reported_name, reportsAgainst: r.reports_against, messages: r.messages || [],
});

/** Cola de reportes entre personas, con la copia de los mensajes (el chat se borra a las 24 h). */
export const ReportsModeration: React.FC<{ onCount?: (n: number) => void }> = ({ onCount }) => {
  const isDemo = useAuthStore((s) => s.isDemo);
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  const load = useCallback(async () => {
    if (isDemo) {
      setItems((cur) => cur ?? DEMO);
      return;
    }
    const { data, error } = await supabase.rpc('get_reports_for_review');
    if (error) {
      setNotice({ kind: 'error', text: friendlyError(error, 'No se pudieron cargar los reportes.') });
      setItems([]);
      return;
    }
    setItems(((data || []) as Row[]).map(mapRow));
  }, [isDemo, setNotice]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (items) onCount?.(items.length);
  }, [items, onCount]);

  const resolve = async (id: string, status: 'investigating' | 'resolved' | 'dismissed') => {
    setBusy(id + status);
    if (!isDemo) {
      const { error } = await supabase.rpc('resolve_report', { p_report: id, p_status: status });
      if (error) {
        setBusy(null);
        setNotice({ kind: 'error', text: friendlyError(error, 'No se pudo actualizar el reporte.') });
        return;
      }
    }
    setItems((cur) => (cur ?? []).flatMap((r) => (r.id !== id ? [r] : status === 'investigating' ? [{ ...r, status }] : [])));
    setBusy(null);
    setNotice({ kind: 'ok', text: status === 'dismissed' ? 'Reporte descartado.' : status === 'resolved' ? 'Reporte resuelto.' : 'Marcado como en revisión.' });
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-4">
      <NoticeBanner notice={notice} />
      {items.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10">
          <span className="w-14 h-14 rounded-full bg-mint text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker"><Flag className="w-6 h-6" /></span>
          <h3 className="text-xl font-semibold">No hay reportes pendientes</h3>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className={`${card} space-y-3`}>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-haze-400">{formatWhen(r.createdAt)}{r.status === 'investigating' ? ' · En revisión' : ''}</p>
                <h3 className="text-lg font-semibold leading-tight">{r.reporterName} reportó a {r.reportedName}</h3>
                <p className="text-sm"><strong>{REASONS[r.reason] ?? r.reason}</strong>{r.reportsAgainst > 1 ? ` · ${r.reportsAgainst} reportes contra esta persona` : ''}</p>
                {r.description && <p className="text-sm text-slate-600 dark:text-haze-300">“{r.description}”</p>}
              </div>
              <div className="rounded-2xl bg-haze-100 dark:bg-ink-800 p-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-haze-400">Mensajes de las últimas 24 h</p>
                {r.messages.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-haze-400">No había mensajes cuando se envió el reporte.</p>
                ) : (
                  r.messages.map((m, i) => (
                    <p key={i} className="text-sm leading-snug"><strong>{m.sender}:</strong> {m.content}</p>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {r.status === 'pending' && (
                  <button onClick={() => void resolve(r.id, 'investigating')} disabled={busy !== null} className={`${outlineBtn} h-11 flex-1`}><Eye className="w-4 h-4" /> En revisión</button>
                )}
                <button onClick={() => void resolve(r.id, 'dismissed')} disabled={busy !== null} className={`${outlineBtn} h-11 flex-1`}>
                  {busy === r.id + 'dismissed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Descartar
                </button>
                <button onClick={() => void resolve(r.id, 'resolved')} disabled={busy !== null} className={`${primaryBtn} h-11 flex-1`}>
                  {busy === r.id + 'resolved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Resuelto
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
