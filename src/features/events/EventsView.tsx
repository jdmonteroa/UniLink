import React, { useEffect, useRef, useState } from 'react';
import { Plus, ArrowLeft, ImagePlus, Loader2, CalendarDays, MapPin, Flag, Trash2, Clock, Check, XCircle, Info } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import {
  useEventsStore,
  EVENT_CATEGORIES,
  REPORT_REASONS,
  validateEventInput,
  type EventCategory,
  type EventItem,
  type MyEvent,
  type ReportReason,
} from '@/features/events/eventsStore';
import { EVENT_BUCKET, removeStoredPhotos, uploadProfilePhoto } from '@/lib/photos';
import { confirmDialog } from '@/components/ConfirmDialog';
import { Highlight } from '@/components/brand';
import { ModerationQueue } from '@/features/events/ModerationQueue';
import {
  CategoryBadge,
  EventThumb,
  NoticeBanner,
  Spinner,
  card,
  chip,
  formatWhen,
  iconBtn,
  inputCls,
  labelCls,
  outlineBtn,
  primaryBtn,
  useNotice,
} from '@/features/events/ui';

type Tab = 'feed' | 'mine' | 'queue';
type View = { kind: 'tabs' } | { kind: 'form' } | { kind: 'detail'; id: string };

// ---------------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------------
const EventCard: React.FC<{ event: EventItem; onOpen: () => void }> = ({ event, onOpen }) => (
  <button
    onClick={onOpen}
    className="w-full text-left flex items-center gap-3.5 p-3 rounded-2xl bg-white dark:bg-ink-850 shadow-soft-sm hover:-translate-y-0.5 active:scale-[0.99] transition"
  >
    <EventThumb title={event.title} category={event.category} imageUrl={event.imageUrl} className="w-16 h-16 rounded-2xl shrink-0 text-2xl" />
    <span className="min-w-0 flex-1 space-y-1">
      <CategoryBadge category={event.category} />
      <span className="block font-semibold leading-snug line-clamp-2">{event.title}</span>
      {event.startTime && <span className="block text-xs text-slate-500 dark:text-haze-400">{formatWhen(event.startTime)}</span>}
      {event.location && <span className="block text-xs text-slate-500 dark:text-haze-400 truncate">{event.location}</span>}
    </span>
  </button>
);

const STATUS_UI = {
  pending: { label: 'En revisión', cls: 'bg-sun/60 text-slate-900 dark:bg-sun/25 dark:text-slate-100', Icon: Clock },
  approved: { label: 'Publicado', cls: 'bg-mint/60 text-slate-900 dark:bg-mint/20 dark:text-slate-100', Icon: Check },
  rejected: { label: 'Rechazado', cls: 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-200', Icon: XCircle },
} as const;

const MyEventCard: React.FC<{ event: MyEvent; onDelete: () => void }> = ({ event, onDelete }) => {
  const s = STATUS_UI[event.status];
  return (
    <article className={`${card} space-y-3`}>
      <div className="flex items-start gap-3">
        <EventThumb title={event.title} category={event.category} imageUrl={event.imageUrl} className="w-14 h-14 rounded-2xl shrink-0 text-xl" />
        <div className="min-w-0 flex-1 space-y-1">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
            <s.Icon className="w-3.5 h-3.5" /> {s.label}
          </span>
          <h3 className="font-semibold leading-snug break-words">{event.title}</h3>
          {event.startTime && <p className="text-xs text-slate-500 dark:text-haze-400">{formatWhen(event.startTime)}</p>}
        </div>
        <button onClick={onDelete} className={`${iconBtn} hover:text-rose-600 shrink-0`} aria-label={`Eliminar ${event.title}`} title="Eliminar">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {event.status === 'pending' && <p className="text-sm text-slate-500 dark:text-haze-400">Un moderador la revisará antes de publicarla.</p>}
      {event.status === 'rejected' && (
        <p className="text-sm p-3 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200">
          <strong>Motivo:</strong> {event.reviewNote || 'No cumple con las reglas de la comunidad.'}
        </p>
      )}
    </article>
  );
};

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------
const EventDetail: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
  const { feed, reportEvent, deleteEvent } = useEventsStore();
  const event = feed.find((e) => e.id === id);
  const [notice, setNotice] = useNotice();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>('offensive');
  const [busy, setBusy] = useState(false);

  if (!event) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className={iconBtn} aria-label="Volver"><ArrowLeft className="w-5 h-5" /></button>
        <p className="text-sm text-slate-500 dark:text-haze-400">Esta publicación ya no está disponible.</p>
      </div>
    );
  }

  const sendReport = async () => {
    setBusy(true);
    const res = await reportEvent(id, reason);
    setBusy(false);
    if (res.success) {
      setReporting(false);
      setNotice({ kind: 'ok', text: 'Gracias, un moderador la revisará.' });
    } else setNotice({ kind: 'error', text: res.message || 'No se pudo enviar el reporte.' });
  };

  const remove = async () => {
    const ok = await confirmDialog({ title: '¿Eliminar esta publicación?', message: 'Dejará de verse para todos.', confirmLabel: 'Eliminar', tone: 'danger' });
    if (!ok) return;
    const res = await deleteEvent(id, event.imagePath);
    if (res.success) onBack();
    else setNotice({ kind: 'error', text: res.message || 'No se pudo eliminar.' });
  };

  return (
    <div className="space-y-4 pb-6">
      <button onClick={onBack} className={iconBtn} aria-label="Volver a eventos"><ArrowLeft className="w-5 h-5" /></button>
      {event.imageUrl && <img src={event.imageUrl} alt="" className="w-full max-h-96 object-contain rounded-3xl bg-haze-100 dark:bg-ink-800" />}
      <div className="space-y-2">
        <CategoryBadge category={event.category} />
        <h2 className="text-3xl font-semibold leading-tight break-words">{event.title}</h2>
        <p className="text-sm text-slate-600 dark:text-haze-300 flex flex-wrap gap-x-4 gap-y-1">
          {event.startTime && <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{formatWhen(event.startTime)}</span>}
          {event.location && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.location}</span>}
        </p>
        {event.description && <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words pt-1">{event.description}</p>}
        <p className="text-xs text-slate-500 dark:text-haze-400 pt-1">Publicado por {event.isMine ? 'ti' : event.authorName}</p>
      </div>

      <NoticeBanner notice={notice} />

      {event.isMine ? (
        <button onClick={() => void remove()} className={`${outlineBtn} w-full text-rose-700 dark:text-rose-400`}><Trash2 className="w-4 h-4" /> Eliminar publicación</button>
      ) : reporting ? (
        <div className={card}>
          <fieldset className="space-y-2">
            <legend className={labelCls}>¿Por qué la reportas?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.id} className="flex items-center gap-3 text-sm cursor-pointer">
                <input type="radio" name="report-reason" checked={reason === r.id} onChange={() => setReason(r.id)} /> {r.label}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-3">
            <button onClick={() => setReporting(false)} className={outlineBtn}>Cancelar</button>
            <button onClick={() => void sendReport()} disabled={busy} className={`${primaryBtn} flex-1`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Enviar reporte
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setReporting(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-haze-400 hover:text-rose-600 transition">
          <Flag className="w-4 h-4" /> Reportar publicación
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------------
const MAX_TEXT = 1000;

const EventForm: React.FC<{ onDone: () => void; onCancel: () => void }> = ({ onDone, onCancel }) => {
  const { user, isDemo } = useAuthStore();
  const submitEvent = useEventsStore((s) => s.submitEvent);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('reunion');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useNotice();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploaded = useRef<string[]>([]); // para no dejar archivos huérfanos al cancelar

  if (!user) return null;

  const discard = (keep: string | null) => {
    if (isDemo) return;
    const orphans = uploaded.current.filter((p) => p !== keep);
    if (orphans.length) void removeStoredPhotos(orphans, EVENT_BUCKET);
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = isDemo ? URL.createObjectURL(file) : await uploadProfilePhoto(user.id, file, EVENT_BUCKET);
      uploaded.current.push(path);
      setImagePath(path);
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'No se pudo subir la imagen.' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const input = { title, description, category, location, startLocal, imagePath };
  const problem = validateEventInput(input);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) {
      setNotice({ kind: 'error', text: problem });
      return;
    }
    setSaving(true);
    const res = await submitEvent(input);
    setSaving(false);
    if (!res.success) {
      setNotice({ kind: 'error', text: res.message || 'No se pudo enviar la publicación.' });
      return;
    }
    discard(imagePath);
    onDone();
  };

  const cancel = () => {
    discard(null);
    onCancel();
  };

  return (
    <form onSubmit={submit} className="space-y-5 pb-6">
      <div className="flex items-center gap-2">
        <button type="button" onClick={cancel} className={iconBtn} aria-label="Cancelar"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="text-3xl font-semibold leading-none">Nueva publicación</h2>
      </div>

      <p className="flex gap-2 p-3 rounded-xl bg-sun/30 dark:bg-sun/10 text-sm text-slate-800 dark:text-slate-200">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Un moderador la revisará antes de que se publique. Evita insultos, contenido sexual y spam.</span>
      </p>

      <NoticeBanner notice={notice} />

      <div>
        <label htmlFor="ev-title" className={`${labelCls} flex justify-between`}>
          <span>Título</span>
          <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{title.length}/80</span>
        </label>
        <input id="ev-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Mercadito de libros usados" className={inputCls} required />
      </div>

      <div>
        <span className={labelCls}>Tipo</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de publicación">
          {EVENT_CATEGORIES.map((c) => (
            <button type="button" key={c.id} role="radio" aria-checked={category === c.id} onClick={() => setCategory(c.id)} className={chip(category === c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="ev-desc" className={`${labelCls} flex justify-between`}>
          <span>Texto <span className="font-normal text-slate-500 dark:text-haze-400">(opcional si agregas imagen)</span></span>
          <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{description.length}/{MAX_TEXT}</span>
        </label>
        <textarea id="ev-desc" rows={4} maxLength={MAX_TEXT} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="De qué trata, quién puede ir, qué llevar…" className={inputCls} />
      </div>

      <div className="flex items-center gap-4">
        <EventThumb title={title || 'E'} category={category} imageUrl={imagePath || ''} className="w-24 h-24 rounded-3xl text-3xl shrink-0" />
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pickImage(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={outlineBtn}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {imagePath ? 'Cambiar imagen' : 'Agregar imagen'}
          </button>
          {imagePath && (
            <button
              type="button"
              onClick={() => {
                discard(null);
                uploaded.current = [];
                setImagePath(null);
              }}
              className="block text-sm font-semibold text-slate-500 dark:text-haze-400 hover:text-rose-600"
            >
              Quitar imagen
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label htmlFor="ev-when" className={labelCls}>Fecha y hora <span className="font-normal text-slate-500 dark:text-haze-400">(déjala vacía si es un aviso)</span></label>
          <input id="ev-when" type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ev-where" className={labelCls}>Lugar <span className="font-normal text-slate-500 dark:text-haze-400">(opcional)</span></label>
          <input id="ev-where" value={location} maxLength={120} onChange={(e) => setLocation(e.target.value)} placeholder="Ej. Jardín central, aula 4-203" className={inputCls} />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={cancel} className={`${outlineBtn} h-12`}>Cancelar</button>
        <button type="submit" disabled={saving || uploading} className={`${primaryBtn} flex-1`}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enviar a revisión
        </button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Contenedor
// ---------------------------------------------------------------------------
export const EventsView: React.FC = () => {
  const { user } = useAuthStore();
  const { feed, mine, queue, isLoading, error, loadFeed, loadMine, deleteEvent } = useEventsStore();
  const [view, setView] = useState<View>({ kind: 'tabs' });
  const [tab, setTab] = useState<Tab>('feed');
  const [notice, setNotice] = useNotice();
  const topRef = useRef<HTMLDivElement>(null);
  const isModerator = !!user && user.role !== 'student';

  useEffect(() => {
    void loadFeed();
    void loadMine();
  }, [loadFeed, loadMine]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [view.kind]);

  const upcoming = feed.filter((e) => e.startTime);
  const notices = feed.filter((e) => !e.startTime);

  const removeMine = async (e: MyEvent) => {
    const ok = await confirmDialog({ title: '¿Eliminar esta publicación?', message: e.status === 'approved' ? 'Dejará de verse para todos.' : undefined, confirmLabel: 'Eliminar', tone: 'danger' });
    if (!ok) return;
    const res = await deleteEvent(e.id, e.imagePath);
    if (!res.success) setNotice({ kind: 'error', text: res.message || 'No se pudo eliminar.' });
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'feed', label: 'Eventos' },
    { id: 'mine', label: 'Mis publicaciones' },
    ...(isModerator ? [{ id: 'queue' as const, label: 'Moderación', count: queue.length }] : []),
  ];

  return (
    <div ref={topRef} className="max-w-md w-full mx-auto scroll-mt-4">
      {view.kind === 'form' && (
        <EventForm
          onCancel={() => setView({ kind: 'tabs' })}
          onDone={() => {
            setTab('mine');
            setView({ kind: 'tabs' });
            setNotice({ kind: 'ok', text: 'Enviada. Aquí verás si un moderador la aprueba o la rechaza.' });
          }}
        />
      )}

      {view.kind === 'detail' && <EventDetail id={view.id} onBack={() => setView({ kind: 'tabs' })} />}

      {view.kind === 'tabs' && (
        <div className="space-y-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-4xl font-semibold leading-none"><Highlight>Eventos</Highlight></h2>
              <p className="text-sm text-slate-500 dark:text-haze-400 mt-3">Avisos y actividades de tu universidad.</p>
            </div>
            <button onClick={() => setView({ kind: 'form' })} className={`${primaryBtn} h-11 px-4 shrink-0`}><Plus className="w-4 h-4" /> Publicar</button>
          </div>

          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 inline-flex items-center gap-1.5 ${chip(tab === t.id)}`}>
                {t.label}
                {!!t.count && <span className="px-1.5 rounded-full bg-brand-600 text-white text-[10px] leading-4">{t.count}</span>}
              </button>
            ))}
          </div>

          <NoticeBanner notice={notice} />
          {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}

          {tab === 'feed' &&
            (isLoading && feed.length === 0 ? (
              <Spinner />
            ) : feed.length === 0 ? (
              <div className="flex flex-col items-center text-center gap-4 px-6 py-12 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10">
                <span className="w-16 h-16 rounded-full bg-sun text-slate-900 flex items-center justify-center rotate-6 shadow-sticker"><CalendarDays className="w-7 h-7" /></span>
                <h3 className="text-2xl font-semibold">Aún no hay eventos</h3>
                <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[30ch]">Publica el primero: un mercadito, una reunión o un aviso.</p>
                <button onClick={() => setView({ kind: 'form' })} className={primaryBtn}>Publicar</button>
              </div>
            ) : (
              <>
                {upcoming.length > 0 && (
                  <section className="space-y-2.5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-haze-400">Próximos</h3>
                    {upcoming.map((e) => <EventCard key={e.id} event={e} onOpen={() => setView({ kind: 'detail', id: e.id })} />)}
                  </section>
                )}
                {notices.length > 0 && (
                  <section className="space-y-2.5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-haze-400">Avisos</h3>
                    {notices.map((e) => <EventCard key={e.id} event={e} onOpen={() => setView({ kind: 'detail', id: e.id })} />)}
                  </section>
                )}
              </>
            ))}

          {tab === 'mine' &&
            (mine.length === 0 ? (
              <p className="text-center text-sm text-slate-500 dark:text-haze-400 py-10">Todavía no has publicado nada.</p>
            ) : (
              <div className="space-y-3">{mine.map((e) => <MyEventCard key={e.id} event={e} onDelete={() => void removeMine(e)} />)}</div>
            ))}

          {tab === 'queue' && isModerator && <ModerationQueue />}
        </div>
      )}
    </div>
  );
};
