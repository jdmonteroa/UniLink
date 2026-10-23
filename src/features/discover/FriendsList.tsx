import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Handshake, Check, MessageCircle, GraduationCap, Loader2, RefreshCw, AlertCircle, Users } from 'lucide-react';
import { useAuthStore, formatSemester } from '@/features/auth/authStore';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { photoUrl } from '@/lib/photos';
import { DEMO_CATALOG, loadCatalog, type Catalog } from '@/lib/catalog';
import { Avatar } from '@/components/Avatar';
import { CheckBadgeIcon } from '@/components/icons';
import { spring } from '@/components/brand';
import { useConnectionsStore } from '@/features/connections/connectionsStore';

const PAGE_SIZE = 40;
const MAX_CHIPS = 4;

interface Friend {
  id: string;
  name: string;
  age?: number;
  career: string;
  campus: string;
  semester?: number;
  bio: string;
  verified: boolean;
  photo: string;
  interests: string[];
  sharedInterests: string[];
  sharedSubjects: string[];
  compatibility: number;
  reasons: string[];
  /** Ya mostraste interés (queda pendiente hasta que la otra persona también lo haga). */
  liked: boolean;
  /** Ya son match: aparece en Matches. */
  matched: boolean;
}

interface StudentRow {
  profile_id: string;
  full_name: string;
  age: number | null;
  career_name: string | null;
  campus_name: string | null;
  semester: number | null;
  bio: string | null;
  is_photo_verified: boolean;
  photos: string[] | null;
  compatibility_score: number | null;
  match_reasons: string[] | null;
  shared_subjects: string[] | null;
  shared_interests: string[] | null;
  interests: string[] | null;
  my_action: 'like' | 'pass' | null;
  is_matched: boolean | null;
}

const mapRow = (r: StudentRow): Friend => ({
  id: r.profile_id,
  name: r.full_name,
  age: r.age ?? undefined,
  career: r.career_name || '',
  campus: r.campus_name || '',
  semester: r.semester ?? undefined,
  bio: r.bio || '',
  verified: r.is_photo_verified,
  photo: photoUrl((r.photos || [])[0]),
  interests: r.interests || [],
  sharedInterests: r.shared_interests || [],
  sharedSubjects: r.shared_subjects || [],
  compatibility: r.compatibility_score ?? 0,
  reasons: r.match_reasons || [],
  liked: r.my_action === 'like',
  matched: Boolean(r.is_matched),
});

// Estudiantes de ejemplo solo para el modo demo (los filtros se aplican aquí mismo)
const DEMO_FRIENDS: Friend[] = [
  { id: 'demo-valeria', name: 'Valeria Lozano', age: 20, career: 'Licenciatura en Diseño Gráfico', campus: 'Campus Central UAA', semester: 4, bio: 'Diseño, café y cineclub. Busco con quién ir a exposiciones.', verified: true, photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80', interests: ['Fotografía 35mm', 'Cineclub', 'Café de Especialidad', 'Museos', 'Música Indie'], sharedInterests: ['Música Indie'], sharedSubjects: [], compatibility: 82, reasons: ['A ambos les gusta: Música Indie'], liked: false, matched: false },
  { id: 'demo-diego', name: 'Diego Ramírez', age: 21, career: 'Ingeniería en Sistemas Computacionales', campus: 'Campus Central UAA', semester: 6, bio: 'Hago proyectos de IA y juego ajedrez en el receso.', verified: true, photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80', interests: ['Programación', 'Inteligencia Artificial', 'Ajedrez', 'Videojuegos', 'Running'], sharedInterests: ['Programación', 'Ajedrez'], sharedSubjects: ['Estructura de Datos', 'Inteligencia Artificial'], compatibility: 94, reasons: ['Comparten 2 materias', 'Misma carrera'], liked: false, matched: false },
  { id: 'demo-sofia', name: 'Sofía Álvarez', age: 19, career: 'Ingeniería Biomédica', campus: 'Campus Sur UAA', semester: 4, bio: 'Bioseñales y gimnasio. Doy asesorías de física.', verified: false, photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', interests: ['Robótica', 'Gimnasio', 'Yoga', 'Viajar'], sharedInterests: [], sharedSubjects: [], compatibility: 68, reasons: [], liked: false, matched: false },
  { id: 'demo-leo', name: 'Leonardo Campos', age: 22, career: 'Ingeniería en Sistemas Computacionales', campus: 'Campus Sur UAA', semester: 9, bio: 'Último semestre. Asesorías de Estructura de Datos a cambio de café.', verified: true, photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80', interests: ['Programación', 'Ciberseguridad', 'Café de Especialidad', 'Senderismo'], sharedInterests: ['Programación'], sharedSubjects: ['Estructura de Datos'], compatibility: 88, reasons: ['Comparten 1 materia', 'Misma carrera'], liked: false, matched: false },
  { id: 'demo-ximena', name: 'Ximena Reyes', age: 19, career: 'Médico Cirujano', campus: 'Campus Central UAA', semester: 3, bio: 'Medicina, tercer semestre. Voluntaria en la Cruz Roja.', verified: true, photo: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=300&q=80', interests: ['Voluntariado', 'Lectura', 'Cocinar', 'Perros y Gatos'], sharedInterests: [], sharedSubjects: [], compatibility: 61, reasons: [], liked: false, matched: false },
];

interface Filters {
  query: string;
  careerId: string;
  campusId: string;
  semester: string;
  subjectId: string;
  interestId: string;
  sharedSubjectsOnly: boolean;
}
const EMPTY_FILTERS: Filters = { query: '', careerId: '', campusId: '', semester: '', subjectId: '', interestId: '', sharedSubjectsOnly: false };

const selectCls =
  'w-full h-11 px-3 rounded-lg bg-white/70 dark:bg-white/[0.04] border-2 border-slate-900/10 dark:border-white/10 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-slate-900 dark:focus:border-slate-50 transition-colors';
const chipCls = (on: boolean) =>
  `shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
    on
      ? 'bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900'
      : 'bg-haze-100 dark:bg-ink-800 text-slate-700 dark:text-haze-300 hover:bg-haze-200 dark:hover:bg-ink-700'
  }`;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------------------
// Fila de la lista: foto, carrera y lo que le gusta hacer
// ---------------------------------------------------------------------------
const FriendRow: React.FC<{ friend: Friend; busy: boolean; onLike: () => void; onOpenChat: () => void }> = ({ friend, busy, onLike, onOpenChat }) => {
  const [open, setOpen] = useState(false);
  const shown = [...friend.interests].sort((a, b) => Number(friend.sharedInterests.includes(b)) - Number(friend.sharedInterests.includes(a)));
  const first = friend.name.split(' ')[0];

  return (
    <li className="rounded-3xl bg-white dark:bg-ink-850 shadow-soft-sm overflow-hidden">
      <div className="flex items-start gap-3 p-3.5">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${friend.name}: ver más`}
          className="flex-1 min-w-0 flex items-start gap-3.5 text-left"
        >
          <span className="relative shrink-0">
            <Avatar src={friend.photo} name={friend.name} className="w-16 h-16 text-xl" />
            {friend.verified && (
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-mint text-slate-900 ring-2 ring-white dark:ring-ink-850" title="Foto verificada">
                <CheckBadgeIcon className="w-3 h-3" />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block font-serif text-xl font-semibold leading-tight truncate">
              {friend.name}
              {friend.age ? <span className="font-normal italic">, {friend.age}</span> : null}
            </span>
            <span className="flex items-start gap-1.5 text-sm font-semibold leading-snug text-brand-600 dark:text-brand-400">
              <GraduationCap className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{friend.career || 'Carrera sin indicar'}</span>
            </span>
            {friend.semester ? <span className="block text-xs text-slate-500 dark:text-haze-400">{formatSemester(friend.semester)}</span> : null}
            {shown.length > 0 && (
              <span className="flex flex-wrap gap-1.5 pt-0.5">
                {shown.slice(0, MAX_CHIPS).map((t) => (
                  <span
                    key={t}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      friend.sharedInterests.includes(t) ? 'bg-sun text-slate-900' : 'bg-haze-100 dark:bg-ink-800 text-slate-700 dark:text-haze-300'
                    }`}
                  >
                    {t}
                  </span>
                ))}
                {shown.length > MAX_CHIPS && <span className="px-1.5 py-0.5 text-xs text-slate-500 dark:text-haze-400">+{shown.length - MAX_CHIPS}</span>}
              </span>
            )}
          </span>
        </button>

        <div className="shrink-0 flex flex-col items-center gap-1">
          {friend.matched ? (
            <>
              <button
                onClick={onOpenChat}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-mint text-slate-900 hover:-rotate-6 transition"
                aria-label={`Abrir el chat con ${first}`}
                title="Ya son match: abrir chat"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-haze-400">En Matches</span>
            </>
          ) : friend.liked ? (
            <>
              <span className="w-11 h-11 flex items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400" title="Ya le mostraste interés">
                <Check className="w-5 h-5" strokeWidth={2.5} />
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-haze-400">Pendiente</span>
            </>
          ) : (
            <motion.button
              whileTap={{ scale: 0.88 }}
              transition={spring}
              onClick={onLike}
              disabled={busy}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-glow-brand transition-colors disabled:opacity-50"
              aria-label={`Me interesa ${first}`}
              title="Me interesa"
            >
              {busy ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Handshake className="w-5 h-5" strokeWidth={2.25} />}
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
              {friend.bio && <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-3">{friend.bio}</p>}
              {friend.interests.length > MAX_CHIPS && (
                <p className="text-sm text-slate-600 dark:text-haze-300"><strong>Le gusta:</strong> {friend.interests.join(', ')}</p>
              )}
              {friend.sharedSubjects.length > 0 && (
                <p className="text-sm text-slate-600 dark:text-haze-300"><strong>Cursan lo mismo:</strong> {friend.sharedSubjects.join(', ')}</p>
              )}
              <p className="text-xs text-slate-500 dark:text-haze-400">
                {[friend.campus, `${friend.compatibility}% de afinidad`, ...friend.reasons.filter((r) => !r.startsWith('A ambos'))].filter(Boolean).join(' · ')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
};

// ---------------------------------------------------------------------------
// Lista con filtros
// ---------------------------------------------------------------------------
interface FriendsListProps {
  /** false cuando la persona apagó el modo Amistades en su perfil. */
  active: boolean;
  onGoProfile: () => void;
  /** Abre la pestaña Matches en ese match (para escribirse). */
  onOpenMatch: (matchId: string) => void;
  onNotice: (message: string) => void;
}

export const FriendsList: React.FC<FriendsListProps> = ({ active, onGoProfile, onOpenMatch, onNotice }) => {
  const { user, isDemo } = useAuthStore();
  const connections = useConnectionsStore((s) => s.connections);
  const loadConnections = useConnectionsStore((s) => s.loadConnections);
  const loadSentInterests = useConnectionsStore((s) => s.loadSentInterests);
  const addDemoInterest = useConnectionsStore((s) => s.addDemoInterest);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useDebounced(filters.query, 300);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (isDemo) {
      setCatalog(DEMO_CATALOG);
      return;
    }
    let cancelled = false;
    loadCatalog(user?.universityId)
      .then((c) => !cancelled && setCatalog(c))
      .catch(() => undefined); // sin catálogo solo se pierden los filtros de lista
    return () => {
      cancelled = true;
    };
  }, [isDemo, user?.universityId]);

  const subjectOptions = useMemo(
    () => (catalog?.subjects || []).filter((s) => !filters.careerId || s.careerId === filters.careerId),
    [catalog, filters.careerId]
  );
  const interestsByCategory = useMemo(() => {
    const groups: Record<string, { id: string; name: string }[]> = {};
    for (const i of catalog?.interests || []) (groups[i.category] ||= []).push(i);
    return groups;
  }, [catalog]);

  const applyDemoFilters = useCallback(() => {
    const nameOf = (list: { id: string; name: string }[] | undefined, id: string) => list?.find((x) => x.id === id)?.name;
    const career = nameOf(DEMO_CATALOG.careers, filters.careerId);
    const campus = nameOf(DEMO_CATALOG.campuses, filters.campusId);
    const subject = nameOf(DEMO_CATALOG.subjects, filters.subjectId);
    const interest = nameOf(DEMO_CATALOG.interests, filters.interestId);
    const q = query.trim().toLowerCase();
    return DEMO_FRIENDS.filter(
      (f) =>
        (!career || f.career.toLowerCase().includes(career.toLowerCase().replace('licenciatura en ', ''))) &&
        (!campus || f.campus === campus) &&
        (!filters.semester || f.semester === Number(filters.semester)) &&
        (!subject || f.sharedSubjects.includes(subject)) &&
        (!interest || f.interests.includes(interest)) &&
        (!q || `${f.name} ${f.bio} ${f.career} ${f.interests.join(' ')}`.toLowerCase().includes(q))
    );
  }, [filters.careerId, filters.campusId, filters.semester, filters.subjectId, filters.interestId, query]);

  const fetchPage = useCallback(
    async (offset: number): Promise<Friend[]> => {
      if (isDemo) return offset === 0 ? applyDemoFilters() : [];
      const { data, error: rpcError } = await supabase.rpc('list_students', {
        p_mode: 'friendship',
        p_career: filters.careerId || null,
        p_campus: filters.campusId || null,
        p_semester: filters.semester ? Number(filters.semester) : null,
        p_subject: filters.subjectId || null,
        p_interest: filters.interestId || null,
        p_query: query.trim() || null,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (rpcError) throw new Error(friendlyError(rpcError, 'No se pudo cargar la lista.'));
      return ((data || []) as StudentRow[]).map(mapRow);
    },
    [isDemo, applyDemoFilters, filters.careerId, filters.campusId, filters.semester, filters.subjectId, filters.interestId, query]
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchPage(0)
      .then((rows) => {
        if (cancelled) return;
        setFriends(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((e: Error) => !cancelled && (setError(e.message), setFriends([])))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [active, fetchPage, reloadKey]);

  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      const rows = await fetchPage(friends.length);
      setFriends((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'No se pudo cargar más.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // En Amistades nadie desaparece de la lista: "Me interesa" solo cambia su estado
  const markLiked = (id: string, matched: boolean) =>
    setFriends((prev) => {
      // Con quien ya hiciste match deja de salir aquí: pasa a Matches
      if (matched) return prev.filter((f) => f.id !== id);
      const next = prev.map((f) => (f.id === id ? { ...f, liked: true, matched } : f));
      // Las personas ya conectadas pasan al final, igual que lo ordena el servidor
      return [...next.filter((f) => !f.liked && !f.matched), ...next.filter((f) => f.liked || f.matched)];
    });

  const like = async (friend: Friend) => {
    if (!user || busyId) return;
    setBusyId(friend.id);
    const first = friend.name.split(' ')[0];

    if (isDemo) {
      const matched = friend.compatibility >= 70;
      markLiked(friend.id, matched);
      if (!matched) {
        addDemoInterest({ id: friend.id, mode: 'friendship', name: friend.name, career: friend.career, campus: friend.campus, semester: friend.semester ?? null, avatarUrl: friend.photo, verified: friend.verified, likedAt: new Date().toISOString() });
      }
      onNotice(matched ? `¡Ahora tú y ${first} son match! Ya pueden escribirse en Matches.` : `Le avisamos a ${first} que te interesa. Si es mutuo, aparecerá en Matches.`);
      setBusyId(null);
      return;
    }

    const { data: matchId, error: swipeError } = await supabase.rpc('record_swipe', { p_to: friend.id, p_mode: 'friendship', p_action: 'like' });
    if (swipeError) {
      setBusyId(null);
      onNotice(friendlyError(swipeError, 'No se pudo registrar tu respuesta.'));
      return;
    }
    markLiked(friend.id, Boolean(matchId));
    if (matchId) {
      // Sin confeti ni ventana: en Amistades la persona simplemente aparece en Matches
      onNotice(`¡Ahora tú y ${first} son match! Ya pueden escribirse en Matches.`);
      void loadConnections();
    } else {
      void loadSentInterests();
      onNotice(`Le avisamos a ${first} que te interesa. Si es mutuo, aparecerá en Matches.`);
    }
    setBusyId(null);
  };

  const openChat = (friend: Friend) => {
    const found = connections.find((c) => c.mode === 'friendship' && c.other.id === friend.id);
    if (found) onOpenMatch(found.matchId);
    else void loadConnections().then(() => onNotice('Búscalo en la pestaña Matches.'));
  };

  // Filtros rápidos pensados para estudios
  const myCareer = user?.careerId || '';
  const mySemester = user?.semester ? String(user.semester) : '';
  const activeFilterCount =
    [filters.careerId, filters.campusId, filters.semester, filters.subjectId, filters.interestId].filter(Boolean).length +
    (filters.sharedSubjectsOnly ? 1 : 0);
  const visible = filters.sharedSubjectsOnly ? friends.filter((f) => f.sharedSubjects.length > 0) : friends;

  if (!active) {
    return (
      <div className="w-full flex-1 min-h-[22rem] mb-4 flex flex-col items-center justify-center text-center px-8 py-10 rounded-3xl bg-white/60 dark:bg-white/[0.03] border-2 border-dashed border-slate-900/10 dark:border-white/10 space-y-4">
        <span className="w-16 h-16 rounded-full bg-sun text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker"><Users className="w-7 h-7" /></span>
        <h3 className="text-2xl font-semibold leading-tight">Amistades está desactivado</h3>
        <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[30ch]">Actívalo en tu perfil para ver y aparecer ante otros estudiantes.</p>
        <button onClick={onGoProfile} className="h-12 px-6 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]">Ir a mi perfil</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={filters.query}
            onChange={(e) => set('query', e.target.value)}
            placeholder="Buscar estudiantes"
            aria-label="Buscar estudiantes"
            className="w-full h-12 pl-11 pr-4 rounded-full bg-white/70 dark:bg-white/[0.04] border-2 border-slate-900/10 dark:border-white/10 text-sm outline-none focus:border-slate-900 dark:focus:border-slate-50 transition-colors placeholder:text-slate-500 dark:placeholder:text-haze-400"
          />
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          aria-expanded={showFilters}
          className={`shrink-0 h-12 px-4 inline-flex items-center gap-1.5 rounded-full border-2 text-sm font-semibold transition-colors ${
            showFilters || activeFilterCount > 0 ? 'border-slate-900 dark:border-slate-50' : 'border-slate-900/10 dark:border-white/10'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" /> Filtros
          {activeFilterCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-brand-600 text-white text-[11px] leading-5 text-center">{activeFilterCount}</span>}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" role="group" aria-label="Filtros rápidos">
        {myCareer && (
          <button onClick={() => set('careerId', filters.careerId === myCareer ? '' : myCareer)} aria-pressed={filters.careerId === myCareer} className={chipCls(filters.careerId === myCareer)}>Mi carrera</button>
        )}
        {mySemester && (
          <button onClick={() => set('semester', filters.semester === mySemester ? '' : mySemester)} aria-pressed={filters.semester === mySemester} className={chipCls(filters.semester === mySemester)}>Mi semestre</button>
        )}
        <button onClick={() => set('sharedSubjectsOnly', !filters.sharedSubjectsOnly)} aria-pressed={filters.sharedSubjectsOnly} className={chipCls(filters.sharedSubjectsOnly)}>Cursan lo mismo que yo</button>
      </div>

      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="rounded-3xl bg-white dark:bg-ink-850 shadow-soft-sm p-4 grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-semibold">
                Carrera
                <select
                  value={filters.careerId}
                  onChange={(e) => setFilters((f) => ({ ...f, careerId: e.target.value, subjectId: '' }))}
                  className={`${selectCls} mt-1.5 font-normal`}
                >
                  <option value="">Todas</option>
                  {(catalog?.careers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Semestre
                <select value={filters.semester} onChange={(e) => set('semester', e.target.value)} className={`${selectCls} mt-1.5 font-normal`}>
                  <option value="">Todos</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}.°</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Campus
                <select value={filters.campusId} onChange={(e) => set('campusId', e.target.value)} className={`${selectCls} mt-1.5 font-normal`}>
                  <option value="">Todos</option>
                  {(catalog?.campuses || []).map((c) => <option key={c.id} value={c.id}>{c.name.replace(/ UAA$/, '')}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-sm font-semibold">
                Materia que cursa
                <select value={filters.subjectId} onChange={(e) => set('subjectId', e.target.value)} className={`${selectCls} mt-1.5 font-normal`}>
                  <option value="">Cualquiera</option>
                  {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-sm font-semibold">
                Le gusta
                <select value={filters.interestId} onChange={(e) => set('interestId', e.target.value)} className={`${selectCls} mt-1.5 font-normal`}>
                  <option value="">Cualquier cosa</option>
                  {Object.entries(interestsByCategory).map(([category, items]) => (
                    <optgroup key={category} label={category}>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              {activeFilterCount > 0 || filters.query ? (
                <button onClick={() => setFilters(EMPTY_FILTERS)} className="col-span-2 h-10 rounded-full text-sm font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition">
                  Limpiar filtros
                </button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-10 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10">
          <span className="w-12 h-12 rounded-full bg-sun text-slate-900 flex items-center justify-center rotate-6 shadow-sticker"><AlertCircle className="w-5 h-5" /></span>
          <p className="text-sm max-w-[32ch]">{error}</p>
          <button onClick={() => setReloadKey((k) => k + 1)} className="h-11 px-5 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition active:scale-[0.97]">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      ) : isLoading ? (
        <ul className="space-y-3" role="status" aria-label="Cargando estudiantes">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-28 rounded-3xl bg-white/70 dark:bg-white/[0.04] animate-pulse" />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10">
          <span className="w-14 h-14 rounded-full bg-mint text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker"><Users className="w-6 h-6" /></span>
          <h3 className="text-xl font-semibold">{activeFilterCount > 0 || filters.query ? 'Nadie coincide con esos filtros' : 'Por ahora no hay más estudiantes'}</h3>
          <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[30ch]">
            {activeFilterCount > 0 || filters.query ? 'Prueba quitando alguno.' : 'Vuelve más tarde: cuando se sumen más estudiantes aparecerán aquí.'}
          </p>
          {(activeFilterCount > 0 || filters.query) && (
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="h-11 px-5 rounded-full border-2 border-slate-900/15 dark:border-white/15 hover:border-slate-900 dark:hover:border-white text-sm font-semibold transition">Limpiar filtros</button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-haze-400">{visible.length} {visible.length === 1 ? 'estudiante' : 'estudiantes'}{hasMore ? ' o más' : ''}. Toca una tarjeta para ver más.</p>
          <ul className="space-y-3">
            {visible.map((f) => (
              <FriendRow key={f.id} friend={f} busy={busyId === f.id} onLike={() => void like(f)} onOpenChat={() => openChat(f)} />
            ))}
          </ul>
          {hasMore && (
            <button onClick={() => void loadMore()} disabled={isLoadingMore} className="w-full h-12 rounded-full border-2 border-slate-900/15 dark:border-white/15 hover:border-slate-900 dark:hover:border-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition disabled:opacity-60">
              {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />} Ver más
            </button>
          )}
        </>
      )}
    </div>
  );
};
