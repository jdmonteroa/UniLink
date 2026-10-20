import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { photoUrl } from '@/lib/photos';
import { useAuthStore, type ConnectionModeKey, type ActionResult } from '@/features/auth/authStore';

export interface ChatMatch {
  matchId: string;
  conversationId: string;
  mode: ConnectionModeKey;
  matchedAt: string;
  user: {
    id: string;
    name: string;
    career: string;
    campus: string;
    avatarUrl: string;
    instagramHandle?: string;
    verified: boolean;
  };
  lastMessage?: string;
  lastMessageAt?: string;
  lastFromMe?: boolean;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string; // ISO
}

export type ReportReason = 'harassment' | 'sexual_content' | 'fake_profile' | 'spam' | 'other';

interface ChatState {
  /** id del usuario según la sesión real de Supabase (la que usa el servidor). */
  myId: string | null;
  matches: ChatMatch[];
  activeMatch: ChatMatch | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  loadMatches: () => Promise<void>;
  openMatch: (match: ChatMatch | null) => Promise<void>;
  openMatchById: (matchId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<ActionResult>;
  unmatchActive: () => Promise<ActionResult>;
  blockActive: () => Promise<ActionResult>;
  reportActive: (reason: ReportReason, description: string) => Promise<ActionResult>;
  reset: () => void;
}

const MAX_MESSAGE_LENGTH = 1000;
let conversationChannel: RealtimeChannel | null = null;
let inboxChannel: RealtimeChannel | null = null;

const auth = () => useAuthStore.getState();

/**
 * Id del usuario según el token de Supabase (lo mismo que auth.uid() en SQL).
 * Si no coincide con el perfil cargado en pantalla (p. ej. iniciaste sesión con
 * otra cuenta en otra pestaña del mismo navegador), se recarga el perfil para
 * que la app no mezcle "mis" mensajes con los de la otra persona.
 */
async function sessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id ?? null;
  const current = auth().user?.id;
  if (uid && current && uid !== current) void auth().reloadProfile();
  return uid;
}

let loadSeq = 0;

function stopConversationChannel() {
  if (conversationChannel) void supabase.removeChannel(conversationChannel);
  conversationChannel = null;
}
function stopInboxChannel() {
  if (inboxChannel) void supabase.removeChannel(inboxChannel);
  inboxChannel = null;
}

// ---------------------------------------------------------------------------
// Datos de ejemplo para el modo demo
// ---------------------------------------------------------------------------
const demoMatches = (): ChatMatch[] => [
  {
    matchId: 'demo-match-1',
    conversationId: 'demo-conv-1',
    mode: 'friendship',
    matchedAt: new Date(Date.now() - 3600_000).toISOString(),
    user: {
      id: 'demo-sofia',
      name: 'Sofía Álvarez',
      career: 'Ingeniería Biomédica',
      campus: 'Campus Central UAA',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      instagramHandle: 'sofia.alvarez_bio',
      verified: true,
    },
    lastMessage: '¡Hola! ¿También llevas Sistemas Distribuidos?',
    lastMessageAt: new Date(Date.now() - 1800_000).toISOString(),
    unreadCount: 1,
  },
];
const demoMessages: Record<string, ChatMessage[]> = {
  'demo-conv-1': [
    {
      id: 'dm1',
      conversationId: 'demo-conv-1',
      senderId: 'demo-sofia',
      content: '¡Hola! ¿También llevas Sistemas Distribuidos?',
      createdAt: new Date(Date.now() - 1800_000).toISOString(),
    },
  ],
};

interface MatchRow {
  match_id: string;
  conversation_id: string;
  mode: ConnectionModeKey;
  matched_at: string;
  other_id: string;
  other_name: string;
  other_career: string | null;
  other_campus: string | null;
  other_photo: string | null;
  other_instagram: string | null;
  other_verified: boolean;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  unread_count: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
}

const sortMessages = (list: ChatMessage[]) =>
  [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const mapMessage = (m: MessageRow): ChatMessage => ({
  id: m.id,
  conversationId: m.conversation_id,
  senderId: m.sender_id,
  content: m.content || '',
  createdAt: m.created_at,
});

export const useChatStore = create<ChatState>((set, get) => ({
  myId: null,
  matches: [],
  activeMatch: null,
  messages: [],
  isLoading: false,
  isLoadingMessages: false,
  error: null,

  reset: () => {
    stopConversationChannel();
    stopInboxChannel();
    loadSeq++;
    set({ myId: null, matches: [], activeMatch: null, messages: [], error: null, isLoading: false });
  },

  loadMatches: async () => {
    const { user, isDemo } = auth();
    if (!user) return;

    if (isDemo) {
      if (get().matches.length === 0) set({ matches: demoMatches(), myId: user.id });
      return;
    }

    const seq = ++loadSeq;
    set({ isLoading: true, error: null });
    const uid = await sessionUserId();
    if (!uid || uid !== user.id) {
      // La sesión cambió: authStore recarga el perfil y el chat se reinicia solo.
      set({ isLoading: false });
      return;
    }
    const { data, error } = await supabase.rpc('get_my_matches');
    if (seq !== loadSeq) return; // llegó una respuesta más nueva; esta es vieja
    if (error) {
      set({ isLoading: false, error: friendlyError(error, 'No se pudieron cargar tus matches.') });
      return;
    }

    const matches: ChatMatch[] = ((data || []) as MatchRow[]).map((r) => ({
      matchId: r.match_id,
      conversationId: r.conversation_id,
      // Los matches viejos del modo Estudio (ya eliminado) se muestran como Amistad
      mode: r.mode === 'dating' ? 'dating' : 'friendship',
      matchedAt: r.matched_at,
      user: {
        id: r.other_id,
        name: r.other_name,
        career: r.other_career || '',
        campus: r.other_campus || '',
        avatarUrl: photoUrl(r.other_photo),
        instagramHandle: r.other_instagram || undefined,
        verified: r.other_verified,
      },
      lastMessage: r.last_message || undefined,
      lastMessageAt: r.last_message_at || undefined,
      lastFromMe: r.last_sender_id === uid,
      // La conversación abierta siempre está leída
      unreadCount: r.conversation_id === get().activeMatch?.conversationId ? 0 : r.unread_count || 0,
    }));
    set({ matches, myId: uid, isLoading: false });

    // Escucha mensajes nuevos de cualquier conversación (RLS filtra solo las tuyas)
    if (!inboxChannel) {
      inboxChannel = supabase
        .channel(`inbox-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const row = payload.new as MessageRow;
          if (row.conversation_id === get().activeMatch?.conversationId) return;
          if (row.sender_id === get().myId) {
            // Mensaje mío (p. ej. desde otro dispositivo): actualiza el preview sin sumar no leídos
            set({
              matches: get().matches.map((m) =>
                m.conversationId === row.conversation_id
                  ? { ...m, lastMessage: row.content || '', lastMessageAt: row.created_at, lastFromMe: true }
                  : m
              ),
            });
            return;
          }
          void get().loadMatches();
        })
        .subscribe();
    }
  },

  openMatch: async (match) => {
    stopConversationChannel();
    set({ activeMatch: match, messages: [], error: null });
    if (!match) {
      void get().loadMatches();
      return;
    }

    if (auth().isDemo) {
      set({
        messages: demoMessages[match.conversationId] || [],
        matches: get().matches.map((m) => (m.matchId === match.matchId ? { ...m, unreadCount: 0 } : m)),
      });
      return;
    }

    set({ isLoadingMessages: true });
    const myId = (await sessionUserId()) ?? get().myId;
    if (get().activeMatch?.conversationId !== match.conversationId) return;
    set({ myId });

    // Primero se suscribe (para no perder mensajes que lleguen mientras se cargan)
    conversationChannel = supabase
      .channel(`conv-${match.conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${match.conversationId}` },
        (payload) => {
          if (get().activeMatch?.conversationId !== match.conversationId) return;
          const msg = mapMessage(payload.new as MessageRow);
          if (get().messages.some((m) => m.id === msg.id)) return;
          set({ messages: sortMessages([...get().messages, msg]) });
          if (msg.senderId !== get().myId) {
            void supabase.rpc('mark_conversation_read', { p_conversation_id: match.conversationId });
          }
        }
      )
      .subscribe();

    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .eq('conversation_id', match.conversationId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (get().activeMatch?.conversationId !== match.conversationId) return; // cambió de chat mientras cargaba
    if (error) {
      set({ isLoadingMessages: false, error: friendlyError(error, 'No se pudieron cargar los mensajes.') });
      return;
    }
    const loaded = ((data || []) as MessageRow[]).map(mapMessage);
    const extra = get().messages.filter((m) => !loaded.some((l) => l.id === m.id));
    set({ messages: sortMessages([...loaded, ...extra]), isLoadingMessages: false });

    set({ matches: get().matches.map((m) => (m.matchId === match.matchId ? { ...m, unreadCount: 0 } : m)) });
    await supabase.rpc('mark_conversation_read', { p_conversation_id: match.conversationId });
  },

  openMatchById: async (matchId) => {
    if (!get().matches.some((m) => m.matchId === matchId)) await get().loadMatches();
    const found = get().matches.find((m) => m.matchId === matchId);
    if (found) await get().openMatch(found);
  },

  sendMessage: async (raw) => {
    const content = raw.trim();
    const { user, isDemo } = auth();
    const match = get().activeMatch;
    if (!content || !user || !match) return { success: false };
    if (content.length > MAX_MESSAGE_LENGTH) {
      return { success: false, message: `El mensaje es muy largo (máx. ${MAX_MESSAGE_LENGTH} caracteres).` };
    }

    if (isDemo) {
      const msg: ChatMessage = {
        id: `demo-${Date.now()}`,
        conversationId: match.conversationId,
        senderId: user.id,
        content,
        createdAt: new Date().toISOString(),
      };
      set({ messages: [...get().messages, msg] });
      return { success: true };
    }

    const senderId = await sessionUserId();
    if (!senderId || senderId !== user.id) {
      return {
        success: false,
        message: 'Tu sesión cambió (¿iniciaste sesión con otra cuenta en otra pestaña?). Recargando tu perfil…',
      };
    }
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: match.conversationId, sender_id: senderId, content })
      .select('id, conversation_id, sender_id, content, created_at');
    if (error) return { success: false, message: friendlyError(error, 'No se pudo enviar el mensaje.') };
    if (!data || data.length === 0) {
      // El trigger de moderación descartó el mensaje
      return {
        success: false,
        message: 'Tu mensaje no se envió porque contiene lenguaje que va contra el código de conducta.',
      };
    }
    const msg = mapMessage(data[0] as MessageRow);
    if (!get().messages.some((m) => m.id === msg.id)) set({ messages: sortMessages([...get().messages, msg]) });
    // Actualiza el preview de la lista: es mío, así que no cuenta como no leído
    set({
      matches: get().matches.map((m) =>
        m.conversationId === msg.conversationId
          ? { ...m, lastMessage: msg.content, lastMessageAt: msg.createdAt, lastFromMe: true, unreadCount: 0 }
          : m
      ),
    });
    return { success: true };
  },

  unmatchActive: async () => {
    const match = get().activeMatch;
    if (!match) return { success: false };
    if (!auth().isDemo) {
      const { error } = await supabase.rpc('unmatch', { p_match_id: match.matchId });
      if (error) return { success: false, message: friendlyError(error, 'No se pudo deshacer el match.') };
    }
    stopConversationChannel();
    set({ matches: get().matches.filter((m) => m.matchId !== match.matchId), activeMatch: null, messages: [] });
    return { success: true };
  },

  blockActive: async () => {
    const match = get().activeMatch;
    if (!match) return { success: false };
    if (!auth().isDemo) {
      const { error } = await supabase.rpc('block_user', { p_target: match.user.id });
      if (error) return { success: false, message: friendlyError(error, 'No se pudo bloquear.') };
    }
    stopConversationChannel();
    set({ matches: get().matches.filter((m) => m.user.id !== match.user.id), activeMatch: null, messages: [] });
    return { success: true };
  },

  reportActive: async (reason, description) => {
    const match = get().activeMatch;
    const { user, isDemo } = auth();
    if (!match || !user) return { success: false };
    if (!isDemo) {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_id: match.user.id,
        reason,
        description: description.trim().slice(0, 1000) || null,
      });
      if (error) return { success: false, message: friendlyError(error, 'No se pudo enviar el reporte.') };
    }
    return { success: true, message: 'Gracias. Tu reporte llegó al equipo de moderación.' };
  },
}));

// Al cambiar de usuario (o cerrar sesión) se limpia el chat
useAuthStore.subscribe((state, prev) => {
  if (state.user?.id !== prev.user?.id) useChatStore.getState().reset();
});
