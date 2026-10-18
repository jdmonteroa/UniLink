import React, { useEffect, useState } from 'react';
import { Check, X, Loader2, ShieldAlert, ShieldCheck, Flag, Image as ImageIcon, FileText, MapPin, CalendarDays } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import {
  useEventsStore,
  imageRisk,
  likelihoodLevel,
  REPORT_REASONS,
  type QueueItem,
  type ScanHit,
  type SanctionKind,
  type ImageScan,
} from '@/features/events/eventsStore';
import { Avatar } from '@/components/Avatar';
import { confirmDialog } from '@/components/ConfirmDialog';
import { CategoryBadge, EventThumb, NoticeBanner, Spinner, card, chip, formatWhen, inputCls, labelCls, outlineBtn, useNotice } from '@/features/events/ui';

const HIT_CATEGORY: Record<ScanHit['category'], string> = {
  insult: 'Insulto',
  profanity: 'Grosería',
  sexual: 'Contenido sexual',
  violence: 'Violencia o amenaza',
  spam: 'Spam o estafa',
  link: 'Contiene enlace',
};
const SEVERITY: Record<ScanHit['severity'], { label: string; cls: string }> = {
  high: { label: 'grave', cls: 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-200' },
  medium: { label: 'moderado', cls: 'bg-sun/60 text-slate-900 dark:bg-sun/25 dark:text-slate-100' },
  low: { label: 'leve', cls: 'bg-haze-200 text-slate-700 dark:bg-ink-700 dark:text-haze-300' },
};
const LIKELIHOOD_LABEL: Record<string, string> = {
  VERY_UNLIKELY: 'Muy improbable',
  UNLIKELY: 'Improbable',
  POSSIBLE: 'Posible',
  LIKELY: 'Probable',
  VERY_LIKELY: 'Muy probable',
};
const IMAGE_FIELDS: { key: 'adult' | 'violence' | 'racy' | 'spoof' | 'medical'; label: string }[] = [
  { key: 'adult', label: 'Contenido adulto' },
  { key: 'violence', label: 'Violencia' },
  { key: 'racy', label: 'Sugerente' },
  { key: 'spoof', label: 'Parodia o meme' },
  { key: 'medical', label: 'Médico' },
];

const QUICK_REASONS = [
  'Lenguaje ofensivo o insultos.',
  'Contenido sexual o inapropiado.',
  'Parece spam o estafa.',
  'Información incompleta o poco clara.',
  'No corresponde a la comunidad universitaria.',
];

const SANCTIONS: { id: SanctionKind | 'none'; label: string; hint: string; days?: number[]; adminOnly?: boolean }[] = [
  { id: 'none', label: 'Solo rechazar', hint: 'Sin sanción para la persona.' },
  { id: 'warn', label: 'Advertencia', hint: 'Queda registrada en su historial.' },
  { id: 'event_ban', label: 'No poder publicar eventos', hint: 'Por un tiempo; el resto de la app sigue igual.', days: [3, 7, 30] },
  { id: 'suspend', label: 'Suspender la cuenta', hint: 'Deja de aparecer en Descubrir y no puede publicar.', days: [3, 7, 30] },
  { id: 'ban', label: 'Bloqueo permanente', hint: 'Solo administradores.', adminOnly: true },
];

const ImageScanPanel: React.FC<{ hasImage: boolean; scan: ImageScan | null }> = ({ hasImage, scan }) => {
  if (!hasImage) return <p className="text-sm text-slate-500 dark:text-haze-400">Sin imagen.</p>;
  if (!scan || scan.status === 'pending') {
    return (
      <p className="text-sm text-slate-600 dark:text-haze-300">
        Todavía no hay análisis automático de esta imagen (SafeSearch). <strong>Revísala tú</strong> antes de decidir.
      </p>
    );
  }
  if (scan.status === 'error') {
    return <p className="text-sm text-rose-700 dark:text-rose-400">El análisis automático falló{scan.error ? `: ${scan.error}` : ''}. Revisa la imagen tú.</p>;
  }
  const risk = imageRisk(scan);
  const riskStyle = {
    high: 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
    medium: 'bg-sun/60 text-slate-900 dark:bg-sun/25 dark:text-slate-100',
    low: 'bg-mint/60 text-slate-900 dark:bg-mint/20 dark:text-slate-100',
    none: '',
  }[risk];
  return (
    <div className="space-y-2">
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${riskStyle}`}>
        {risk === 'high' ? 'Riesgo alto' : risk === 'medium' ? 'Riesgo medio' : 'Riesgo bajo'}
      </span>
      <ul className="space-y-1.5">
        {IMAGE_FIELDS.map(({ key, label }) => {
          const level = likelihoodLevel(scan[key]);
          if (level < 0) return null;
          return (
            <li key={key} className="text-sm">
              <div className="flex justify-between gap-2">
                <span>{label}</span>
                <span className="text-slate-500 dark:text-haze-400">{LIKELIHOOD_LABEL[scan[key] as string]}</span>
              </div>
              <div className="h-1.5 rounded-full bg-haze-200 dark:bg-ink-700 mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${level >= 3 ? 'bg-rose-500' : level === 2 ? 'bg-sun' : 'bg-mint'}`}
                  style={{ width: `${((level + 1) / 5) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const QueueCard: React.FC<{ item: QueueItem; isAdmin: boolean; onDone: (message: string) => void; onError: (message: string) => void }> = ({
  item,
  isAdmin,
  onDone,
  onError,
}) => {
  const reviewEvent = useEventsStore((s) => s.reviewEvent);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [sanction, setSanction] = useState<SanctionKind | 'none'>('none');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const verdict = item.textScan?.verdict ?? 'clean';
  const verdictStyle = {
    clean: { label: 'Sin coincidencias', cls: 'bg-mint/60 text-slate-900 dark:bg-mint/20 dark:text-slate-100', Icon: ShieldCheck },
    review: { label: 'Revisar', cls: 'bg-sun/60 text-slate-900 dark:bg-sun/25 dark:text-slate-100', Icon: ShieldAlert },
    flagged: { label: 'Marcado', cls: 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-200', Icon: ShieldAlert },
  }[verdict];
  const sanctionDef = SANCTIONS.find((s) => s.id === sanction)!;

  const approve = async () => {
    setBusy(true);
    const res = await reviewEvent(item.id, { decision: 'approve', note: '' });
    setBusy(false);
    if (res.success) onDone('Publicación aprobada.');
    else onError(res.message || 'No se pudo aprobar.');
  };

  const reject = async () => {
    if (note.trim().length < 3) {
      onError('Escribe el motivo del rechazo: lo verá quien publicó.');
      return;
    }
    if (sanction !== 'none') {
      const ok = await confirmDialog({
        title: `¿Sancionar a ${item.author.name.split(' ')[0]}?`,
        message: `${sanctionDef.label}${sanctionDef.days ? ` por ${days} días` : ''}. Quedará registrado en su historial.`,
        confirmLabel: 'Rechazar y sancionar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusy(true);
    const res = await reviewEvent(item.id, {
      decision: 'reject',
      note,
      sanction: sanction === 'none' ? undefined : sanction,
      days: sanctionDef.days ? days : undefined,
    });
    setBusy(false);
    if (res.success) onDone(sanction === 'none' ? 'Publicación rechazada.' : 'Publicación rechazada y sanción aplicada.');
    else onError(res.message || 'No se pudo rechazar.');
  };

  return (
    <article className={`${card} space-y-5`}>
      {/* Contenido */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <EventThumb title={item.title} category={item.category} imageUrl="" className="w-12 h-12 rounded-2xl shrink-0 text-xl" />
          <div className="min-w-0 flex-1 space-y-1">
            <CategoryBadge category={item.category} />
            <h3 className="text-xl font-semibold leading-tight break-words">{item.title}</h3>
          </div>
        </div>
        {(item.startTime || item.location) && (
          <p className="text-sm text-slate-600 dark:text-haze-300 flex flex-wrap gap-x-4 gap-y-1">
            {item.startTime && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{formatWhen(item.startTime)}</span>}
            {item.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{item.location}</span>}
          </p>
        )}
        {item.description && <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words">{item.description}</p>}
        {item.imageUrl && <img src={item.imageUrl} alt="Imagen de la publicación" className="w-full max-h-80 object-contain rounded-2xl bg-haze-100 dark:bg-ink-800" />}
      </div>

      {/* Quién publica */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-haze-100 dark:bg-ink-800">
        <Avatar src={item.author.avatarUrl} name={item.author.name} className="w-10 h-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{item.author.name}</p>
          <p className="text-xs text-slate-500 dark:text-haze-400 truncate">
            {[item.author.career, item.author.semester ? `${item.author.semester}.º semestre` : ''].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-right text-xs text-slate-600 dark:text-haze-300 shrink-0 space-y-0.5">
          <p>{item.priorRejections} {item.priorRejections === 1 ? 'rechazo' : 'rechazos'}</p>
          <p>{item.priorSanctions} {item.priorSanctions === 1 ? 'sanción' : 'sanciones'}</p>
        </div>
      </div>

      {/* Resultado de los filtros */}
      <section className="space-y-3" aria-label="Resultado de los filtros">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-haze-400">Filtros automáticos</h4>

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="w-4 h-4" /> Texto
            <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${verdictStyle.cls}`}>
              <verdictStyle.Icon className="w-3.5 h-3.5" /> {verdictStyle.label}
            </span>
          </p>
          {item.textScan && item.textScan.hits.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {item.textScan.hits.map((h) => (
                <li key={`${h.term}-${h.category}`} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-white dark:bg-ink-850 border border-slate-900/10 dark:border-white/10 text-sm">
                  <span className="font-semibold">“{h.term}”</span>
                  <span className="text-slate-500 dark:text-haze-400">{HIT_CATEGORY[h.category]}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY[h.severity].cls}`}>{SEVERITY[h.severity].label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-haze-400">No se encontraron términos de la lista.</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><ImageIcon className="w-4 h-4" /> Imagen (SafeSearch)</p>
          <ImageScanPanel hasImage={!!item.imagePath} scan={item.imageScan} />
        </div>

        {item.reportCount > 0 && (
          <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 text-sm space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><Flag className="w-4 h-4" /> {item.reportCount} reportes de la comunidad</p>
            <p>{item.reportReasons.map((r) => REPORT_REASONS.find((x) => x.id === r)?.label ?? r).join(' · ')}</p>
            <p className="text-xs">Ya estaba publicada y volvió a revisión.</p>
          </div>
        )}
        {item.authorBanUntil && new Date(item.authorBanUntil) > new Date() && (
          <p className="text-sm text-slate-600 dark:text-haze-300">Esta persona tiene prohibido publicar hasta {new Date(item.authorBanUntil).toLocaleDateString('es-MX')}.</p>
        )}
        <p className="text-xs text-slate-500 dark:text-haze-400">Los filtros solo orientan. La decisión es tuya.</p>
      </section>

      {/* Decisión */}
      {!rejecting ? (
        <div className="flex gap-3">
          <button onClick={() => setRejecting(true)} disabled={busy} className={`${outlineBtn} flex-1 h-12`}>
            <X className="w-4 h-4" /> Rechazar
          </button>
          <button
            onClick={() => void approve()}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-mint text-slate-900 text-sm font-semibold shadow-sticker transition hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprobar
          </button>
        </div>
      ) : (
        <div className="space-y-4 pt-1 border-t border-slate-900/10 dark:border-white/10">
          <div>
            <label htmlFor={`note-${item.id}`} className={`${labelCls} flex justify-between pt-4`}>
              <span>Motivo (lo verá quien publicó)</span>
              <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{note.length}/300</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_REASONS.map((r) => (
                <button type="button" key={r} onClick={() => setNote((n) => (n ? `${n} ${r}` : r).slice(0, 300))} className="px-2.5 py-1 rounded-full text-xs bg-haze-100 dark:bg-ink-800 hover:bg-haze-200 dark:hover:bg-ink-700 transition-colors text-left">
                  + {r.replace(/\.$/, '')}
                </button>
              ))}
            </div>
            <textarea id={`note-${item.id}`} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="Explica por qué se rechaza" />
          </div>

          <fieldset className="space-y-2">
            <legend className={labelCls}>Sanción</legend>
            {SANCTIONS.filter((s) => !s.adminOnly || isAdmin).map((s) => (
              <label key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${sanction === s.id ? 'border-slate-900 dark:border-slate-50' : 'border-slate-900/10 dark:border-white/10'}`}>
                <input type="radio" name={`sanction-${item.id}`} checked={sanction === s.id} onChange={() => setSanction(s.id)} className="mt-1" />
                <span className="text-sm">
                  <span className="font-semibold block">{s.label}</span>
                  <span className="text-slate-500 dark:text-haze-400">{s.hint}</span>
                </span>
              </label>
            ))}
            {sanctionDef.days && (
              <div className="flex gap-2 items-center pt-1" role="radiogroup" aria-label="Duración en días">
                <span className="text-sm font-semibold">Duración:</span>
                {sanctionDef.days.map((d) => (
                  <button type="button" key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={chip(days === d)}>{d} días</button>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex gap-3">
            <button onClick={() => setRejecting(false)} disabled={busy} className={`${outlineBtn} h-12`}>Cancelar</button>
            <button
              onClick={() => void reject()}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {sanction === 'none' ? 'Rechazar' : 'Rechazar y sancionar'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export const ModerationQueue: React.FC = () => {
  const { user } = useAuthStore();
  const { queue, loadQueue } = useEventsStore();
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useNotice();

  useEffect(() => {
    void loadQueue().finally(() => setLoaded(true));
  }, [loadQueue]);

  if (!user || user.role === 'student') return null;
  if (!loaded && queue.length === 0) return <Spinner />;

  return (
    <div className="space-y-4">
      <NoticeBanner notice={notice} />
      {queue.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10">
          <span className="w-14 h-14 rounded-full bg-mint text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker"><ShieldCheck className="w-6 h-6" /></span>
          <h3 className="text-2xl font-semibold">Todo al día</h3>
          <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[30ch]">No hay publicaciones esperando revisión.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500 dark:text-haze-400">
            {queue.length} {queue.length === 1 ? 'publicación espera' : 'publicaciones esperan'} revisión. Primero las reportadas y las marcadas por el filtro.
          </p>
          {queue.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              isAdmin={user.role === 'admin'}
              onDone={(text) => setNotice({ kind: 'ok', text })}
              onError={(text) => setNotice({ kind: 'error', text })}
            />
          ))}
        </>
      )}
    </div>
  );
};
