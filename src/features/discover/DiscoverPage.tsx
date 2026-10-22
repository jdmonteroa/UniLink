import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useMotionValueEvent, animate, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { RotateCcw, LogOut, MessageSquare, Clock, Instagram, Flame, User, Users, CalendarDays, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { useThemeStore, type ConnectionMode } from '@/features/theme/themeStore';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { photoUrl } from '@/lib/photos';
import { ChatView } from '@/features/chat/ChatView';
import { ProfileView } from '@/features/profile/ProfileView';
import { GroupsView } from '@/features/groups/GroupsView';
import { FriendsList } from '@/features/discover/FriendsList';
import { ConnectionsView } from '@/features/connections/ConnectionsView';
import { useConnectionsStore, attentionCount } from '@/features/connections/connectionsStore';
import { CHAT_ENABLED } from '@/lib/features';
import { DownloadAppButton } from '@/components/DownloadAppButton';
import { isAndroid } from '@/lib/android';
import { useGroupsStore } from '@/features/groups/groupsStore';
import { EventsView } from '@/features/events/EventsView';
import { useEventsStore } from '@/features/events/eventsStore';
import { useChatStore } from '@/features/chat/chatStore';
import { Avatar } from '@/components/Avatar';
import {
  HeartIcon,
  XMarkIcon,
  CheckBadgeIcon,
  SparklesIcon,
  SunIcon,
  MoonIcon,
  BookOpenIcon,
  UserGroupIcon,
  AcademicCapIcon,
} from '@/components/icons';
import { Wordmark, Highlight, MODE_COLOR, CONFETTI_COLORS, spring } from '@/components/brand';

/** Distancia (px) a partir de la cual soltar la tarjeta cuenta como decisión. */
const SWIPE_DISTANCE = 110;

const vibrate = (pattern: number) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // sin soporte de vibración
  }
};

export interface DiscoverStudent {
  id: string;
  name: string;
  age?: number;
  career: string;
  campus: string;
  semester?: number;
  compatibility: number;
  reasons: string[];
  sharedSubjects: string[];
  scheduleOverlap?: string;
  bio: string;
  tags: string[];
  photos: string[]; // URLs listas para mostrar
  verified: boolean;
}

interface RecommendationRow {
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
  interests: string[] | null;
  schedule_overlap: string | null;
}

const MODE_LABEL: Record<ConnectionMode, string> = { friendship: 'Amistades', dating: 'Pareja' };

// Perfiles de ejemplo solo para el modo demo
const DEMO_PROFILES: DiscoverStudent[] = [
  {
    id: 'demo-valeria', name: 'Valeria Lozano', age: 20, career: 'Lic. en Diseño Gráfico', campus: 'Campus Central UAA', semester: 4,
    compatibility: 82, reasons: ['Libres: Miércoles 13:00–15:00', 'A ambos les gusta: Café de Especialidad, Música Indie', 'Mismo campus'],
    sharedSubjects: [], scheduleOverlap: 'Miércoles 13:00–15:00',
    bio: 'Siempre con cámara analógica en mano. Me gusta descubrir cafeterías e ir a exposiciones.',
    tags: ['Fotografía 35mm', 'Cineclub', 'Matcha', 'Música Indie'],
    photos: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80'],
    verified: true,
  },
  {
    id: 'demo-diego', name: 'Diego Martínez', age: 22, career: 'Ing. en Sistemas Computacionales', campus: 'Campus Sur UAA', semester: 7,
    compatibility: 76, reasons: ['Comparten 1 materia', 'Misma carrera', 'A ambos les gusta: Programación, Videojuegos'],
    sharedSubjects: ['Inteligencia Artificial'],
    bio: 'Proyectos en Campus Sur. Retas de Smash entre clases y buscando equipo para hackathones.',
    tags: ['Programación', 'Videojuegos', 'Ajedrez'],
    photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80'],
    verified: true,
  },
  {
    id: 'demo-mateo', name: 'Mateo Espinoza', age: 22, career: 'Médico Cirujano', campus: 'Campus Central UAA', semester: 8,
    compatibility: 41, reasons: ['Mismo campus'], sharedSubjects: [],
    bio: 'Estudiante de Medicina. Busco despejar la mente después de guardias. Senderismo y pláticas largas.',
    tags: ['Senderismo', 'Running', 'Podcasts'],
    photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80'],
    verified: false,
  },
];

export const DiscoverPage: React.FC = () => {
  const { user, isDemo, logout } = useAuthStore();
  const { isDarkMode, toggleDarkMode, activeModePreview: mode, setActiveModePreview } = useThemeStore();
  const { matches, loadMatches, openMatchById } = useChatStore();

  const [activeTab, setActiveTab] = useState<'discover' | 'chat' | 'groups' | 'events' | 'profile'>('discover');
  const [profiles, setProfiles] = useState<DiscoverStudent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastPass, setLastPass] = useState<{ index: number; profileId: string } | null>(null);
  const [matchModal, setMatchModal] = useState<{ student: DiscoverStudent; matchId?: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const modeActive = user?.connectionModes[mode] ?? false;
  const unreadTotal = matches.reduce((sum, m) => sum + m.unreadCount, 0);
  // Sin chat: el puntito de Matches avisa de encuentros que esperan tu respuesta
  const { connections, loadConnections, setOpenMatchId } = useConnectionsStore();
  const matchesDot = CHAT_ENABLED ? unreadTotal > 0 : attentionCount(connections) > 0;
  const refreshMatches = () => void (CHAT_ENABLED ? loadMatches() : loadConnections());
  const pendingGroupRequests = useGroupsStore((s) => s.groups.reduce((sum, g) => sum + g.pendingRequests, 0));
  const loadGroups = useGroupsStore((s) => s.loadGroups);
  useEffect(() => {
    void loadGroups(); // para avisar de solicitudes pendientes en la barra inferior
  }, [loadGroups]);
  const pendingEventReviews = useEventsStore((s) => s.queue.length);
  const loadEventQueue = useEventsStore((s) => s.loadQueue);
  useEffect(() => {
    void loadEventQueue(); // solo hace algo si eres moderador
  }, [loadEventQueue]);

  // Carga los matches al entrar (para el puntito de "nuevos mensajes")
  useEffect(() => {
    if (CHAT_ENABLED) void loadMatches();
    else void loadConnections();
  }, [loadMatches, loadConnections]);

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setCurrentIndex(0);
    setPhotoIndex(0);
    setLastPass(null);

    if (isDemo) {
      setProfiles(DEMO_PROFILES);
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('get_recommendations', { target_mode: mode, result_limit: 30 });
    if (error) {
      setLoadError(friendlyError(error, 'No se pudieron cargar perfiles.'));
      setProfiles([]);
    } else {
      setProfiles(
        ((data || []) as RecommendationRow[]).map((r) => ({
          id: r.profile_id,
          name: r.full_name,
          age: r.age ?? undefined,
          career: r.career_name || '',
          campus: r.campus_name || '',
          semester: r.semester ?? undefined,
          compatibility: r.compatibility_score ?? 0,
          reasons: r.match_reasons || [],
          sharedSubjects: r.shared_subjects || [],
          scheduleOverlap: r.schedule_overlap || undefined,
          bio: r.bio || '',
          tags: r.interests || [],
          photos: (r.photos || []).map((p) => photoUrl(p)).filter(Boolean),
          verified: r.is_photo_verified,
        }))
      );
    }
    setIsLoading(false);
  }, [isDemo, mode]);

  useEffect(() => {
    // Amistades se muestra como lista (FriendsList); el mazo de tarjetas es solo de Pareja
    if (mode !== 'dating') return;
    if (modeActive) void fetchProfiles();
    else {
      setProfiles([]);
      setIsLoading(false);
    }
  }, [fetchProfiles, modeActive, mode, reloadKey]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const activeProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];

  // ---------------------------------------------------------------------------
  // Gesto de deslizar
  //  - La tarjeta sigue al dedo sin topes (nada de "liga" que la frene).
  //  - Al soltar se proyecta la inercia: un movimiento corto pero rápido cuenta.
  //  - Sale volando con la misma velocidad del gesto y la siguiente ya está lista
  //    detrás; el guardado en Supabase va en segundo plano (no se espera la red).
  // ---------------------------------------------------------------------------
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-16, 0, 16]);
  const likeOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const passOpacity = useTransform(x, [-20, -SWIPE_DISTANCE], [0, 1]);
  const likeStampScale = useTransform(x, [20, SWIPE_DISTANCE], [0.7, 1]);
  const passStampScale = useTransform(x, [-20, -SWIPE_DISTANCE], [0.7, 1]);
  // La tarjeta de atrás "sube" a su lugar mientras arrastras
  const behindScale = useTransform(x, [-180, 0, 180], [1, 0.95, 1]);
  const behindY = useTransform(x, [-180, 0, 180], [0, 10, 0]);
  const behindOpacity = useTransform(x, [-180, 0, 180], [1, 0.55, 1]);
  // Los botones crecen hacia el lado al que vas
  const likeBtnScale = useTransform(x, [0, SWIPE_DISTANCE], [1, 1.18]);
  const passBtnScale = useTransform(x, [-SWIPE_DISTANCE, 0], [1.18, 1]);

  const flying = useRef(false);
  const pastThreshold = useRef(false);

  // Vibración corta al cruzar el punto de decisión (Android; iOS la ignora)
  useMotionValueEvent(x, 'change', (v) => {
    const past = Math.abs(v) > SWIPE_DISTANCE;
    if (past !== pastThreshold.current) {
      pastThreshold.current = past;
      if (past && !flying.current) vibrate(8);
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const advance = () => {
    x.set(0);
    scrollToTop();
    setPhotoIndex(0);
    setCurrentIndex((i) => i + 1);
  };

  const findMatchId = async (otherId: string): Promise<string | undefined> => {
    if (!user) return undefined;
    const { data } = await supabase
      .from('matches')
      .select('id')
      .eq('mode', mode)
      .eq('is_active', true)
      .or(`and(user_a.eq.${user.id},user_b.eq.${otherId}),and(user_a.eq.${otherId},user_b.eq.${user.id})`)
      .maybeSingle();
    return data?.id;
  };

  /** Registra la decisión. La tarjeta ya se fue; la red no bloquea la siguiente. */
  const commitSwipe = (direction: 'left' | 'right', student: DiscoverStudent, index: number) => {
    if (!user) return;
    const action = direction === 'right' ? 'like' : 'pass';
    advance();
    setLastPass(action === 'pass' ? { index, profileId: student.id } : null);

    if (isDemo) {
      if (action === 'like' && student.compatibility >= 70) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 }, colors: CONFETTI_COLORS, disableForReducedMotion: true });
        setMatchModal({ student });
      }
      return;
    }

    void (async () => {
      const { error } = await supabase.from('swipes').insert({ from_id: user.id, to_id: student.id, mode, action });
      if (error && error.code !== '23505') {
        // 23505 = ya habías evaluado este perfil. Cualquier otro error: regresamos esa tarjeta.
        setNotice(friendlyError(error, 'No se pudo registrar tu respuesta.'));
        setCurrentIndex((i) => (i === index + 1 ? index : i));
        setLastPass(null);
        return;
      }
      if (action === 'like') {
        const matchId = await findMatchId(student.id);
        if (matchId) {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 }, colors: CONFETTI_COLORS, disableForReducedMotion: true });
          setMatchModal({ student, matchId });
          refreshMatches();
        }
      }
    })();
  };

  /** Lanza la tarjeta fuera de la pantalla conservando la velocidad del gesto. */
  const flyOut = (direction: 'left' | 'right', velocity = 0) => {
    if (!activeProfile || !user || flying.current) return;
    flying.current = true;
    vibrate(12);
    const student = activeProfile;
    const index = currentIndex;
    const sign = direction === 'right' ? 1 : -1;
    const target = sign * (window.innerWidth + 240);
    const speed = Math.max(Math.abs(velocity), 1400);
    const duration = Math.min(0.38, Math.max(0.2, Math.abs(target - x.get()) / speed));
    animate(x, target, {
      duration,
      ease: [0.25, 0.9, 0.35, 1],
      onComplete: () => {
        flying.current = false;
        commitSwipe(direction, student, index);
      },
    });
  };

  const handleSwipe = (direction: 'left' | 'right') => flyOut(direction);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    // Proyecta hacia dónde iba el dedo: un "flick" rápido cuenta aunque sea corto
    const projected = info.offset.x + info.velocity.x * 0.18;
    if (projected > SWIPE_DISTANCE) flyOut('right', info.velocity.x);
    else if (projected < -SWIPE_DISTANCE) flyOut('left', info.velocity.x);
    else animate(x, 0, { type: 'spring', stiffness: 520, damping: 34, velocity: info.velocity.x });
  };

  // Deshacer solo aplica al último "Pasar": la tarjeta regresa desde la izquierda
  const handleUndo = async () => {
    if (!lastPass || !user) return;
    if (!isDemo) {
      const { error } = await supabase
        .from('swipes')
        .delete()
        .eq('from_id', user.id)
        .eq('to_id', lastPass.profileId)
        .eq('mode', mode)
        .eq('action', 'pass');
      if (error) {
        setNotice(friendlyError(error, 'No se pudo deshacer.'));
        return;
      }
    }
    vibrate(8);
    scrollToTop();
    x.set(-(window.innerWidth + 120));
    setCurrentIndex(lastPass.index);
    setPhotoIndex(0);
    setLastPass(null);
    requestAnimationFrame(() => {
      animate(x, 0, { type: 'spring', stiffness: 320, damping: 30 });
    });
  };

  const handleGoToChat = async () => {
    const matchId = matchModal?.matchId;
    setMatchModal(null);
    setActiveTab('chat');
    if (!matchId) return;
    if (CHAT_ENABLED) await openMatchById(matchId);
    else setOpenMatchId(matchId);
  };

  const handleFriendMatch = (student: DiscoverStudent, matchId?: string) => {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 }, colors: CONFETTI_COLORS, disableForReducedMotion: true });
    setMatchModal({ student, matchId });
    if (matchId) refreshMatches();
  };

  const modes: { id: ConnectionMode; label: string; icon: typeof BookOpenIcon }[] = [
    { id: 'friendship', label: 'Amistades', icon: UserGroupIcon },
    { id: 'dating', label: 'Pareja', icon: HeartIcon },
  ];
  const ActiveModeIcon = modes.find((m) => m.id === mode)?.icon ?? UserGroupIcon;

  const emptyCard = (content: React.ReactNode) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex-1 min-h-[26rem] mb-4 flex flex-col items-center justify-center text-center px-8 py-10 rounded-3xl bg-white/60 dark:bg-white/[0.03] border-2 border-dashed border-slate-900/10 dark:border-white/10 space-y-4"
    >
      {content}
    </motion.div>
  );

  const labelCls = 'font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-haze-400';
  // El horario en común ya tiene su propio renglón; no se repite en las razones.
  const reasonsShown = (activeProfile?.reasons || []).filter((r) => !(activeProfile?.scheduleOverlap && r.startsWith('Libres:')));

  const roundBtn =
    'flex items-center justify-center rounded-full border-2 border-slate-900/10 dark:border-white/10 text-slate-700 dark:text-slate-200 transition-colors duration-200';

  return (
    // Layout tipo app: header y barra inferior fijos; solo el contenido central hace scroll
    <div className="h-dvh bg-haze-50 dark:bg-ink-950 text-slate-900 dark:text-slate-50 flex flex-col transition-colors duration-500 overflow-hidden">
      <header className="shrink-0 z-40 pt-[env(safe-area-inset-top)] bg-haze-50/85 dark:bg-ink-950/85 backdrop-blur-md border-b border-slate-900/[0.06] dark:border-white/[0.06]">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Wordmark className="text-2xl" />
            {isDemo ? (
              <span className="px-2 py-0.5 rounded-full bg-sun text-slate-900 text-[10px] font-bold rotate-[-3deg] whitespace-nowrap">
                demo · no se guarda nada
              </span>
            ) : isAndroid() ? (
              // En Android desde el navegador: invita a descargar la app (el botón se oculta si ya es la app)
              <DownloadAppButton className="h-10 px-3.5 text-sm" />
            ) : (
              user?.campus && <span className="text-xs text-slate-500 dark:text-haze-400 truncate">{user.campus}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <motion.button
              whileTap={{ scale: 0.9, rotate: -20 }}
              onClick={toggleDarkMode}
              className={`${roundBtn} w-10 h-10 hover:bg-sun hover:border-sun hover:text-slate-900`}
              aria-label={isDarkMode ? 'Usar tema claro' : 'Usar tema oscuro'}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isDarkMode ? 'sun' : 'moon'}
                  initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                  transition={{ duration: 0.2 }}
                >
                  {isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
            <button
              onClick={() => void logout()}
              className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 dark:text-haze-400 hover:bg-haze-100 dark:hover:bg-ink-800 hover:text-slate-900 dark:hover:text-slate-50 transition"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain flex flex-col">
      {activeTab === 'chat' && (
        <main className="max-w-md w-full mx-auto px-4 py-4 flex-1 min-h-0 flex flex-col">
          {CHAT_ENABLED ? (
            <ChatView onBackToDiscover={() => setActiveTab('discover')} />
          ) : (
            <ConnectionsView onBackToDiscover={() => setActiveTab('discover')} />
          )}
        </main>
      )}

      {activeTab === 'groups' && (
        <main className="max-w-md w-full mx-auto px-4 py-4 flex-1">
          <GroupsView />
        </main>
      )}

      {activeTab === 'events' && (
        <main className="max-w-md w-full mx-auto px-4 py-4 flex-1">
          <EventsView />
        </main>
      )}

      {activeTab === 'profile' && (
        <main className="max-w-md w-full mx-auto px-4 py-4 flex-1">
          <ProfileView />
        </main>
      )}

      {activeTab === 'discover' && (
        <main className="max-w-md w-full mx-auto px-4 flex-1 flex flex-col">
          {/* Selector de modo fijo arriba; el contenido se desvanece al pasar por debajo */}
          <div className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-3 bg-haze-50 dark:bg-ink-950 transition-colors duration-500">
          <div
            aria-hidden
            className={`absolute inset-x-0 top-full h-12 bg-linear-to-b from-haze-50 dark:from-ink-950 to-transparent pointer-events-none transition-opacity duration-200 ${
              scrolled ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div className="grid grid-cols-2 p-1 rounded-full bg-haze-100 dark:bg-ink-850 shadow-soft-sm" role="radiogroup" aria-label="Modo de conexión">
            {modes.map((m) => {
              const Icon = m.icon;
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setActiveModePreview(m.id)}
                  className={`relative h-10 rounded-full text-sm font-semibold transition-colors duration-200 ${
                    on ? 'text-slate-900' : 'text-slate-500 dark:text-haze-400 hover:text-slate-900 dark:hover:text-slate-50'
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId="discover-mode"
                      transition={spring}
                      className="absolute inset-0 rounded-full shadow-sticker"
                      style={{ backgroundColor: MODE_COLOR[m.id] }}
                    />
                  )}
                  <span className="relative flex items-center justify-center gap-1.5">
                    <Icon className="w-4 h-4" strokeWidth={on ? 2.25 : 2} />
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
          </div>

          <AnimatePresence>
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                role="status"
                className="mb-3 p-3 rounded-xl text-sm bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 flex gap-2"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{notice}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {mode === 'friendship' ? (
            <FriendsList
              active={modeActive}
              onGoProfile={() => setActiveTab('profile')}
              onMatch={handleFriendMatch}
              onNotice={setNotice}
            />
          ) : (
          <>
          <div className="relative flex-1 flex flex-col">
            {!modeActive ? (
              emptyCard(
                <>
                  <span
                    className="w-16 h-16 rounded-full flex items-center justify-center text-slate-900 -rotate-6 shadow-sticker"
                    style={{ backgroundColor: MODE_COLOR[mode] }}
                  >
                    <ActiveModeIcon className="w-7 h-7" />
                  </span>
                  <h3 className="text-2xl font-semibold leading-tight">{MODE_LABEL[mode]} está desactivado</h3>
                  <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[30ch]">
                    Actívalo en tu perfil para ver y aparecer ante otros estudiantes en este modo.
                  </p>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="h-12 px-6 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]"
                  >
                    Ir a mi perfil
                  </button>
                </>
              )
            ) : isLoading ? (
              emptyCard(
                <div className="flex flex-col items-center gap-4" role="status">
                  <div className="flex gap-1.5" aria-hidden>
                    <span className="w-2.5 h-2.5 rounded-full bg-mint animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-sun animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-coral animate-bounce" />
                  </div>
                  <span className="font-serif text-xl">Buscando estudiantes compatibles…</span>
                </div>
              )
            ) : loadError ? (
              emptyCard(
                <>
                  <span className="w-14 h-14 rounded-full bg-sun text-slate-900 flex items-center justify-center rotate-6 shadow-sticker">
                    <AlertCircle className="w-6 h-6" />
                  </span>
                  <p className="text-sm max-w-[32ch]">{loadError}</p>
                  <button
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="h-11 px-5 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition active:scale-[0.97]"
                  >
                    <RefreshCw className="w-4 h-4" /> Reintentar
                  </button>
                </>
              )
            ) : activeProfile ? (
              <div className="relative">
                {nextProfile && (
                  // Vista previa de la siguiente tarjeta: misma forma que la real para que el relevo no "brinque"
                  <motion.div
                    style={{ scale: behindScale, y: behindY }}
                    className="absolute inset-0 rounded-3xl bg-white dark:bg-ink-850 border border-slate-900/[0.06] dark:border-white/[0.06] pointer-events-none overflow-hidden"
                    aria-hidden
                  >
                    <motion.div style={{ opacity: behindOpacity }} className="relative aspect-4/5 max-h-[calc(100dvh-19rem)] min-h-64 w-full overflow-hidden bg-haze-200 dark:bg-ink-800">
                      {nextProfile.photos[0] ? (
                        <img src={nextProfile.photos[0]} alt="" className="w-full h-full object-cover" draggable={false} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Avatar name={nextProfile.name} className="w-28 h-28 text-4xl" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute bottom-4 inset-x-4 flex items-end justify-between gap-3 text-white">
                        <div className="min-w-0">
                          <p className="font-serif text-4xl font-semibold leading-none">
                            {nextProfile.name.split(' ')[0]}
                            {nextProfile.age ? <span className="font-normal italic">, {nextProfile.age}</span> : ''}
                          </p>
                          {nextProfile.career && <p className="text-sm text-white/85 mt-2 truncate">{nextProfile.career}</p>}
                        </div>
                        <div className="shrink-0 w-16 h-16 rounded-full bg-sun text-slate-900 flex flex-col items-center justify-center rotate-6 shadow-sticker">
                          <span className="font-serif text-xl font-semibold leading-none">{nextProfile.compatibility}%</span>
                          <span className="text-[9px] font-bold uppercase tracking-wide mt-0.5">afinidad</span>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                <motion.article
                  key={activeProfile.id}
                  style={{ x, rotate, touchAction: 'pan-y' }}
                  drag="x"
                  dragDirectionLock
                  dragMomentum={false}
                  onDragStart={() => vibrate(4)}
                  onDragEnd={handleDragEnd}
                  initial={false}
                  aria-label={`Perfil de ${activeProfile.name}`}
                  className="relative rounded-3xl bg-white dark:bg-ink-850 border border-slate-900/[0.06] dark:border-white/[0.06] shadow-soft-lg overflow-hidden cursor-grab active:cursor-grabbing z-20 select-none"
                >
                  {/* Foto */}
                  <div className="relative aspect-4/5 max-h-[calc(100dvh-19rem)] min-h-64 w-full overflow-hidden bg-haze-200 dark:bg-ink-800">
                    {activeProfile.photos.length > 0 ? (
                      <img src={activeProfile.photos[photoIndex]} alt={activeProfile.name} className="w-full h-full object-cover" draggable={false} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Avatar name={activeProfile.name} className="w-28 h-28 text-4xl" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

                    <motion.div
                      style={{ opacity: likeOpacity, scale: likeStampScale }}
                      className="absolute top-14 left-5 z-30 pointer-events-none -rotate-12 px-5 py-2 rounded-full bg-mint text-slate-900 font-serif italic font-semibold text-2xl shadow-sticker"
                    >
                      ¡me interesa!
                    </motion.div>
                    <motion.div
                      style={{ opacity: passOpacity, scale: passStampScale }}
                      className="absolute top-14 right-5 z-30 pointer-events-none rotate-12 px-5 py-2 rounded-full bg-white text-slate-900 border-2 border-slate-900 font-serif italic font-semibold text-2xl"
                    >
                      pasar
                    </motion.div>

                    {activeProfile.photos.length > 1 && (
                      <>
                        <div className="absolute top-3 inset-x-4 flex gap-1 z-20">
                          {activeProfile.photos.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              aria-label={`Foto ${idx + 1}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPhotoIndex(idx);
                              }}
                              className={`h-1 flex-1 rounded-full transition-colors ${idx === photoIndex ? 'bg-white' : 'bg-white/35'}`}
                            />
                          ))}
                        </div>
                        {/* Toques a los lados para cambiar de foto */}
                        <button
                          type="button"
                          aria-label="Foto anterior"
                          disabled={photoIndex === 0}
                          onClick={(e) => { e.stopPropagation(); setPhotoIndex((p) => Math.max(0, p - 1)); }}
                          className="absolute left-0 top-0 bottom-24 w-1/3 z-10"
                        />
                        <button
                          type="button"
                          aria-label="Foto siguiente"
                          disabled={photoIndex === activeProfile.photos.length - 1}
                          onClick={(e) => { e.stopPropagation(); setPhotoIndex((p) => Math.min(activeProfile.photos.length - 1, p + 1)); }}
                          className="absolute right-0 top-0 bottom-24 w-1/3 z-10"
                        />
                      </>
                    )}

                    {activeProfile.verified && (
                      <span className="absolute top-6 right-4 z-20 px-2.5 py-1 rounded-full bg-mint text-slate-900 font-semibold text-xs flex items-center gap-1 rotate-3 shadow-sticker pointer-events-none">
                        <CheckBadgeIcon className="w-3.5 h-3.5" /> Verificado
                      </span>
                    )}

                    <div className="absolute bottom-4 inset-x-4 flex items-end justify-between gap-3 z-20 text-white pointer-events-none">
                      <div className="min-w-0">
                        <h2 className="font-serif text-4xl font-semibold leading-none">
                          {activeProfile.name.split(' ')[0]}
                          {activeProfile.age ? <span className="font-normal italic">, {activeProfile.age}</span> : ''}
                        </h2>
                        {activeProfile.career && <p className="text-sm text-white/85 mt-2 truncate">{activeProfile.career}</p>}
                      </div>
                      <div className="shrink-0 w-16 h-16 rounded-full bg-sun text-slate-900 flex flex-col items-center justify-center rotate-6 shadow-sticker">
                        <span className="font-serif text-xl font-semibold leading-none">{activeProfile.compatibility}%</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide mt-0.5">afinidad</span>
                      </div>
                    </div>
                  </div>

                  {/* Información organizada por secciones */}
                  <div className="p-5 space-y-6">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      {activeProfile.campus && (
                        <div className="min-w-0">
                          <dt className={labelCls}>Campus</dt>
                          <dd className="font-medium mt-0.5 truncate">{activeProfile.campus}</dd>
                        </div>
                      )}
                      {activeProfile.semester && (
                        <div>
                          <dt className={labelCls}>Semestre</dt>
                          <dd className="font-medium mt-0.5">{activeProfile.semester}.° semestre</dd>
                        </div>
                      )}
                      {activeProfile.scheduleOverlap && (
                        <div className="col-span-2">
                          <dt className={labelCls}>Libres al mismo tiempo</dt>
                          <dd className="font-medium mt-0.5 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                            {activeProfile.scheduleOverlap}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {reasonsShown.length > 0 && (
                      <section className="space-y-2.5">
                        <h3 className={labelCls}>Por qué podrían conectar</h3>
                        <ul className="space-y-2">
                          {reasonsShown.map((r) => (
                            <li key={r} className="flex items-start gap-2.5 text-sm">
                              <span className="mt-0.5 w-5 h-5 rounded-full bg-sun text-slate-900 flex items-center justify-center shrink-0">
                                <SparklesIcon className="w-3 h-3" />
                              </span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {activeProfile.bio && (
                      <section className="space-y-2">
                        <h3 className={labelCls}>Sobre {activeProfile.name.split(' ')[0]}</h3>
                        <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">{activeProfile.bio}</p>
                      </section>
                    )}

                    {activeProfile.sharedSubjects.length > 0 && (
                      <section className="space-y-2.5">
                        <h3 className={labelCls}>Materias en común</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {activeProfile.sharedSubjects.map((s) => (
                            <span key={s} className="px-3 py-1.5 rounded-full text-sm font-medium bg-mint/50 dark:bg-mint/15 text-slate-900 dark:text-azure-200">
                              {s}
                            </span>
                          ))}
                        </div>
                      </section>
                    )}

                    {activeProfile.tags.length > 0 && (
                      <section className="space-y-2.5">
                        <h3 className={labelCls}>Intereses</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {activeProfile.tags.map((tag) => (
                            <span key={tag} className="px-3 py-1.5 rounded-full text-sm font-medium bg-haze-100 dark:bg-ink-800 text-slate-700 dark:text-slate-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </motion.article>
              </div>
            ) : (
              emptyCard(
                <>
                  <span className="w-16 h-16 rounded-full bg-sun text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker">
                    <AcademicCapIcon className="w-8 h-8" />
                  </span>
                  <h3 className="text-2xl font-semibold leading-tight">
                    {profiles.length === 0 ? 'Aún no hay perfiles nuevos' : 'Ya viste a todos por ahora'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[32ch]">
                    Vuelve más tarde o prueba otro modo. Mientras más completo esté tu perfil, mejores recomendaciones recibes.
                  </p>
                  <button
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="h-12 px-6 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]"
                  >
                    Buscar de nuevo
                  </button>
                </>
              )
            )}
          </div>

          {/* Botones fijos: siempre visibles, el contenido pasa por debajo */}
          {modeActive && !isLoading && !loadError && (activeProfile || lastPass) && (
            <div className="sticky bottom-0 z-30 -mx-4 px-4 pt-8 pb-3 mt-2 flex items-center justify-center gap-5 bg-linear-to-t from-haze-50 from-55% to-transparent dark:from-ink-950 pointer-events-none">
              <motion.button
                whileTap={{ scale: 0.88, rotate: -30 }}
                type="button"
                onClick={() => void handleUndo()}
                disabled={!lastPass}
                className={`${roundBtn} pointer-events-auto w-12 h-12 bg-white dark:bg-ink-850 shadow-soft-sm hover:bg-sun hover:border-sun hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none`}
                aria-label="Deshacer último pase"
                title="Deshacer último pase"
              >
                <RotateCcw className="w-5 h-5" />
              </motion.button>
              <motion.span style={{ scale: passBtnScale }} className="inline-flex">
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.9, rotate: -8 }}
                  transition={spring}
                  type="button"
                  onClick={() => handleSwipe('left')}
                  disabled={!activeProfile}
                  className={`${roundBtn} pointer-events-auto w-16 h-16 bg-white dark:bg-ink-850 shadow-soft-md hover:border-slate-900 dark:hover:border-white disabled:opacity-40`}
                  aria-label="Pasar"
                >
                  <XMarkIcon className="w-7 h-7" strokeWidth={2.25} />
                </motion.button>
              </motion.span>
              <motion.span style={{ scale: likeBtnScale }} className="inline-flex">
                <motion.button
                  whileHover={{ y: -2, scale: 1.04 }}
                  whileTap={{ scale: 0.9 }}
                  transition={spring}
                  type="button"
                  onClick={() => handleSwipe('right')}
                  disabled={!activeProfile}
                  className="pointer-events-auto w-16 h-16 flex items-center justify-center rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-glow-brand transition-colors disabled:opacity-40"
                  aria-label="Me interesa"
                >
                  <HeartIcon className="w-7 h-7 fill-current" />
                </motion.button>
              </motion.span>
            </div>
          )}
          </>
          )}
        </main>
      )}

      </div>

      <nav className="shrink-0 z-40 pb-[env(safe-area-inset-bottom)] bg-haze-50/90 dark:bg-ink-950/90 backdrop-blur-md border-t border-slate-900/[0.06] dark:border-white/[0.06]">
        <div className="max-w-md mx-auto px-1 py-2 grid grid-cols-5">
          {(
            [
              { id: 'discover', label: 'Descubrir', Icon: Flame },
              { id: 'chat', label: 'Matches', Icon: MessageSquare },
              { id: 'groups', label: 'Grupos', Icon: Users },
              { id: 'events', label: 'Eventos', Icon: CalendarDays },
              { id: 'profile', label: 'Mi perfil', Icon: User },
            ] as const
          ).map(({ id, label, Icon }) => {
            const on = activeTab === id;
            return (
              <motion.button
                key={id}
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveTab(id)}
                aria-current={on ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-1.5 transition-colors ${
                  on ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-haze-500 hover:text-slate-700 dark:hover:text-haze-300'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5.5 h-5.5" strokeWidth={on ? 2.25 : 2} />
                  {((id === 'chat' && matchesDot) || (id === 'groups' && pendingGroupRequests > 0) || (id === 'events' && pendingEventReviews > 0)) && (
                    <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-brand-600 ring-2 ring-haze-50 dark:ring-ink-950" />
                  )}
                </span>
                <span className="text-[11px] font-semibold">{label}</span>
                {on && <motion.span layoutId="nav-dot" transition={spring} className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-sun" />}
              </motion.button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {matchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.85, y: 24, rotate: -2 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.9, y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              role="dialog"
              aria-modal="true"
              aria-label="Nuevo match"
              className="relative max-w-sm w-full rounded-3xl bg-haze-50 dark:bg-ink-900 dark:ring-1 dark:ring-white/10 text-slate-900 dark:text-slate-50 px-6 pt-9 pb-6 text-center space-y-5 shadow-soft-lg"
            >
              <span
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 -rotate-3 px-3.5 py-1 rounded-full text-sm font-semibold text-slate-900 shadow-sticker whitespace-nowrap"
                style={{ backgroundColor: MODE_COLOR[mode] }}
              >
                {MODE_LABEL[mode]}
              </span>
              <div className="space-y-2">
                <h3 className="text-5xl font-semibold leading-none">
                  ¡Es un <Highlight delay={0.35}>match</Highlight>!
                </h3>
                <p className="text-sm text-slate-500 dark:text-haze-400 pt-1">
                  Tú y <strong className="text-slate-900 dark:text-slate-50">{matchModal.student.name}</strong> se interesaron mutuamente.
                </p>
              </div>
              <div className="flex items-center justify-center py-2">
                <motion.div initial={{ x: 30, rotate: 0 }} animate={{ x: 0, rotate: -6 }} transition={{ ...spring, delay: 0.15 }}>
                  <Avatar src={user?.avatarUrl} name={user?.name || 'Tú'} className="w-24 h-24 text-3xl ring-4 ring-haze-50 dark:ring-ink-900" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 14, delay: 0.35 }}
                  className="-mx-3 w-11 h-11 rounded-full bg-brand-600 text-white flex items-center justify-center z-10 ring-4 ring-haze-50 dark:ring-ink-900"
                >
                  <HeartIcon className="w-5 h-5 fill-current" />
                </motion.div>
                <motion.div initial={{ x: -30, rotate: 0 }} animate={{ x: 0, rotate: 6 }} transition={{ ...spring, delay: 0.15 }}>
                  <Avatar src={matchModal.student.photos[0]} name={matchModal.student.name} className="w-24 h-24 text-3xl ring-4 ring-haze-50 dark:ring-ink-900" />
                </motion.div>
              </div>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleGoToChat()}
                  className="w-full h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center justify-center gap-2 shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  <MessageSquare className="w-4 h-4" /> {CHAT_ENABLED ? `Escribirle a ${matchModal.student.name.split(' ')[0]}` : 'Proponer un encuentro'}
                </button>
                <button
                  type="button"
                  onClick={() => setMatchModal(null)}
                  className="w-full h-12 rounded-full text-sm font-semibold text-slate-600 dark:text-haze-300 hover:bg-haze-100 dark:hover:bg-ink-800 transition"
                >
                  Seguir descubriendo
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-haze-400 flex items-center justify-center gap-1.5">
                <Instagram className="w-3.5 h-3.5" /> {CHAT_ENABLED ? 'Su Instagram aparece en el chat si lo compartió.' : 'Su Instagram aparece cuando acepten un encuentro.'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
