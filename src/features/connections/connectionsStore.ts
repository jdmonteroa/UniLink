import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { photoUrl } from '@/lib/photos';
import { useAuthStore, type ActionResult, type ConnectionModeKey } from '@/features/auth/authStore';

export type ReportReason = 'harassment' | 'sexual_content' | 'fake_profile' | 'spam' | 'other';

/** Los mensajes del chat se borran a las 24 horas. */
export const CHAT_TTL_HOURS = 24;
export const MESSAGE_MAX = 500;

/** Máximo de rondas de replanteamiento por propuesta (lo aplica la base de datos). */
export const MAX_ROUNDS = 3;
export const NOTE_MIN = 5;
export const NOTE_MAX = 200;

export type MeetupStatus = 'pending' | 'accepted' | 'declined' | 'rescheduled' | 'cancelled' | 'expired';

export interface Meetup {
  id: string;
  status: MeetupStatus;
  proposedByMe: boolean;
  place: string;
  when: string;
  round: number;
  note: string;
  responseNote: string;
  updatedAt: string;
}

export interface Connection {
  matchId: string;
  mode: ConnectionModeKey;
  matchedAt: string;
  other: {
    id: string;
    name: string;
    career: string;
    campus: string;
    semester: number | null;
    bio: string;
    avatarUrl: string;
    /** Solo llega cuando hay un encuentro aceptado. */
    instagram: string;
    verified: boolean;
    interests: string[];
  };
  /** La propuesta más reciente (puede estar cerrada: rechazada, vencida…). */
  meetup: Meetup | null;
  /** Punto rojo: algo espera tu respuesta o te enteras de una respuesta nueva. */
  needsAttention: boolean;
  /** Chat temporal del match (los mensajes duran 24 h). */
  conversationId: string | null;
  lastMessage: string;
  lastMessageAt: string | null;
  lastSenderId: string | null;
  unreadCount: number;
}

/** Alguien a quien ya le mostraste interés y todavía no hay match. */
export interface SentInterest {
  id: string;
  mode: ConnectionModeKey;
  name: string;
  career: string;
  campus: string;
  semester: number | null;
  avatarUrl: string;
  verified: boolean;
  likedAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  proposerId: string;
  place: string;
  when: string;
  note: string;
  status: MeetupStatus;
  round: number;
  responseNote: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface MeetupInput {
  place: string;
  /** Valor de <input type="datetime-local"> (hora local). */
  whenLocal: string;
  note: string;
}

/** Valida lugar, hora y mensaje igual que la base de datos (para avisar antes de enviar). */
export function validateMeetupInput(input: MeetupInput, { placeOptional = false }: { placeOptional?: boolean } = {}): string | null {
  const place = input.place.trim();
  if (!placeOptional && (place.length < 3 || place.length > 80)) return 'Escribe el lugar de la escuela donde se verán (3 a 80 caracteres).';
  if (place && place.length > 80) return 'El lugar puede tener máximo 80 caracteres.';
  if (!input.whenLocal) return 'Elige la fecha y la hora.';
  const when = new Date(input.whenLocal).getTime();
  if (Number.isNaN(when) || when < Date.now() + 15 * 60_000) return 'Elige una fecha y hora que todavía no haya pasado (con al menos 15 minutos de margen).';
  if (when > Date.now() + 60 * 86_400_000) return 'Elige una fecha dentro de los próximos 60 días.';
  const note = input.note.trim();
  if (note.length < NOTE_MIN) return `Escribe un mensaje para la otra persona (mínimo ${NOTE_MIN} caracteres).`;
  if (note.length > NOTE_MAX) return `El mensaje puede tener máximo ${NOTE_MAX} caracteres.`;
  return null;
}

// ---------------------------------------------------------------------------
// Filas de Supabase
// ---------------------------------------------------------------------------
interface ConnectionRow {
  match_id: string;
  mode: string;
  matched_at: string;
  other_id: string;
  other_name: string;
  other_career: string | null;
  other_campus: string | null;
  other_semester: number | null;
  other_bio: string | null;
  other_photo: string | null;
  other_instagram: string | null;
  other_verified: boolean;
  other_interests: string[] | null;
  meetup_id: string | null;
  meetup_status: MeetupStatus | null;
  meetup_proposer_is_me: boolean | null;
  meetup_place: string | null;
  meetup_when: string | null;
  meetup_round: number | null;
  meetup_note: string | null;
  meetup_response_note: string | null;
  meetup_updated_at: string | null;
  needs_attention: boolean;
  conversation_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  unread_count: number | null;
}

interface SentInterestRow {
  profile_id: string;
  mode: string;
  liked_at: string;
  full_name: string;
  career_name: string | null;
  campus_name: string | null;
  semester: number | null;
  photo: string | null;
  is_photo_verified: boolean;
}

interface MessageRow {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface HistoryRow {
  id: string;
  proposer_id: string;
  place: string;
  when_at: string;
  note: string;
  status: MeetupStatus;
  round: number;
  response_note: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

const mapConnection = (r: ConnectionRow): Connection => ({
  matchId: r.match_id,
  // Los matches viejos del modo Estudio (ya eliminado) se muestran como Amistades
  mode: r.mode === 'dating' ? 'dating' : 'friendship',
  matchedAt: r.matched_at,
  other: {
    id: r.other_id,
    name: r.other_name,
    career: r.other_career || '',
    campus: r.other_campus || '',
    semester: r.other_semester,
    bio: r.other_bio || '',
    avatarUrl: photoUrl(r.other_photo),
    instagram: r.other_instagram || '',
    verified: r.other_verified,
    interests: r.other_interests || [],
  },
  meetup: r.meetup_id
    ? {
        id: r.meetup_id,
        status: r.meetup_status as MeetupStatus,
        proposedByMe: Boolean(r.meetup_proposer_is_me),
        place: r.meetup_place || '',
        when: r.meetup_when || '',
        round: r.meetup_round || 1,
        note: r.meetup_note || '',
        responseNote: r.meetup_response_note || '',
        updatedAt: r.meetup_updated_at || '',
      }
    : null,
  needsAttention: r.needs_attention,
  conversationId: r.conversation_id,
  lastMessage: r.last_message || '',
  lastMessageAt: r.last_message_at,
  lastSenderId: r.last_sender_id,
  unreadCount: r.unread_count || 0,
});

const mapInterest = (r: SentInterestRow): SentInterest => ({
  id: r.profile_id,
  mode: r.mode === 'dating' ? 'dating' : 'friendship',
  name: r.full_name,
  career: r.career_name || '',
  campus: r.campus_name || '',
  semester: r.semester,
  avatarUrl: photoUrl(r.photo),
  verified: r.is_photo_verified,
  likedAt: r.liked_at,
});

const mapMessage = (r: MessageRow): ChatMessage => ({ id: r.id, senderId: r.sender_id, content: r.content, createdAt: r.created_at });
const isFresh = (iso: string) => Date.now() - new Date(iso).getTime() < CHAT_TTL_HOURS * 3_600_000;

const mapHistory = (r: HistoryRow): HistoryItem => ({
  id: r.id,
  proposerId: r.proposer_id,
  place: r.place,
  when: r.when_at,
  note: r.note,
  status: r.status,
  round: r.round,
  responseNote: r.response_note || '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  updatedBy: r.updated_by,
});

// ---------------------------------------------------------------------------
// Modo demo (todo en memoria)
// ---------------------------------------------------------------------------
interface DemoDb {
  connections: Connection[];
  history: Record<string, HistoryItem[]>;
  messages: Record<string, ChatMessage[]>;
  interests: SentInterest[];
}
let demoDb: DemoDb | null = null;

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

function getDemoDb(): DemoDb {
  if (demoDb) return demoDb;
  const person = (id: string, name: string, career: string, campus: string, semester: number, bio: string, interests: string[], photo: string, verified = true) => ({
    id, name, career, campus, semester, bio, interests, avatarUrl: photo, verified, instagram: '',
  });
  const sofia = person('demo-sofia', 'Sofía Álvarez', 'Licenciatura en Diseño Gráfico', 'Campus Central UAA', 4, 'Diseño, café y cineclub. Busco con quién ir a exposiciones.', ['Fotografía 35mm', 'Cineclub', 'Café de Especialidad', 'Música Indie'], 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80');
  const diego = person('demo-diego', 'Diego Ramírez', 'Ingeniería en Sistemas Computacionales', 'Campus Central UAA', 6, 'Proyectos de IA y ajedrez en el receso.', ['Programación', 'Ajedrez', 'Videojuegos'], 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80');
  const valeria = person('demo-valeria', 'Valeria Torres', 'Médico Cirujano', 'Campus Central UAA', 3, 'Medicina, tercer semestre. Voluntaria en la Cruz Roja.', ['Voluntariado', 'Lectura', 'Cocinar'], 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=300&q=80');
  const emilio = person('demo-emilio', 'Emilio Torres', 'Licenciatura en Diseño Gráfico', 'Campus Sur UAA', 7, 'Fotógrafo de conciertos.', ['Fotografía 35mm', 'Música Indie', 'Tocar Guitarra'], 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80');

  const mk = (id: string, mode: ConnectionModeKey, other: Connection['other'], meetup: Meetup | null, needsAttention: boolean): Connection => ({
    matchId: id, mode, matchedAt: inHours(-30), other, meetup, needsAttention,
    conversationId: `conv-${id}`, lastMessage: '', lastMessageAt: null, lastSenderId: null, unreadCount: 0,
  });
  const pendingFromThem: Meetup = {
    id: 'demo-mt-1', status: 'pending', proposedByMe: false, place: 'Cafetería de Diseño', when: inHours(26), round: 1,
    note: 'Hola, vi que también te gusta el cineclub. ¿Te late un café y platicamos de pelis?', responseNote: '', updatedAt: inHours(-2),
  };
  const accepted: Meetup = {
    id: 'demo-mt-2', status: 'accepted', proposedByMe: true, place: 'Infoteca, mesas de la planta baja', when: inHours(50), round: 2,
    note: 'Repasamos Estructura de Datos antes del parcial?', responseNote: '', updatedAt: inHours(-5),
  };
  const ago = (h: number) => inHours(-h);
  const interest = (id: string, name: string, career: string, campus: string, semester: number, photo: string): SentInterest => ({
    id, mode: 'friendship', name, career, campus, semester, avatarUrl: photo, verified: true, likedAt: ago(5),
  });
  demoDb = {
    interests: [
      interest('demo-leo', 'Leonardo Campos', 'Ingeniería en Sistemas Computacionales', 'Campus Sur', 9, 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80'),
      interest('demo-ximena', 'Ximena Reyes', 'Médico Cirujano', 'Campus Central', 3, 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=300&q=80'),
    ],
    messages: {
      'demo-m1': [
        { id: 'dm-1', senderId: 'demo-sofia', content: '¡Hola! Vi que también vas al cineclub 🎬', createdAt: ago(3) },
        { id: 'dm-2', senderId: 'demo-user', content: 'Sí, voy casi todos los jueves. ¿Tú?', createdAt: ago(2.5) },
        { id: 'dm-3', senderId: 'demo-sofia', content: 'Yo también, nos vemos ahí entonces', createdAt: ago(1) },
      ],
    },
    connections: [
      { ...mk('demo-m1', 'friendship', sofia, pendingFromThem, true), lastMessage: 'Yo también, nos vemos ahí entonces', lastMessageAt: ago(1), lastSenderId: 'demo-sofia', unreadCount: 1 },
      mk('demo-m2', 'friendship', { ...diego, instagram: 'diego_ramirez' }, { ...accepted }, true),
      mk('demo-m3', 'friendship', valeria, null, false),
      mk('demo-m4', 'dating', emilio, null, false),
    ],
    history: {
      'demo-m1': [{ id: 'demo-mt-1', proposerId: 'demo-sofia', place: pendingFromThem.place, when: pendingFromThem.when, note: pendingFromThem.note, status: 'pending', round: 1, responseNote: '', createdAt: inHours(-2), updatedAt: inHours(-2), updatedBy: 'demo-sofia' }],
      'demo-m2': [
        { id: 'demo-mt-2', proposerId: 'demo-user', place: accepted.place, when: accepted.when, note: accepted.note, status: 'accepted', round: 2, responseNote: '', createdAt: inHours(-8), updatedAt: inHours(-5), updatedBy: 'demo-diego' },
        { id: 'demo-mt-2a', proposerId: 'demo-diego', place: 'Biblioteca', when: inHours(30), note: 'Mejor en la biblioteca mañana, hoy salgo tarde.', status: 'rescheduled', round: 1, responseNote: '', createdAt: inHours(-12), updatedAt: inHours(-8), updatedBy: 'demo-user' },
      ],
    },
  };
  return demoDb;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface ConnectionsState {
  connections: Connection[];
  ownerId: string | null;
  isLoading: boolean;
  error: string | null;
  /** Match que debe abrirse al entrar a la pestaña (p. ej. desde "¡Hay match!"). */
  openMatchId: string | null;

  loadConnections: () => Promise<void>;
  loadHistory: (matchId: string) => Promise<HistoryItem[]>;
  markSeen: (matchId: string) => Promise<void>;
  propose: (matchId: string, input: MeetupInput) => Promise<ActionResult>;
  respond: (meetupId: string, action: 'accept' | 'decline' | 'reschedule', input?: Partial<MeetupInput>) => Promise<ActionResult>;
  cancel: (meetupId: string, note?: string) => Promise<ActionResult>;
  /** Personas a las que ya les mostraste interés (todavía sin match). */
  sentInterests: SentInterest[];
  loadSentInterests: () => Promise<void>;
  addDemoInterest: (item: SentInterest) => void;
  withdrawInterest: (item: SentInterest) => Promise<ActionResult>;
  unmatch: (matchId: string) => Promise<ActionResult>;
  block: (connection: Connection) => Promise<ActionResult>;
  report: (connection: Connection, reason: ReportReason, description: string) => Promise<ActionResult>;
  setOpenMatchId: (id: string | null) => void;
  /** Mensajes de las últimas 24 h, por conversación. */
  messages: Record<string, ChatMessage[]>;
  loadMessages: (connection: Connection) => Promise<void>;
  sendMessage: (connection: Connection, content: string) => Promise<ActionResult>;
  markChatRead: (connection: Connection) => Promise<void>;
  reset: () => void;
}

const auth = () => useAuthStore.getState();
const fail = (err: unknown, fallback: string): ActionResult => ({ success: false, message: friendlyError(err, fallback) });
const toIso = (local: string) => new Date(local).toISOString();

let channel: RealtimeChannel | null = null;
let chatChannel: RealtimeChannel | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

function stopRealtime() {
  if (chatChannel) void supabase.removeChannel(chatChannel);
  chatChannel = null;
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = null;
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => {
  const patchDemo = (matchId: string, patch: Partial<Connection>) => {
    const db = getDemoDb();
    db.connections = db.connections.map((c) => (c.matchId === matchId ? { ...c, ...patch } : c));
    set({ connections: db.connections });
  };
  const demoPush = (matchId: string, item: HistoryItem) => {
    const db = getDemoDb();
    db.history[matchId] = [item, ...(db.history[matchId] ?? [])];
  };
  const demoSetStatus = (matchId: string, id: string, status: MeetupStatus, responseNote = '') => {
    const db = getDemoDb();
    db.history[matchId] = (db.history[matchId] ?? []).map((h) => (h.id === id ? { ...h, status, responseNote, updatedAt: new Date().toISOString(), updatedBy: 'demo-user' } : h));
  };
  const findByMeetup = (meetupId: string) => get().connections.find((c) => c.meetup?.id === meetupId);

  return {
    connections: [],
    sentInterests: [],
    messages: {},
    ownerId: null,
    isLoading: false,
    error: null,
    openMatchId: null,

    setOpenMatchId: (id) => set({ openMatchId: id }),

    reset: () => {
      stopRealtime();
      demoDb = null;
      set({ connections: [], sentInterests: [], messages: {}, ownerId: null, isLoading: false, error: null, openMatchId: null });
    },

    loadConnections: async () => {
      const me = auth().user;
      if (!me) return;
      if (get().ownerId !== me.id) set({ connections: [], ownerId: me.id });
      if (auth().isDemo) {
        set({ connections: getDemoDb().connections, isLoading: false, error: null });
        return;
      }
      if (get().connections.length === 0) set({ isLoading: true });
      const { data, error } = await supabase.rpc('get_my_connections');
      if (error) {
        set({ isLoading: false, error: friendlyError(error, 'No se pudieron cargar tus matches.') });
        return;
      }
      set({ connections: ((data || []) as ConnectionRow[]).map(mapConnection), isLoading: false, error: null });
      void get().loadSentInterests();

      // En vivo: cuando cambia un encuentro mío, se vuelve a cargar (el punto rojo aparece solo)
      if (!channel) {
        channel = supabase
          .channel('meetups-inbox')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'meetups' }, () => {
            if (reloadTimer) clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => void get().loadConnections(), 400);
          })
          .subscribe();
      }
      // Mensajes nuevos: se agregan al chat abierto y se refresca la lista (vista previa y no leídos)
      if (!chatChannel) {
        chatChannel = supabase
          .channel('chat-inbox')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const row = payload.new as MessageRow & { conversation_id: string };
            const list = get().messages[row.conversation_id];
            if (list && !list.some((m) => m.id === row.id)) {
              set({ messages: { ...get().messages, [row.conversation_id]: [...list, mapMessage(row)] } });
            }
            if (reloadTimer) clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => void get().loadConnections(), 400);
          })
          .subscribe();
      }
    },

    loadMessages: async (connection) => {
      const convId = connection.conversationId;
      if (!convId) return;
      if (auth().isDemo) {
        const db = getDemoDb();
        const fresh = (db.messages[connection.matchId] ?? []).filter((m) => isFresh(m.createdAt));
        set({ messages: { ...get().messages, [convId]: fresh } });
        return;
      }
      const since = new Date(Date.now() - CHAT_TTL_HOURS * 3_600_000).toISOString();
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('conversation_id', convId)
        .gt('created_at', since)
        .order('created_at', { ascending: true })
        .limit(300);
      set({ messages: { ...get().messages, [convId]: ((data || []) as MessageRow[]).map(mapMessage) } });
    },

    sendMessage: async (connection, raw) => {
      const { user, isDemo } = auth();
      const content = raw.trim();
      const convId = connection.conversationId;
      if (!user || !convId || !content) return { success: false };
      if (content.length > MESSAGE_MAX) return { success: false, message: `El mensaje puede tener máximo ${MESSAGE_MAX} caracteres.` };
      let msg: ChatMessage;
      if (isDemo) {
        msg = { id: `dm-${Date.now()}`, senderId: user.id, content, createdAt: new Date().toISOString() };
        const db = getDemoDb();
        db.messages[connection.matchId] = [...(db.messages[connection.matchId] ?? []), msg];
      } else {
        const { data, error } = await supabase
          .from('messages')
          .insert({ conversation_id: convId, sender_id: user.id, content })
          .select('id, sender_id, content, created_at');
        if (error) return fail(error, 'No se pudo enviar el mensaje.');
        // El filtro de moderación descarta el mensaje sin error: no vuelve ninguna fila
        if (!data || data.length === 0) return { success: false, message: 'Tu mensaje no se envió porque contiene lenguaje que va contra el código de conducta.' };
        msg = mapMessage(data[0] as MessageRow);
      }
      const list = get().messages[convId] ?? [];
      const connections = get().connections.map((c) => (c.matchId === connection.matchId
        ? { ...c, lastMessage: msg.content, lastMessageAt: msg.createdAt, lastSenderId: user.id }
        : c));
      set({ messages: { ...get().messages, [convId]: list.some((m) => m.id === msg.id) ? list : [...list, msg] }, connections });
      if (isDemo) getDemoDb().connections = connections;
      return { success: true };
    },

    markChatRead: async (connection) => {
      if (!connection.conversationId || connection.unreadCount === 0) return;
      const patch = (c: Connection) => (c.matchId === connection.matchId ? { ...c, unreadCount: 0, needsAttention: c.meetup?.status === 'pending' && !c.meetup.proposedByMe } : c);
      if (auth().isDemo) {
        const db = getDemoDb();
        db.connections = db.connections.map(patch);
        set({ connections: db.connections });
        return;
      }
      await supabase.rpc('mark_conversation_read', { p_conversation_id: connection.conversationId });
      await get().loadConnections();
    },

    loadHistory: async (matchId) => {
      if (auth().isDemo) return getDemoDb().history[matchId] ?? [];
      const { data, error } = await supabase.rpc('get_match_meetups', { p_match: matchId });
      if (error) throw new Error(friendlyError(error, 'No se pudo cargar el historial.'));
      return ((data || []) as HistoryRow[]).map(mapHistory);
    },

    markSeen: async (matchId) => {
      if (auth().isDemo) {
        const c = get().connections.find((x) => x.matchId === matchId);
        // Lo que espera tu respuesta conserva el punto rojo hasta que respondas
        if (c) patchDemo(matchId, { needsAttention: c.meetup?.status === 'pending' && !c.meetup.proposedByMe });
        return;
      }
      await supabase.rpc('mark_match_seen', { p_match: matchId });
      await get().loadConnections();
    },

    propose: async (matchId, input) => {
      const { user, isDemo } = auth();
      if (!user) return { success: false };
      const invalid = validateMeetupInput(input);
      if (invalid) return { success: false, message: invalid };

      if (isDemo) {
        const now = new Date().toISOString();
        const id = `demo-mt-${Date.now()}`;
        const meetup: Meetup = { id, status: 'pending', proposedByMe: true, place: input.place.trim(), when: toIso(input.whenLocal), round: 1, note: input.note.trim(), responseNote: '', updatedAt: now };
        demoPush(matchId, { id, proposerId: user.id, place: meetup.place, when: meetup.when, note: meetup.note, status: 'pending', round: 1, responseNote: '', createdAt: now, updatedAt: now, updatedBy: user.id });
        patchDemo(matchId, { meetup, needsAttention: false });
        return { success: true };
      }
      const { error } = await supabase.rpc('propose_meetup', {
        p_match: matchId,
        p_place: input.place.trim(),
        p_when: toIso(input.whenLocal),
        p_note: input.note.trim(),
      });
      if (error) return fail(error, 'No se pudo enviar la propuesta.');
      await get().loadConnections();
      return { success: true };
    },

    respond: async (meetupId, action, input = {}) => {
      const { user, isDemo } = auth();
      if (!user) return { success: false };
      if (action === 'reschedule') {
        const invalid = validateMeetupInput({ place: input.place ?? '', whenLocal: input.whenLocal ?? '', note: input.note ?? '' }, { placeOptional: true });
        if (invalid) return { success: false, message: invalid };
      }

      if (isDemo) {
        const c = findByMeetup(meetupId);
        if (!c?.meetup) return { success: false };
        const now = new Date().toISOString();
        if (action === 'accept') {
          demoSetStatus(c.matchId, meetupId, 'accepted');
          patchDemo(c.matchId, { meetup: { ...c.meetup, status: 'accepted', updatedAt: now }, needsAttention: false, other: { ...c.other, instagram: c.other.instagram || 'demo.' + c.other.name.split(' ')[0].toLowerCase() } });
        } else if (action === 'decline') {
          demoSetStatus(c.matchId, meetupId, 'declined', input.note?.trim() ?? '');
          patchDemo(c.matchId, { meetup: { ...c.meetup, status: 'declined', responseNote: input.note?.trim() ?? '', updatedAt: now }, needsAttention: false });
        } else {
          demoSetStatus(c.matchId, meetupId, 'rescheduled');
          const id = `demo-mt-${Date.now()}`;
          const meetup: Meetup = { id, status: 'pending', proposedByMe: true, place: input.place?.trim() || c.meetup.place, when: toIso(input.whenLocal as string), round: c.meetup.round + 1, note: (input.note as string).trim(), responseNote: '', updatedAt: now };
          demoPush(c.matchId, { id, proposerId: user.id, place: meetup.place, when: meetup.when, note: meetup.note, status: 'pending', round: meetup.round, responseNote: '', createdAt: now, updatedAt: now, updatedBy: user.id });
          patchDemo(c.matchId, { meetup, needsAttention: false });
        }
        return { success: true };
      }

      const { error } = await supabase.rpc('respond_meetup', {
        p_meetup: meetupId,
        p_action: action,
        p_note: input.note?.trim() || null,
        p_place: input.place?.trim() || null,
        p_when: input.whenLocal ? toIso(input.whenLocal) : null,
      });
      if (error) return fail(error, 'No se pudo enviar tu respuesta.');
      await get().loadConnections();
      return { success: true };
    },

    cancel: async (meetupId, note) => {
      if (auth().isDemo) {
        const c = findByMeetup(meetupId);
        if (!c?.meetup) return { success: false };
        demoSetStatus(c.matchId, meetupId, 'cancelled', note?.trim() ?? '');
        patchDemo(c.matchId, { meetup: { ...c.meetup, status: 'cancelled', responseNote: note?.trim() ?? '', updatedAt: new Date().toISOString() }, needsAttention: false });
        return { success: true };
      }
      const { error } = await supabase.rpc('cancel_meetup', { p_meetup: meetupId, p_note: note?.trim() || null });
      if (error) return fail(error, 'No se pudo cancelar.');
      await get().loadConnections();
      return { success: true };
    },

    loadSentInterests: async () => {
      if (!auth().user) return;
      if (auth().isDemo) {
        set({ sentInterests: getDemoDb().interests });
        return;
      }
      const { data, error } = await supabase.rpc('get_my_sent_interests');
      if (!error) set({ sentInterests: ((data || []) as SentInterestRow[]).map(mapInterest) });
    },

    addDemoInterest: (item) => {
      const db = getDemoDb();
      if (!db.interests.some((i) => i.id === item.id && i.mode === item.mode)) db.interests = [item, ...db.interests];
      set({ sentInterests: db.interests });
    },

    withdrawInterest: async (item) => {
      if (auth().isDemo) {
        const db = getDemoDb();
        db.interests = db.interests.filter((i) => !(i.id === item.id && i.mode === item.mode));
      } else {
        const { error } = await supabase.rpc('withdraw_interest', { p_to: item.id, p_mode: item.mode });
        if (error) return fail(error, 'No se pudo retirar tu interés.');
      }
      set({ sentInterests: get().sentInterests.filter((i) => !(i.id === item.id && i.mode === item.mode)) });
      return { success: true };
    },

    unmatch: async (matchId) => {
      if (!auth().isDemo) {
        const { error } = await supabase.rpc('unmatch', { p_match_id: matchId });
        if (error) return fail(error, 'No se pudo deshacer el match.');
      }
      set({ connections: get().connections.filter((c) => c.matchId !== matchId) });
      if (auth().isDemo) getDemoDb().connections = get().connections;
      return { success: true };
    },

    block: async (connection) => {
      if (!auth().isDemo) {
        const { error } = await supabase.rpc('block_user', { p_target: connection.other.id });
        if (error) return fail(error, 'No se pudo bloquear.');
      }
      set({ connections: get().connections.filter((c) => c.other.id !== connection.other.id) });
      if (auth().isDemo) getDemoDb().connections = get().connections;
      return { success: true };
    },

    report: async (connection, reason, description) => {
      const { user, isDemo } = auth();
      if (!user) return { success: false };
      if (!isDemo) {
        const { error } = await supabase.from('reports').insert({
          reporter_id: user.id,
          reported_id: connection.other.id,
          reason,
          description: description.trim().slice(0, 1000) || null,
        });
        if (error) return fail(error, 'No se pudo enviar el reporte.');
      }
      return { success: true, message: 'Gracias. Tu reporte llegó al equipo de moderación.' };
    },
  };
});

// Al cambiar de usuario (o cerrar sesión) se limpia todo
useAuthStore.subscribe((state, prev) => {
  if (state.user?.id !== prev.user?.id) useConnectionsStore.getState().reset();
});

/** Cuántos matches de cada modo tienen un punto rojo. */
export const attentionCount = (connections: Connection[], mode?: ConnectionModeKey) =>
  connections.filter((c) => c.needsAttention && (!mode || c.mode === mode)).length;
