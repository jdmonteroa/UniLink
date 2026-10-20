import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Instagram, MoreVertical, HeartCrack, UserX, Flag, Loader2, MapPin, CalendarDays, Check, X, RefreshCw, Clock, CalendarCheck, Send, Quote,
} from 'lucide-react';
import { useAuthStore, formatSemester } from '@/features/auth/authStore';
import {
  useConnectionsStore,
  MAX_ROUNDS,
  NOTE_MAX,
  validateMeetupInput,
  type Connection,
  type HistoryItem,
  type MeetupInput,
  type MeetupStatus,
} from '@/features/connections/connectionsStore';
import type { ReportReason } from '@/features/chat/chatStore';
import { Avatar } from '@/components/Avatar';
import { confirmDialog } from '@/components/ConfirmDialog';
import { MODE_COLOR } from '@/components/brand';
import { NoticeBanner, card, formatWhen, iconBtn, inputCls, labelCls, outlineBtn, primaryBtn, useNotice } from '@/features/events/ui';

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Acoso o amenazas' },
  { value: 'sexual_content', label: 'Contenido sexual no deseado' },
  { value: 'fake_profile', label: 'Perfil falso' },
  { value: 'spam', label: 'Spam o estafa' },
  { value: 'other', label: 'Otro motivo' },
];

const SUGGESTIONS: Record<Connection['mode'], string[]> = {
  friendship: [
    'Hola, ¿te late un café entre clases?',
    'Cursamos lo mismo, ¿repasamos juntos?',
    'Me cayó bien tu perfil, ¿nos vemos para platicar?',
  ],
  dating: [
    'Hola, me cayó muy bien tu perfil. ¿Un café entre clases?',
    '¿Te late conocernos con un café en la escuela?',
  ],
};

const STATUS_LABEL: Record<MeetupStatus, { text: string; cls: string }> = {
  pending: { text: 'Esperando respuesta', cls: 'bg-sun/60 text-slate-900 dark:bg-sun/25 dark:text-slate-100' },
  accepted: { text: 'Aceptado', cls: 'bg-mint/70 text-slate-900 dark:bg-mint/20 dark:text-slate-100' },
  declined: { text: 'Rechazado', cls: 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-200' },
  rescheduled: { text: 'Replanteado', cls: 'bg-haze-200 text-slate-700 dark:bg-ink-700 dark:text-haze-300' },
  cancelled: { text: 'Cancelado', cls: 'bg-haze-200 text-slate-700 dark:bg-ink-700 dark:text-haze-300' },
  expired: { text: 'Venció', cls: 'bg-haze-200 text-slate-700 dark:bg-ink-700 dark:text-haze-300' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const tomorrowNoon = () => {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(12, 0, 0, 0);
  return toLocalInput(d);
};

// ---------------------------------------------------------------------------
// Formulario de propuesta / replanteamiento
// ---------------------------------------------------------------------------
const MeetupForm: React.FC<{
  mode: Connection['mode'];
  firstName: string;
  variant: 'propose' | 'reschedule';
  defaultPlace?: string;
  onSubmit: (input: MeetupInput) => Promise<string | null>;
  onCancel?: () => void;
}> = ({ mode, firstName, variant, defaultPlace = '', onSubmit, onCancel }) => {
  const [place, setPlace] = useState(defaultPlace);
  const [whenLocal, setWhenLocal] = useState(tomorrowNoon());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = { place, whenLocal, note };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateMeetupInput(input);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    const message = await onSubmit(input);
    setSaving(false);
    if (message) setError(message);
  };

  return (
    <form onSubmit={submit} className={`${card} space-y-4`}>
      <div>
        <h3 className="text-xl font-semibold">{variant === 'propose' ? `Proponle a ${firstName} quedar` : 'Replantea el encuentro'}</h3>
        <p className="text-sm text-slate-500 dark:text-haze-400 mt-1">
          {variant === 'propose' ? 'Elige un lugar de la escuela y una hora. Cuéntale en un mensaje qué te gustaría hacer.' : `Propón otro lugar u hora y dile por qué. ${firstName} podrá aceptar o rechazar.`}
        </p>
      </div>

      <div>
        <label htmlFor="mt-place" className={labelCls}>Lugar en la escuela</label>
        <input id="mt-place" value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} placeholder="Cafetería, biblioteca, infoteca, salón 4-203…" className={inputCls} />
      </div>

      <div>
        <label htmlFor="mt-when" className={labelCls}>Fecha y hora</label>
        <input id="mt-when" type="datetime-local" value={whenLocal} min={toLocalInput(new Date())} onChange={(e) => setWhenLocal(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label htmlFor="mt-note" className={`${labelCls} flex justify-between`}>
          <span>Mensaje para {firstName}</span>
          <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{note.length}/{NOTE_MAX}</span>
        </label>
        {variant === 'propose' && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SUGGESTIONS[mode].map((s) => (
              <button type="button" key={s} onClick={() => setNote(s)} className="px-2.5 py-1 rounded-full text-xs bg-haze-100 dark:bg-ink-800 hover:bg-haze-200 dark:hover:bg-ink-700 transition-colors text-left">
                {s}
              </button>
            ))}
          </div>
        )}
        <textarea id="mt-note" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribe un mensaje corto y amable" className={inputCls} />
      </div>

      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}

      <div className="flex gap-3">
        {onCancel && <button type="button" onClick={onCancel} disabled={saving} className={`${outlineBtn} h-12`}>Cancelar</button>}
        <button type="submit" disabled={saving} className={`${primaryBtn} flex-1`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {variant === 'propose' ? 'Enviar propuesta' : 'Enviar replanteamiento'}
        </button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Detalle del match
// ---------------------------------------------------------------------------
export const MatchDetail: React.FC<{ connection: Connection; onBack: () => void }> = ({ connection, onBack }) => {
  const { user } = useAuthStore();
  const store = useConnectionsStore();
  const [notice, setNotice] = useNotice();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<'main' | 'propose' | 'reschedule' | 'decline'>('main');
  const [declineNote, setDeclineNote] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('harassment');
  const [reportText, setReportText] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const topRef = useRef<HTMLDivElement>(null);

  const { other, meetup, mode } = connection;
  const first = other.name.split(' ')[0];
  const myId = user?.id;
  const meetupKey = `${meetup?.id}:${meetup?.status}`;

  // Al abrir: se marca como visto (apaga el punto rojo informativo) y se carga el historial
  useEffect(() => {
    void store.markSeen(connection.matchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.matchId]);
  useEffect(() => {
    let cancelled = false;
    store.loadHistory(connection.matchId).then((h) => !cancelled && setHistory(h)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.matchId, meetupKey]);
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [view]);

  const isPast = !!meetup && new Date(meetup.when).getTime() < Date.now();
  const pendingForMe = meetup?.status === 'pending' && !meetup.proposedByMe;
  const pendingByMe = meetup?.status === 'pending' && meetup.proposedByMe;
  const acceptedFuture = meetup?.status === 'accepted' && !isPast;

  const run = async (key: string, fn: () => Promise<{ success: boolean; message?: string }>, okText?: string): Promise<boolean> => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.success) setNotice({ kind: 'error', text: res.message || 'No se pudo completar la acción.' });
    else if (okText) setNotice({ kind: 'ok', text: okText });
    return res.success;
  };

  const propose = async (input: MeetupInput) => {
    const res = await store.propose(connection.matchId, input);
    if (res.success) {
      setView('main');
      setNotice({ kind: 'ok', text: `Propuesta enviada. Te mostraremos aquí cuando ${first} responda.` });
      return null;
    }
    return res.message || 'No se pudo enviar la propuesta.';
  };

  const reschedule = async (input: MeetupInput) => {
    if (!meetup) return 'No hay propuesta.';
    const res = await store.respond(meetup.id, 'reschedule', input);
    if (res.success) {
      setView('main');
      setNotice({ kind: 'ok', text: `Replanteamiento enviado. ${first} decidirá si lo acepta.` });
      return null;
    }
    return res.message || 'No se pudo enviar.';
  };

  const accept = () => meetup && run('accept', () => store.respond(meetup.id, 'accept'), '¡Encuentro confirmado!');
  const decline = async () => {
    if (!meetup) return;
    if (await run('decline', () => store.respond(meetup.id, 'decline', { note: declineNote }), 'Propuesta rechazada.')) {
      setView('main');
      setDeclineNote('');
    }
  };
  const cancelMeetup = async () => {
    if (!meetup) return;
    const ok = await confirmDialog({
      title: acceptedFuture ? '¿Cancelar el encuentro?' : '¿Cancelar la propuesta?',
      message: acceptedFuture ? `${first} recibirá el aviso de que ya no se verán.` : undefined,
      confirmLabel: acceptedFuture ? 'Cancelar encuentro' : 'Cancelar propuesta',
      tone: 'danger',
    });
    if (ok) await run('cancel', () => store.cancel(meetup.id), acceptedFuture ? 'Encuentro cancelado.' : 'Propuesta cancelada.');
  };

  const handleUnmatch = async () => {
    setShowOptions(false);
    const ok = await confirmDialog({ title: `¿Deshacer el match con ${first}?`, message: 'Desaparecerá para ambos y no podrán proponerse encuentros.', confirmLabel: 'Deshacer match', tone: 'danger', icon: 'heart-crack' });
    if (ok && (await run('unmatch', () => store.unmatch(connection.matchId)))) onBack();
  };
  const handleBlock = async () => {
    setShowOptions(false);
    const ok = await confirmDialog({ title: `¿Bloquear a ${first}?`, message: 'Ya no podrán verse ni proponerse encuentros.', confirmLabel: 'Bloquear', tone: 'danger', icon: 'user-x' });
    if (ok && (await run('block', () => store.block(connection)))) onBack();
  };
  const handleReport = async () => {
    setBusy('report');
    const res = await store.report(connection, reportReason, reportText);
    if (!res.success) {
      setBusy(null);
      setNotice({ kind: 'error', text: res.message || 'No se pudo reportar.' });
      return;
    }
    setShowReport(false);
    setReportText('');
    if (alsoBlock) {
      await store.block(connection);
      setBusy(null);
      onBack();
      return;
    }
    setBusy(null);
    setNotice({ kind: 'ok', text: res.message || 'Reporte enviado.' });
  };

  // ---- Bloque principal según el estado del encuentro ----
  const meetupDetails = (m: NonNullable<typeof meetup>) => (
    <div className="space-y-1.5 text-sm">
      <p className="flex items-center gap-2 font-semibold"><MapPin className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />{m.place}</p>
      <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />{formatWhen(m.when)}</p>
    </div>
  );
  const quote = (text: string, who: string) => (
    <blockquote className="relative pl-4 border-l-4 border-sun text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
      <Quote className="w-3.5 h-3.5 absolute -left-[0.55rem] -top-2 bg-white dark:bg-ink-850 text-sun fill-current" aria-hidden />
      “{text}”
      <footer className="mt-1 text-xs not-italic text-slate-500 dark:text-haze-400">— {who}</footer>
    </blockquote>
  );

  let main: React.ReactNode;
  if (view === 'propose') {
    main = <MeetupForm mode={mode} firstName={first} variant="propose" onSubmit={propose} onCancel={() => setView('main')} />;
  } else if (view === 'reschedule' && meetup) {
    main = <MeetupForm mode={mode} firstName={first} variant="reschedule" defaultPlace={meetup.place} onSubmit={reschedule} onCancel={() => setView('main')} />;
  } else if (pendingForMe && meetup) {
    main = (
      <section className={`${card} border-2 border-brand-600/70`} aria-label="Propuesta de encuentro">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xl font-semibold leading-tight">{first} quiere quedar contigo</h3>
          <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-haze-100 dark:bg-ink-800 text-xs font-semibold">Propuesta {meetup.round} de {MAX_ROUNDS}</span>
        </div>
        {quote(meetup.note, first)}
        {meetupDetails(meetup)}
        {view === 'decline' ? (
          <div className="space-y-3">
            <label htmlFor="decline-note" className={labelCls}>Mensaje para {first} <span className="font-normal text-slate-500 dark:text-haze-400">(opcional)</span></label>
            <textarea id="decline-note" rows={2} maxLength={NOTE_MAX} value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} placeholder="Ej. Gracias, prefiero dejarlo así" className={inputCls} />
            <div className="flex gap-3">
              <button onClick={() => setView('main')} className={`${outlineBtn} h-12`}>Volver</button>
              <button onClick={() => void decline()} disabled={busy === 'decline'} className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60">
                {busy === 'decline' && <Loader2 className="w-4 h-4 animate-spin" />} Rechazar propuesta
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <button onClick={() => void accept()} disabled={busy === 'accept'} className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-mint text-slate-900 text-sm font-semibold shadow-sticker transition hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60">
              {busy === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aceptar
            </button>
            <div className="flex gap-2.5">
              <button onClick={() => setView('reschedule')} disabled={meetup.round >= MAX_ROUNDS} className={`${outlineBtn} flex-1`}>
                <RefreshCw className="w-4 h-4" /> Replantear
              </button>
              <button onClick={() => setView('decline')} className={`${outlineBtn} flex-1 text-rose-700 dark:text-rose-400`}>
                <X className="w-4 h-4" /> Rechazar
              </button>
            </div>
            {meetup.round >= MAX_ROUNDS && <p className="text-xs text-slate-500 dark:text-haze-400">Ya hubo {MAX_ROUNDS} propuestas: ahora toca aceptar o rechazar.</p>}
          </div>
        )}
      </section>
    );
  } else if (pendingByMe && meetup) {
    main = (
      <section className={card} aria-label="Propuesta enviada">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600 dark:text-sun" />
          <h3 className="text-xl font-semibold leading-tight">Esperando respuesta de {first}</h3>
        </div>
        {quote(meetup.note, 'tú')}
        {meetupDetails(meetup)}
        <p className="text-sm text-slate-500 dark:text-haze-400">{first} puede aceptar, replantear o rechazar. Si no responde en 48 horas, la propuesta vence.</p>
        <button onClick={() => void cancelMeetup()} disabled={busy === 'cancel'} className={`${outlineBtn} w-full`}>Cancelar propuesta</button>
      </section>
    );
  } else if (acceptedFuture && meetup) {
    main = (
      <section className={`${card} bg-mint/30 dark:bg-mint/10`} aria-label="Encuentro confirmado">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-azure-700 dark:text-azure-300" />
          <h3 className="text-xl font-semibold leading-tight">¡Encuentro confirmado!</h3>
        </div>
        {meetupDetails(meetup)}
        {other.instagram ? (
          <p className="text-sm">Si surge un imprevisto, avísale a {first} por Instagram: <a href={`https://instagram.com/${other.instagram}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline">@{other.instagram}</a>.</p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-haze-300">{first} no compartió su Instagram. Llega con unos minutos de anticipación.</p>
        )}
        <button onClick={() => void cancelMeetup()} disabled={busy === 'cancel'} className={`${outlineBtn} w-full`}>Cancelar encuentro</button>
      </section>
    );
  } else {
    const closed = meetup && !['accepted', 'pending'].includes(meetup.status) ? meetup : null;
    const outcome =
      meetup?.status === 'accepted' && isPast ? 'Su último encuentro ya pasó. ¿Quieren verse otra vez?'
      : closed?.status === 'declined' ? (closed.proposedByMe ? `${first} rechazó tu propuesta.` : 'Rechazaste la propuesta.')
      : closed?.status === 'cancelled' ? 'El encuentro se canceló.'
      : closed?.status === 'expired' ? 'La propuesta venció sin respuesta.'
      : closed?.status === 'rescheduled' ? 'La propuesta se replanteó.'
      : null;
    main = (
      <section className={`${card} text-center`} aria-label="Sin encuentro">
        <span className="w-14 h-14 mx-auto rounded-full bg-sun text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker"><CalendarDays className="w-6 h-6" /></span>
        <h3 className="text-xl font-semibold leading-tight">{outcome ? outcome : `¡Hicieron match! Propón un encuentro`}</h3>
        {closed?.responseNote && <p className="text-sm text-slate-600 dark:text-haze-300">“{closed.responseNote}”</p>}
        <p className="text-sm text-slate-500 dark:text-haze-400">Quien propone elige lugar y hora dentro de la escuela y deja un mensaje. {first} responde desde aquí.</p>
        <button onClick={() => setView('propose')} className={`${primaryBtn} w-full`}>Proponer un encuentro</button>
      </section>
    );
  }

  return (
    <div ref={topRef} className="space-y-4 pb-8 scroll-mt-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={onBack} aria-label="Volver a la lista" className={iconBtn}><ArrowLeft className="w-5 h-5" /></button>
          <div className="rounded-full p-[2px] shrink-0" style={{ backgroundColor: MODE_COLOR[mode] }}>
            <Avatar src={other.avatarUrl} name={other.name} className="w-11 h-11 text-sm ring-2 ring-haze-50 dark:ring-ink-950" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight truncate">{other.name}</h2>
            <p className="text-xs text-slate-500 dark:text-haze-400 truncate">{[other.career, other.campus].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 relative shrink-0">
          {other.instagram && (
            <a href={`https://instagram.com/${other.instagram}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center rounded-full bg-coral text-slate-900 hover:-rotate-6 transition" title={`@${other.instagram}`} aria-label={`Instagram de ${other.name}`}>
              <Instagram className="w-4 h-4" />
            </a>
          )}
          <button onClick={() => setShowOptions((o) => !o)} aria-label="Opciones" aria-expanded={showOptions} className={iconBtn}><MoreVertical className="w-4.5 h-4.5" /></button>
          <AnimatePresence>
            {showOptions && (
              <motion.div initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: -4 }} transition={{ duration: 0.15 }} style={{ transformOrigin: 'top right' }}
                className="absolute right-0 top-11 w-56 rounded-2xl bg-white dark:bg-ink-800 border border-slate-900/[0.06] dark:border-white/[0.06] shadow-soft-lg p-1.5 z-50 text-sm">
                <button onClick={() => void handleUnmatch()} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-haze-100 dark:hover:bg-ink-700 flex items-center gap-2.5"><HeartCrack className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Deshacer match</button>
                <button onClick={() => { setShowOptions(false); setShowReport(true); }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-haze-100 dark:hover:bg-ink-700 flex items-center gap-2.5"><Flag className="w-4 h-4" /> Reportar</button>
                <button onClick={() => void handleBlock()} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 flex items-center gap-2.5"><UserX className="w-4 h-4" /> Bloquear</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <NoticeBanner notice={notice} />

      {main}

      {/* Quién es */}
      {view === 'main' && (
        <section className={card} aria-label={`Sobre ${first}`}>
          <h3 className="text-lg font-semibold">Sobre {first}</h3>
          {other.bio && <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{other.bio}</p>}
          <p className="text-sm text-slate-500 dark:text-haze-400">{[other.career, other.semester ? formatSemester(other.semester) : '', other.campus].filter(Boolean).join(' · ')}</p>
          {other.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {other.interests.map((t) => <span key={t} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-haze-100 dark:bg-ink-800 text-slate-700 dark:text-haze-300">{t}</span>)}
            </div>
          )}
        </section>
      )}

      {/* Historial de propuestas y mensajes */}
      {view === 'main' && history.length > 0 && (
        <section className="space-y-3" aria-label="Historial de propuestas">
          <h3 className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-haze-400">Historial</h3>
          <ul className="space-y-2.5">
            {history.map((h) => {
              const mine = h.proposerId === myId;
              const st = STATUS_LABEL[h.status];
              return (
                <li key={h.id} className={`max-w-[92%] rounded-2xl p-3 text-sm space-y-1 ${mine ? 'ml-auto bg-brand-50 dark:bg-brand-950/40' : 'mr-auto bg-white dark:bg-ink-850 shadow-soft-sm'}`}>
                  <p className="text-xs text-slate-500 dark:text-haze-400">{mine ? 'Tú propusiste' : `${first} propuso`} · {h.place} · {formatWhen(h.when)}</p>
                  <p className="leading-snug">“{h.note}”</p>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
                    {h.responseNote && <span className="text-xs text-slate-600 dark:text-haze-300">“{h.responseNote}”</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Reportar */}
      <AnimatePresence>
        {showReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }} className="w-full max-w-md rounded-3xl bg-white dark:bg-ink-850 p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
              <h3 className="text-xl font-semibold">Reportar a {first}</h3>
              <fieldset className="space-y-2">
                <legend className="sr-only">Motivo</legend>
                {REPORT_REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-3 text-sm cursor-pointer"><input type="radio" name="report-reason" checked={reportReason === r.value} onChange={() => setReportReason(r.value)} /> {r.label}</label>
                ))}
              </fieldset>
              <textarea rows={3} maxLength={1000} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Cuéntanos qué pasó (opcional)" className={inputCls} aria-label="Detalles del reporte" />
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} /> Bloquear también a {first}</label>
              <div className="flex gap-3">
                <button onClick={() => setShowReport(false)} className={`${outlineBtn} h-12`}>Cancelar</button>
                <button onClick={() => void handleReport()} disabled={busy === 'report'} className={`${primaryBtn} flex-1`}>{busy === 'report' && <Loader2 className="w-4 h-4 animate-spin" />} Enviar reporte</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

