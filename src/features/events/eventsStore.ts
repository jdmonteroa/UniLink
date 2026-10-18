import { create } from 'zustand';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { EVENT_BUCKET, photoUrl, removeStoredPhotos } from '@/lib/photos';
import { useAuthStore, type ActionResult } from '@/features/auth/authStore';

export const EVENT_CATEGORIES = [
  { id: 'mercadito', label: 'Mercadito' },
  { id: 'reunion', label: 'Reunión' },
  { id: 'academico', label: 'Académico' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'deportivo', label: 'Deportivo' },
  { id: 'aviso', label: 'Aviso' },
  { id: 'otro', label: 'Otro' },
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number]['id'];
export const eventCategoryLabel = (id: string) => EVENT_CATEGORIES.find((c) => c.id === id)?.label ?? 'Otro';

export type EventStatus = 'pending' | 'approved' | 'rejected';
/** A las 5 sanciones la cuenta se bloquea sola (lo aplica la base de datos). */
export const SANCTION_LIMIT = 5;
export type ReportReason = 'offensive' | 'sexual' | 'spam' | 'false' | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'offensive', label: 'Ofensivo o insultante' },
  { id: 'sexual', label: 'Contenido sexual' },
  { id: 'spam', label: 'Spam o estafa' },
  { id: 'false', label: 'Información falsa' },
  { id: 'other', label: 'Otro motivo' },
];

// ---------------------------------------------------------------------------
// Resultado de los filtros automáticos (lo ve quien modera)
// ---------------------------------------------------------------------------
export interface ScanHit {
  term: string;
  category: 'insult' | 'profanity' | 'sexual' | 'violence' | 'spam' | 'link';
  severity: 'low' | 'medium' | 'high';
}
export interface TextScan {
  verdict: 'clean' | 'review' | 'flagged';
  hits: ScanHit[];
}
export type Likelihood = 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY' | 'UNKNOWN';
/** Respuesta de Google SafeSearch guardada por la Edge Function (ver README). */
export interface ImageScan {
  status: 'pending' | 'done' | 'error';
  provider?: string;
  checked_at?: string;
  error?: string;
  adult?: Likelihood;
  violence?: Likelihood;
  racy?: Likelihood;
  spoof?: Likelihood;
  medical?: Likelihood;
}

const LEVEL: Record<string, number> = { VERY_UNLIKELY: 0, UNLIKELY: 1, POSSIBLE: 2, LIKELY: 3, VERY_LIKELY: 4 };
export const likelihoodLevel = (l?: string) => (l && l in LEVEL ? LEVEL[l] : -1);

/** Riesgo resumido de la imagen; 'none' si todavía no hay análisis. */
export function imageRisk(scan: ImageScan | null): 'none' | 'low' | 'medium' | 'high' {
  if (!scan || scan.status !== 'done') return 'none';
  const adult = likelihoodLevel(scan.adult);
  const violence = likelihoodLevel(scan.violence);
  const racy = likelihoodLevel(scan.racy);
  if (adult >= 3 || violence >= 3 || racy >= 4) return 'high';
  if (adult >= 2 || violence >= 2 || racy >= 3) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------
export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  startTime: string | null;
  imagePath: string | null;
  imageUrl: string;
  createdAt: string;
  authorName: string;
  isMine: boolean;
}

export interface MyEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  startTime: string | null;
  imagePath: string | null;
  imageUrl: string;
  status: EventStatus;
  reviewNote: string;
  createdAt: string;
  expiresAt: string;
}

export interface QueueItem {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  startTime: string | null;
  imagePath: string | null;
  imageUrl: string;
  createdAt: string;
  author: { id: string; name: string; career: string; semester: number | null; avatarUrl: string };
  textScan: TextScan | null;
  imageScan: ImageScan | null;
  reportCount: number;
  reportReasons: ReportReason[];
  priorRejections: number;
  /** Sanciones que ya tiene quien publicó (de SANCTION_LIMIT). */
  priorSanctions: number;
}

export interface EventInput {
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  /** Valor de <input type="datetime-local"> (hora local) o vacío si es un aviso sin fecha. */
  startLocal: string;
  imagePath: string | null;
}

export interface ReviewInput {
  decision: 'approve' | 'reject';
  note: string;
  /** Solo con 'reject': suma una sanción a quien publicó y le avisa por correo. */
  sanction?: boolean;
}

export function validateEventInput(input: EventInput): string | null {
  const title = input.title.trim();
  if (title.length < 3) return 'El título debe tener al menos 3 caracteres.';
  if (title.length > 80) return 'El título puede tener máximo 80 caracteres.';
  if (!input.description.trim() && !input.imagePath) return 'Agrega un texto, una imagen o ambos.';
  if (input.description.trim().length > 1000) return 'El texto puede tener máximo 1000 caracteres.';
  if (input.location.trim().length > 120) return 'El lugar puede tener máximo 120 caracteres.';
  if (input.startLocal && new Date(input.startLocal).getTime() < Date.now()) return 'La fecha del evento ya pasó.';
  return null;
}

// ---------------------------------------------------------------------------
// Filas de Supabase
// ---------------------------------------------------------------------------
const cat = (c: string): EventCategory => (EVENT_CATEGORIES.some((x) => x.id === c) ? (c as EventCategory) : 'otro');
const img = (path: string | null) => photoUrl(path, EVENT_BUCKET);

interface FeedRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  start_time: string | null;
  image_path: string | null;
  created_at: string;
  author_name: string;
  is_mine: boolean;
}
interface MineRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  start_time: string | null;
  image_path: string | null;
  status: EventStatus;
  review_note: string | null;
  created_at: string;
  expires_at: string;
}
interface QueueRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  start_time: string | null;
  image_path: string | null;
  created_at: string;
  author_id: string;
  author_name: string;
  author_career: string | null;
  author_semester: number | null;
  author_photo: string | null;
  text_scan: TextScan | null;
  image_scan: ImageScan | null;
  report_count: number;
  report_reasons: ReportReason[] | null;
  prior_rejections: number;
  prior_sanctions: number;
}

const mapFeed = (r: FeedRow): EventItem => ({
  id: r.id,
  title: r.title,
  description: r.description || '',
  category: cat(r.category),
  location: r.location || '',
  startTime: r.start_time,
  imagePath: r.image_path,
  imageUrl: img(r.image_path),
  createdAt: r.created_at,
  authorName: r.author_name,
  isMine: r.is_mine,
});

const mapMine = (r: MineRow): MyEvent => ({
  id: r.id,
  title: r.title,
  description: r.description || '',
  category: cat(r.category),
  location: r.location || '',
  startTime: r.start_time,
  imagePath: r.image_path,
  imageUrl: img(r.image_path),
  status: r.status,
  reviewNote: r.review_note || '',
  createdAt: r.created_at,
  expiresAt: r.expires_at,
});

const mapQueue = (r: QueueRow): QueueItem => ({
  id: r.id,
  title: r.title,
  description: r.description || '',
  category: cat(r.category),
  location: r.location || '',
  startTime: r.start_time,
  imagePath: r.image_path,
  imageUrl: img(r.image_path),
  createdAt: r.created_at,
  author: {
    id: r.author_id,
    name: r.author_name,
    career: r.author_career || '',
    semester: r.author_semester,
    avatarUrl: photoUrl(r.author_photo),
  },
  textScan: r.text_scan,
  imageScan: r.image_scan,
  reportCount: r.report_count,
  reportReasons: r.report_reasons || [],
  priorRejections: r.prior_rejections,
  priorSanctions: r.prior_sanctions,
});

// ---------------------------------------------------------------------------
// Modo demo (todo en memoria)
// ---------------------------------------------------------------------------
interface DemoDb {
  feed: EventItem[];
  mine: MyEvent[];
  queue: QueueItem[];
}
let demoDb: DemoDb | null = null;

const inDays = (d: number, hour = 12) => {
  const t = new Date(Date.now() + d * 86_400_000);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
};

function getDemoDb(): DemoDb {
  if (demoDb) return demoDb;
  const base = { imagePath: null, imageUrl: '' };
  const feed: EventItem[] = [
    { ...base, id: 'demo-ev-1', title: 'Mercadito de libros usados', description: 'Trae los libros que ya no uses y llévate otros a buen precio. También habrá café.', category: 'mercadito', location: 'Jardín central', startTime: inDays(2, 11), createdAt: inDays(-1), authorName: 'Sofía Álvarez', isMine: false },
    { ...base, id: 'demo-ev-2', title: 'Reunión del club de robótica', description: 'Presentamos el proyecto del semestre. Abierto a todas las carreras.', category: 'reunion', location: 'Aula 4-203', startTime: inDays(4, 17), createdAt: inDays(-2), authorName: 'Diego Ramírez', isMine: false },
    { ...base, id: 'demo-ev-3', title: 'La biblioteca cerrará temprano el viernes', description: 'Por mantenimiento eléctrico, cerrará a las 3:00 p. m.', category: 'aviso', location: '', startTime: null, createdAt: inDays(-1), authorName: 'Valeria Torres', isMine: false },
  ];
  const queue: QueueItem[] = [
    {
      id: 'demo-q-1',
      title: 'Fiesta en mi casa',
      description: 'Vengan todos, el que no venga es un pendejo. Más info en https://example.com/fiesta',
      category: 'otro',
      location: 'Col. Centro',
      startTime: inDays(5, 21),
      imagePath: null,
      imageUrl: '',
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      author: { id: 'demo-sofia', name: 'Marco Núñez', career: 'Ingeniería Biomédica', semester: 4, avatarUrl: '' },
      textScan: {
        verdict: 'flagged',
        hits: [
          { term: 'pendejo', category: 'insult', severity: 'high' },
          { term: 'enlace', category: 'link', severity: 'low' },
        ],
      },
      imageScan: { status: 'done', provider: 'google_safesearch', adult: 'VERY_UNLIKELY', violence: 'UNLIKELY', racy: 'POSSIBLE', spoof: 'UNLIKELY', medical: 'VERY_UNLIKELY' },
      reportCount: 0,
      reportReasons: [],
      priorRejections: 1,
      priorSanctions: 4,
    },
    {
      id: 'demo-q-2',
      title: 'Taller de primeros auxilios',
      description: 'Sábado de 10 a 13 h. Cupo limitado, trae ropa cómoda.',
      category: 'academico',
      location: 'Centro de Ciencias de la Salud',
      startTime: inDays(6, 10),
      imagePath: null,
      imageUrl: '',
      createdAt: new Date(Date.now() - 7_200_000).toISOString(),
      author: { id: 'demo-valeria', name: 'Valeria Torres', career: 'Médico Cirujano', semester: 3, avatarUrl: '' },
      textScan: { verdict: 'clean', hits: [] },
      imageScan: null,
      reportCount: 0,
      reportReasons: [],
      priorRejections: 0,
      priorSanctions: 0,
    },
  ];
  demoDb = { feed, mine: [], queue };
  return demoDb;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface EventsState {
  feed: EventItem[];
  mine: MyEvent[];
  queue: QueueItem[];
  /** Sanciones de quien consulta (para avisarle cuántas lleva). */
  mySanctions: number;
  ownerId: string | null;
  isLoading: boolean;
  error: string | null;

  loadFeed: () => Promise<void>;
  loadMine: () => Promise<void>;
  loadQueue: () => Promise<void>;
  submitEvent: (input: EventInput) => Promise<ActionResult>;
  deleteEvent: (id: string, imagePath: string | null) => Promise<ActionResult>;
  reportEvent: (id: string, reason: ReportReason) => Promise<ActionResult>;
  reviewEvent: (id: string, review: ReviewInput) => Promise<ActionResult>;
}

const auth = () => useAuthStore.getState();
const fail = (err: unknown, fallback: string): ActionResult => ({ success: false, message: friendlyError(err, fallback) });

export const useEventsStore = create<EventsState>((set, get) => ({
  feed: [],
  mine: [],
  queue: [],
  mySanctions: 0,
  ownerId: null,
  isLoading: false,
  error: null,

  loadFeed: async () => {
    const me = auth().user;
    if (!me) return;
    if (get().ownerId !== me.id) set({ feed: [], mine: [], queue: [], mySanctions: 0, ownerId: me.id });
    if (auth().isDemo) {
      set({ feed: getDemoDb().feed, isLoading: false, error: null });
      return;
    }
    if (get().feed.length === 0) set({ isLoading: true });
    const { data, error } = await supabase.rpc('list_events');
    if (error) {
      set({ isLoading: false, error: friendlyError(error, 'No se pudieron cargar los eventos.') });
      return;
    }
    set({ feed: ((data || []) as FeedRow[]).map(mapFeed), isLoading: false, error: null });
  },

  loadMine: async () => {
    if (!auth().user) return;
    if (auth().isDemo) {
      set({ mine: getDemoDb().mine });
      return;
    }
    const [events, sanctions] = await Promise.all([supabase.rpc('list_my_events'), supabase.rpc('my_sanction_count')]);
    if (events.error) {
      set({ error: friendlyError(events.error, 'No se pudieron cargar tus publicaciones.') });
      return;
    }
    set({
      mine: ((events.data || []) as MineRow[]).map(mapMine),
      mySanctions: typeof sanctions.data === 'number' ? sanctions.data : 0,
    });
  },

  loadQueue: async () => {
    const me = auth().user;
    if (!me || me.role === 'student') return;
    if (auth().isDemo) {
      set({ queue: getDemoDb().queue });
      return;
    }
    const { data, error } = await supabase.rpc('list_moderation_queue');
    if (error) {
      set({ error: friendlyError(error, 'No se pudo cargar la cola de moderación.') });
      return;
    }
    set({ queue: ((data || []) as QueueRow[]).map(mapQueue) });
  },

  submitEvent: async (input) => {
    const { user, isDemo } = auth();
    if (!user) return { success: false };
    const invalid = validateEventInput(input);
    if (invalid) return { success: false, message: invalid };
    const startIso = input.startLocal ? new Date(input.startLocal).toISOString() : null;

    if (isDemo) {
      const db = getDemoDb();
      const now = new Date().toISOString();
      const id = `demo-mine-${Date.now()}`;
      db.mine = [
        {
          id,
          title: input.title.trim(),
          description: input.description.trim(),
          category: input.category,
          location: input.location.trim(),
          startTime: startIso,
          imagePath: input.imagePath,
          imageUrl: input.imagePath || '',
          status: 'pending',
          reviewNote: '',
          createdAt: now,
          expiresAt: now,
        },
        ...db.mine,
      ];
      set({ mine: db.mine });
      return { success: true };
    }

    const { error } = await supabase.rpc('submit_event', {
      p_title: input.title.trim(),
      p_description: input.description.trim() || null,
      p_category: input.category,
      p_location: input.location.trim() || null,
      p_start: startIso,
      p_image_path: input.imagePath,
    });
    if (error) return fail(error, 'No se pudo enviar la publicación.');
    await get().loadMine();
    return { success: true };
  },

  deleteEvent: async (id, imagePath) => {
    if (auth().isDemo) {
      const db = getDemoDb();
      db.mine = db.mine.filter((e) => e.id !== id);
      db.feed = db.feed.filter((e) => e.id !== id);
      set({ mine: db.mine, feed: db.feed });
      return { success: true };
    }
    const { data, error } = await supabase.rpc('delete_event', { p_event: id });
    if (error) return fail(error, 'No se pudo eliminar.');
    const path = (typeof data === 'string' && data) || imagePath;
    if (path) void removeStoredPhotos([path], EVENT_BUCKET);
    set({ mine: get().mine.filter((e) => e.id !== id), feed: get().feed.filter((e) => e.id !== id) });
    return { success: true };
  },

  reportEvent: async (id, reason) => {
    if (auth().isDemo) return { success: true };
    const { error } = await supabase.rpc('report_event', { p_event: id, p_reason: reason });
    if (error) return fail(error, 'No se pudo enviar el reporte.');
    await get().loadFeed();
    return { success: true };
  },

  reviewEvent: async (id, review) => {
    if (auth().isDemo) {
      const db = getDemoDb();
      const item = db.queue.find((q) => q.id === id);
      db.queue = db.queue.filter((q) => q.id !== id);
      if (item && review.decision === 'approve') {
        db.feed = [
          { id: item.id, title: item.title, description: item.description, category: item.category, location: item.location, startTime: item.startTime, imagePath: item.imagePath, imageUrl: item.imageUrl, createdAt: item.createdAt, authorName: item.author.name, isMine: false },
          ...db.feed,
        ];
      }
      set({ queue: db.queue, feed: db.feed });
      return { success: true };
    }
    const { data, error } = await supabase.rpc('review_event', {
      p_event: id,
      p_decision: review.decision,
      p_note: review.note.trim() || null,
      p_sanction: review.sanction ?? false,
    });
    if (error) return fail(error, 'No se pudo guardar la decisión.');
    // Al rechazar se borra la imagen del almacenamiento (el moderador tiene permiso)
    if (typeof data === 'string' && data) void removeStoredPhotos([data], EVENT_BUCKET);
    set({ queue: get().queue.filter((q) => q.id !== id) });
    return { success: true };
  },
}));
