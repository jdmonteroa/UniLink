import { create } from 'zustand';
import type { User as AuthUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, friendlyError } from '@/lib/supabaseClient';
import { photoUrl, saveProfilePhotos, MAX_PHOTOS } from '@/lib/photos';

export type ConnectionModeKey = 'friendship' | 'dating';

export interface AvailabilitySlot {
  weekday: number; // 0 = domingo ... 6 = sábado
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
}

export interface DatingPrefs {
  genders: string[]; // vacío = cualquiera
  minAge: number | null;
  maxAge: number | null;
}

/** A quién quiere ver la persona en cada modo. */
export type Seeking = 'women' | 'men' | 'everyone';
export type SeekingPrefs = Record<ConnectionModeKey, Seeking>;

export const SEEKING_OPTIONS: { value: Seeking; label: string }[] = [
  { value: 'women', label: 'Mujeres' },
  { value: 'men', label: 'Hombres' },
  { value: 'everyone', label: 'Todos' },
];

/** Seeking → valor de connection_modes.pref_genders (null = todos). */
export const seekingToGenders = (s: Seeking): string[] | null =>
  s === 'women' ? ['female'] : s === 'men' ? ['male'] : null;

/** connection_modes.pref_genders → Seeking. */
export const gendersToSeeking = (g: string[] | null | undefined): Seeking => {
  if (!g || g.length !== 1) return 'everyone';
  return g[0] === 'female' ? 'women' : g[0] === 'male' ? 'men' : 'everyone';
};

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  birthDate?: string;
  age?: number;
  gender?: string;
  pronouns?: string;
  bio: string;
  instagramHandle: string;
  universityId?: string;
  university: string;
  campusId?: string;
  campus: string;
  careerId?: string;
  career: string;
  semester: number | null;
  /** Rutas tal como están en profile_photos (usar photoUrl() para mostrarlas). */
  photos: string[];
  /** URL lista para mostrar de la foto principal ('' si no hay). */
  avatarUrl: string;
  subjectIds: string[];
  subjects: string[];
  interestIds: string[];
  interests: string[];
  availability: AvailabilitySlot[];
  connectionModes: Record<ConnectionModeKey, boolean>;
  datingPrefs: DatingPrefs;
  /** A quién quiere ver en cada modo (filtro mutuo en get_recommendations). */
  seeking: SeekingPrefs;
  isVerified: boolean;
  isPaused: boolean;
  /** 'moderator' y 'admin' pueden revisar eventos (se asigna desde la base de datos). */
  role: 'student' | 'moderator' | 'admin';
  /** Cuenta bloqueada de forma permanente (p. ej. al llegar a 5 sanciones). */
  isBlocked: boolean;
  onboardingCompleted: boolean;
}

/** Datos que entrega el onboarding al terminar. */
export interface OnboardingInput {
  name: string;
  birthDate: string;
  gender: string;
  pronouns: string;
  instagramHandle: string;
  bio: string;
  campusId: string;
  campus: string;
  careerId: string;
  career: string;
  semester: number;
  subjectIds: string[];
  subjects: string[];
  interestIds: string[];
  interests: string[];
  availability: AvailabilitySlot[];
  connectionModes: Record<ConnectionModeKey, boolean>;
  datingPrefs: DatingPrefs;
  seeking: SeekingPrefs;
}

/** Cambios parciales desde la pantalla de perfil. */
export interface ProfilePatch {
  name?: string;
  bio?: string;
  instagramHandle?: string;
  pronouns?: string;
  isPaused?: boolean;
  interestIds?: string[];
  interests?: string[];
  connectionModes?: Record<ConnectionModeKey, boolean>;
  datingPrefs?: DatingPrefs;
  seeking?: SeekingPrefs;
}

export interface ActionResult {
  success: boolean;
  message?: string;
}

interface AuthState {
  /** 'initializing' mientras se revisa si ya había una sesión guardada. */
  status: 'initializing' | 'ready';
  user: UserProfile | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  isLoading: boolean;
  error: string | null;
  /** Error al cargar el perfil (se muestra pantalla de reintento, NO el onboarding). */
  profileError: string | null;

  init: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  loginWithSupabase: (email: string, password: string) => Promise<ActionResult>;
  registerWithSupabase: (email: string, password: string, fullName: string) => Promise<ActionResult>;
  resendConfirmation: (email: string) => Promise<ActionResult>;
  completeOnboarding: (data: OnboardingInput) => Promise<ActionResult>;
  updateProfile: (patch: ProfilePatch) => Promise<ActionResult>;
  savePhotos: (paths: string[]) => Promise<ActionResult>;
  loginDemo: () => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

// ------------------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------------------
export const REQUIRED_DOMAIN = 'edu.uaa.mx';
export const ALLOWED_DOMAINS = [REQUIRED_DOMAIN, 'alumnos.uaa.mx'];

export const isAllowedInstitutionalEmail = (email: string): boolean => {
  const domain = email.trim().toLowerCase().split('@')[1];
  return ALLOWED_DOMAINS.includes(domain);
};

/** Edad exacta en años (considera si ya pasó el cumpleaños este año). */
export const calculateAge = (birthDateString?: string | null): number | undefined => {
  if (!birthDateString) return undefined;
  const birth = new Date(`${birthDateString}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
};

export const formatSemester = (semester: number | null | undefined) =>
  semester ? `${semester}.° semestre` : '';

const DEFAULT_MODES: Record<ConnectionModeKey, boolean> = { friendship: true, dating: false };
const DEFAULT_PREFS: DatingPrefs = { genders: [], minAge: 18, maxAge: null };
export const DEFAULT_SEEKING: SeekingPrefs = { friendship: 'everyone', dating: 'everyone' };
const toHHMM = (t: string) => t.slice(0, 5);

function throwIf(error: unknown, fallback: string) {
  if (error) throw new Error(friendlyError(error, fallback));
}

// ------------------------------------------------------------------------------
// Lectura del perfil desde Supabase
// ------------------------------------------------------------------------------
async function fetchProfileRow(uid: string) {
  return supabase
    .from('profiles')
    .select('*, universities(name), campuses(name), careers(name)')
    .eq('id', uid)
    .maybeSingle();
}

async function fetchFullProfile(authUser: AuthUser): Promise<UserProfile> {
  const uid = authUser.id;

  let { data: row, error } = await fetchProfileRow(uid);
  throwIf(error, 'No se pudo cargar tu perfil.');

  if (!row) {
    // El perfil no existe (usuario creado antes del trigger, por ejemplo): lo creamos.
    const { error: ensureError } = await supabase.rpc('ensure_my_profile');
    throwIf(ensureError, 'No se pudo crear tu perfil.');
    ({ data: row, error } = await fetchProfileRow(uid));
    throwIf(error, 'No se pudo cargar tu perfil.');
    if (!row) throw new Error('No se encontró tu perfil en la base de datos.');
  }

  const [photosRes, subjectsRes, interestsRes, modesRes, slotsRes] = await Promise.all([
    supabase.from('profile_photos').select('storage_path, position').eq('profile_id', uid).order('position'),
    supabase.from('profile_subjects').select('subject_id, subjects(name)').eq('profile_id', uid),
    supabase.from('profile_interests').select('interest_id, interests(name)').eq('profile_id', uid),
    supabase.from('connection_modes').select('mode, is_active, pref_genders, min_age, max_age').eq('profile_id', uid),
    supabase.from('availability_slots').select('weekday, start_time, end_time').eq('profile_id', uid).order('weekday'),
  ]);
  for (const res of [photosRes, subjectsRes, interestsRes, modesRes, slotsRes]) {
    throwIf(res.error, 'No se pudo cargar tu perfil.');
  }

  const photos = (photosRes.data || []).map((p) => p.storage_path as string);
  // Supabase tipa los embebidos como arreglo u objeto según la relación; normalizamos.
  const nameOf = (rel: unknown): string | undefined => {
    const r = Array.isArray(rel) ? rel[0] : rel;
    return r && typeof r === 'object' && 'name' in r ? String((r as { name: unknown }).name) : undefined;
  };

  const modes = { ...DEFAULT_MODES };
  let datingPrefs = { ...DEFAULT_PREFS };
  const seeking = { ...DEFAULT_SEEKING };
  for (const m of modesRes.data || []) {
    if (m.mode !== 'friendship' && m.mode !== 'dating') continue; // el modo Estudio ya no existe
    modes[m.mode as ConnectionModeKey] = Boolean(m.is_active);
    seeking[m.mode as ConnectionModeKey] = gendersToSeeking(m.pref_genders);
    if (m.mode === 'dating') {
      datingPrefs = {
        genders: m.pref_genders || [],
        minAge: m.min_age ?? 18,
        maxAge: m.max_age ?? null,
      };
    }
  }

  // Respaldo: si el perfil dice "no completado" pero la cuenta ya lo marcó, se repara.
  const metaCompleted = authUser.user_metadata?.onboarding_completed === true;
  const onboardingCompleted = row.onboarding_completed === true || metaCompleted;
  if (metaCompleted && row.onboarding_completed !== true) {
    void supabase.from('profiles').update({ onboarding_completed: true }).eq('id', uid);
  }

  // Marca de actividad (para el puntaje de "activo recientemente")
  void supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', uid);

  return {
    id: uid,
    name: row.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Estudiante',
    email: authUser.email || '',
    birthDate: row.birth_date || undefined,
    age: calculateAge(row.birth_date),
    gender: row.gender || undefined,
    pronouns: row.pronouns || undefined,
    bio: row.bio || '',
    instagramHandle: row.instagram_handle || '',
    universityId: row.university_id || undefined,
    university: nameOf(row.universities) || '',
    campusId: row.campus_id || undefined,
    campus: nameOf(row.campuses) || '',
    careerId: row.career_id || undefined,
    career: nameOf(row.careers) || '',
    semester: row.semester ?? null,
    photos,
    avatarUrl: photoUrl(photos[0]),
    subjectIds: (subjectsRes.data || []).map((s) => s.subject_id as string),
    subjects: (subjectsRes.data || []).map((s) => nameOf(s.subjects)).filter(Boolean) as string[],
    interestIds: (interestsRes.data || []).map((i) => i.interest_id as string),
    interests: (interestsRes.data || []).map((i) => nameOf(i.interests)).filter(Boolean) as string[],
    availability: (slotsRes.data || []).map((s) => ({
      weekday: s.weekday,
      start: toHHMM(s.start_time),
      end: toHHMM(s.end_time),
    })),
    connectionModes: modes,
    datingPrefs,
    seeking,
    isVerified: Boolean(row.is_photo_verified),
    isPaused: Boolean(row.is_paused),
    role: row.role === 'admin' || row.role === 'moderator' ? row.role : 'student',
    isBlocked: row.is_suspended === true && !row.suspended_until,
    onboardingCompleted,
  };
}

// ------------------------------------------------------------------------------
// Escritura (cada función lanza un Error con mensaje en español si falla)
// ------------------------------------------------------------------------------
async function updateProfileRow(uid: string, fields: Record<string, unknown>) {
  const attempt = () => supabase.from('profiles').update(fields).eq('id', uid).select('id');
  let { data, error } = await attempt();
  throwIf(error, 'No se pudo guardar tu perfil.');
  if (!data || data.length === 0) {
    // 0 filas actualizadas = el perfil no existe todavía. Lo creamos y reintentamos.
    const { error: ensureError } = await supabase.rpc('ensure_my_profile');
    throwIf(ensureError, 'No se pudo crear tu perfil.');
    ({ data, error } = await attempt());
    throwIf(error, 'No se pudo guardar tu perfil.');
    if (!data || data.length === 0) throw new Error('No se encontró tu perfil para guardarlo.');
  }
}

async function replaceLinks(table: 'profile_subjects' | 'profile_interests', column: 'subject_id' | 'interest_id', uid: string, ids: string[]) {
  const { error: delError } = await supabase.from(table).delete().eq('profile_id', uid);
  throwIf(delError, 'No se pudieron guardar tus datos.');
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return;
  const { error } = await supabase.from(table).insert(unique.map((id) => ({ profile_id: uid, [column]: id })));
  throwIf(error, 'No se pudieron guardar tus datos.');
}

async function replaceAvailability(uid: string, slots: AvailabilitySlot[]) {
  const { error: delError } = await supabase.from('availability_slots').delete().eq('profile_id', uid);
  throwIf(delError, 'No se pudo guardar tu horario.');
  if (slots.length === 0) return;
  const { error } = await supabase.from('availability_slots').insert(
    slots.map((s) => ({ profile_id: uid, weekday: s.weekday, start_time: s.start, end_time: s.end }))
  );
  throwIf(error, 'No se pudo guardar tu horario.');
}

async function writeModes(
  uid: string,
  modes: Record<ConnectionModeKey, boolean>,
  prefs: DatingPrefs,
  seeking: SeekingPrefs
) {
  const minAge = Math.max(18, prefs.minAge ?? 18);
  const maxAge = prefs.maxAge && prefs.maxAge >= minAge ? prefs.maxAge : null;
  const rows = (Object.keys(modes) as ConnectionModeKey[]).map((mode) => ({
    profile_id: uid,
    mode,
    is_active: modes[mode],
    pref_genders: seekingToGenders(seeking[mode] ?? 'everyone'),
    min_age: mode === 'dating' ? minAge : null,
    max_age: mode === 'dating' ? maxAge : null,
  }));
  const { error } = await supabase.from('connection_modes').upsert(rows, { onConflict: 'profile_id,mode' });
  throwIf(error, 'No se pudieron guardar tus modos de conexión.');
}

// Evita cargar el mismo perfil dos veces en paralelo (login + evento de auth)
let inflight: { uid: string; promise: Promise<void> } | null = null;
let initStarted = false;

// ------------------------------------------------------------------------------
// Datos del modo demo
// ------------------------------------------------------------------------------
const demoUser = (): UserProfile => ({
  id: 'demo-user',
  name: 'Carlos Mendoza',
  email: 'carlos.mendoza@tu-universidad.edu',
  birthDate: '2003-08-14',
  age: calculateAge('2003-08-14'),
  gender: 'male',
  pronouns: 'Él',
  bio: 'Estudiante de ISC en Campus Central. Busco equipo para proyectos y alguien con quien platicar de música indie.',
  instagramHandle: 'carlos_mendoza',
  university: 'Tu universidad',
  campusId: 'central',
  campus: 'Campus Central',
  careerId: 'isc',
  career: 'Ingeniería en Sistemas Computacionales',
  semester: 6,
  photos: ['https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80'],
  avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
  subjectIds: ['isc:Estructura de Datos', 'isc:Inteligencia Artificial'],
  subjects: ['Estructura de Datos', 'Inteligencia Artificial'],
  interestIds: ['Programación', 'Café de Especialidad', 'Música Indie', 'Videojuegos'],
  interests: ['Programación', 'Café de Especialidad', 'Música Indie', 'Videojuegos'],
  availability: [{ weekday: 2, start: '16:00', end: '19:00' }],
  connectionModes: { friendship: true, dating: true },
  datingPrefs: { ...DEFAULT_PREFS },
  seeking: { ...DEFAULT_SEEKING },
  isVerified: true,
  isPaused: false,
  role: 'moderator', // para poder probar la cola de moderación en el modo demo
  isBlocked: false,
  onboardingCompleted: true,
});

// ------------------------------------------------------------------------------
// Store
// ------------------------------------------------------------------------------
export const useAuthStore = create<AuthState>((set, get) => {
  const loadProfile = (authUser: AuthUser): Promise<void> => {
    if (inflight?.uid === authUser.id) return inflight.promise;
    const promise = (async () => {
      try {
        const profile = await fetchFullProfile(authUser);
        set({ user: profile, isAuthenticated: true, isDemo: false, profileError: null });
      } catch (err) {
        set({
          user: null,
          isAuthenticated: true,
          profileError: friendlyError(err, 'No se pudo cargar tu perfil.'),
        });
      } finally {
        inflight = null;
      }
    })();
    inflight = { uid: authUser.id, promise };
    return promise;
  };

  return {
    status: 'initializing',
    user: null,
    isAuthenticated: false,
    isDemo: false,
    isLoading: false,
    error: null,
    profileError: null,

    clearError: () => set({ error: null }),

    init: async () => {
      if (initStarted) return;
      initStarted = true;

      if (!isSupabaseConfigured) {
        set({ status: 'ready' });
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) await loadProfile(data.session.user);
      } catch (err) {
        console.warn('[UniLink] No se pudo restaurar la sesión:', err);
      } finally {
        set({ status: 'ready' });
      }

      supabase.auth.onAuthStateChange((event, session) => {
        if (get().isDemo) return;
        if (event === 'SIGNED_OUT' || !session) {
          set({ user: null, isAuthenticated: false, profileError: null });
          return;
        }
        // Cualquier evento (SIGNED_IN, TOKEN_REFRESHED, cambio desde otra pestaña…) cuya
        // sesión sea de otro usuario: recarga el perfil para no mostrar datos de la cuenta anterior.
        if (get().user?.id !== session.user.id && inflight?.uid !== session.user.id) {
          // Supabase recomienda no llamar a la API dentro del callback directamente.
          setTimeout(() => void loadProfile(session.user), 0);
        }
      });
    },

    reloadProfile: async () => {
      if (get().isDemo) return;
      const { data } = await supabase.auth.getUser();
      if (data.user) await loadProfile(data.user);
      else set({ user: null, isAuthenticated: false, profileError: null });
    },

    loginWithSupabase: async (email, password) => {
      set({ isLoading: true, error: null });
      const fail = (message: string): ActionResult => {
        set({ isLoading: false, error: message });
        return { success: false, message };
      };

      if (!isSupabaseConfigured) {
        return fail('Supabase no está configurado en el archivo .env. Usa el modo demo o agrega tus llaves.');
      }
      if (!isAllowedInstitutionalEmail(email)) {
        return fail(`Solo se permiten correos institucionales (@${ALLOWED_DOMAINS.join(' o @')}).`);
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) return fail(friendlyError(error, 'No se pudo iniciar sesión.'));
        if (data.user) await loadProfile(data.user);
        set({ isLoading: false });
        return { success: true };
      } catch (err) {
        return fail(friendlyError(err, 'Error al conectar con Supabase.'));
      }
    },

    registerWithSupabase: async (email, password, fullName) => {
      set({ isLoading: true, error: null });
      const fail = (message: string): ActionResult => {
        set({ isLoading: false, error: message });
        return { success: false, message };
      };

      if (!isSupabaseConfigured) {
        return fail('Supabase no está configurado en el archivo .env. Usa el modo demo o agrega tus llaves.');
      }
      if (!isAllowedInstitutionalEmail(email)) {
        return fail(`Solo se permiten correos institucionales (@${ALLOWED_DOMAINS.join(' o @')}).`);
      }
      if (fullName.trim().length < 3) return fail('Escribe tu nombre completo.');
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return fail('La contraseña debe tener al menos 8 caracteres, con letras y números.');
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: (import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin,
          },
        });
        if (error) return fail(friendlyError(error, 'No se pudo crear la cuenta.'));

        // Supabase no marca error si el correo ya existe: devuelve un usuario sin identidades.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          return fail('Ese correo ya tiene cuenta. Inicia sesión o recupera tu contraseña.');
        }

        if (data.session?.user) {
          await loadProfile(data.session.user);
          set({ isLoading: false });
          return { success: true };
        }

        set({ isLoading: false });
        return {
          success: true,
          message: 'Cuenta creada. Te enviamos un enlace de confirmación a tu correo institucional; ábrelo y después inicia sesión.',
        };
      } catch (err) {
        return fail(friendlyError(err, 'Error al registrar usuario.'));
      }
    },

    resendConfirmation: async (email) => {
      if (!isSupabaseConfigured) return { success: false, message: 'Supabase no está configurado.' };
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
      if (error) return { success: false, message: friendlyError(error) };
      return { success: true, message: 'Te reenviamos el correo de confirmación.' };
    },

    completeOnboarding: async (data) => {
      const current = get().user;
      if (!current) return { success: false, message: 'No hay sesión activa.' };

      const age = calculateAge(data.birthDate);
      if (age === undefined || age < 18) return { success: false, message: 'Debes tener 18 años o más.' };
      if (data.interestIds.length < 3) return { success: false, message: 'Elige al menos 3 intereses.' };
      if (current.photos.length === 0) return { success: false, message: 'Sube al menos una foto.' };
      if (!Object.values(data.connectionModes).some(Boolean)) {
        return { success: false, message: 'Activa al menos un modo de conexión.' };
      }

      const merged: UserProfile = {
        ...current,
        ...data,
        name: data.name.trim(),
        age,
        bio: data.bio.trim(),
        instagramHandle: data.instagramHandle.replace(/@/g, '').trim(),
        onboardingCompleted: true,
      };

      if (get().isDemo) {
        set({ user: merged });
        return { success: true };
      }

      try {
        const uid = current.id;
        await updateProfileRow(uid, {
          full_name: merged.name,
          birth_date: data.birthDate,
          gender: data.gender,
          pronouns: data.pronouns.trim() || null,
          bio: merged.bio || null,
          instagram_handle: merged.instagramHandle || null,
          campus_id: data.campusId,
          career_id: data.careerId,
          semester: data.semester,
        });
        await replaceLinks('profile_subjects', 'subject_id', uid, data.subjectIds);
        await replaceLinks('profile_interests', 'interest_id', uid, data.interestIds);
        await replaceAvailability(uid, data.availability);
        await writeModes(uid, data.connectionModes, data.datingPrefs, data.seeking);

        // Al final: marcar onboarding como completado (solo si todo lo anterior se guardó)
        await updateProfileRow(uid, { onboarding_completed: true });
        // Respaldo en la cuenta de Auth: aunque algo raro pase con la tabla, no se repite.
        await supabase.auth.updateUser({ data: { onboarding_completed: true } }).catch(() => undefined);

        await get().reloadProfile();
        const after = get().user;
        if (!after?.onboardingCompleted) {
          return { success: false, message: get().profileError || 'No se pudo confirmar el guardado. Intenta de nuevo.' };
        }
        return { success: true };
      } catch (err) {
        return { success: false, message: friendlyError(err, 'No se pudo guardar tu perfil.') };
      }
    },

    updateProfile: async (patch) => {
      const current = get().user;
      if (!current) return { success: false, message: 'No hay sesión activa.' };

      if (patch.interestIds && patch.interestIds.length < 3) {
        return { success: false, message: 'Elige al menos 3 intereses.' };
      }
      if (patch.connectionModes && !Object.values(patch.connectionModes).some(Boolean)) {
        return { success: false, message: 'Activa al menos un modo de conexión.' };
      }

      const cleaned: ProfilePatch = { ...patch };
      if (cleaned.instagramHandle !== undefined) cleaned.instagramHandle = cleaned.instagramHandle.replace(/@/g, '').trim();
      if (cleaned.bio !== undefined) cleaned.bio = cleaned.bio.trim().slice(0, 300);

      if (!get().isDemo) {
        try {
          const row: Record<string, unknown> = {};
          if (cleaned.name !== undefined) row.full_name = cleaned.name.trim();
          if (cleaned.bio !== undefined) row.bio = cleaned.bio || null;
          if (cleaned.instagramHandle !== undefined) row.instagram_handle = cleaned.instagramHandle || null;
          if (cleaned.pronouns !== undefined) row.pronouns = cleaned.pronouns.trim() || null;
          if (cleaned.isPaused !== undefined) row.is_paused = cleaned.isPaused;
          if (Object.keys(row).length) await updateProfileRow(current.id, row);

          if (cleaned.interestIds) {
            await replaceLinks('profile_interests', 'interest_id', current.id, cleaned.interestIds);
          }
          if (cleaned.connectionModes || cleaned.datingPrefs || cleaned.seeking) {
            await writeModes(
              current.id,
              cleaned.connectionModes || current.connectionModes,
              cleaned.datingPrefs || current.datingPrefs,
              cleaned.seeking || current.seeking
            );
          }
        } catch (err) {
          return { success: false, message: friendlyError(err, 'No se pudo guardar.') };
        }
      }

      set({ user: { ...current, ...cleaned } as UserProfile });
      return { success: true };
    },

    savePhotos: async (paths) => {
      const current = get().user;
      if (!current) return { success: false, message: 'No hay sesión activa.' };
      const list = paths.slice(0, MAX_PHOTOS);
      if (!get().isDemo) {
        try {
          await saveProfilePhotos(current.id, list);
        } catch (err) {
          return { success: false, message: friendlyError(err, 'No se pudieron guardar tus fotos.') };
        }
      }
      set({ user: { ...current, photos: list, avatarUrl: photoUrl(list[0]) } });
      return { success: true };
    },

    loginDemo: () =>
      set({
        isAuthenticated: true,
        isDemo: true,
        error: null,
        profileError: null,
        user: demoUser(),
      }),

    logout: async () => {
      const wasDemo = get().isDemo;
      set({ user: null, isAuthenticated: false, isDemo: false, error: null, profileError: null });
      if (!wasDemo && isSupabaseConfigured) {
        try {
          await supabase.auth.signOut();
        } catch {
          // Si falla la red, la sesión local igual se limpia.
        }
      }
    },
  };
});
