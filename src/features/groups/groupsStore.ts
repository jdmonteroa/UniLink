import { create } from 'zustand';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { photoUrl, removeStoredPhotos } from '@/lib/photos';
import { useAuthStore, type ActionResult } from '@/features/auth/authStore';
import type { TextScan } from '@/features/events/eventsStore';

export const GROUP_CATEGORIES = [
  { id: 'estudio', label: 'Estudio' },
  { id: 'deporte', label: 'Deporte' },
  { id: 'arte', label: 'Arte y cultura' },
  { id: 'musica', label: 'Música' },
  { id: 'videojuegos', label: 'Videojuegos' },
  { id: 'tecnologia', label: 'Tecnología' },
  { id: 'idiomas', label: 'Idiomas' },
  { id: 'voluntariado', label: 'Voluntariado' },
  { id: 'social', label: 'Social' },
  { id: 'otro', label: 'Otro' },
] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number]['id'];
export const categoryLabel = (id: string) => GROUP_CATEGORIES.find((c) => c.id === id)?.label ?? 'Otro';

export type GroupRole = 'admin' | 'member';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export type GroupStatus = 'pending' | 'approved' | 'rejected';
export type ChangeKind = 'delete' | 'transfer';
export type ChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Group {
  id: string;
  name: string;
  description: string;
  category: GroupCategory;
  imagePath: string | null;
  imageUrl: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  memberCount: number;
  myRole: GroupRole | null;
  requestStatus: RequestStatus | null;
  pendingRequests: number;
  /** 'pending' = en revisión; 'rejected' = no pasó la revisión (se puede corregir y reenviar). */
  status: GroupStatus;
  /** Motivo del rechazo (solo cuando status = 'rejected'). */
  reviewNote: string;
  /** Tipo de petición que espera respuesta, si quien consulta administra el grupo. */
  pendingChange: ChangeKind | null;
}

/** Petición de quienes administran un grupo aprobado: eliminarlo o que lo lleve otra persona. */
export interface ChangeRequest {
  id: string;
  kind: ChangeKind;
  reason: string;
  status: ChangeStatus;
  resolutionNote: string;
  createdAt: string;
  requesterName: string;
  newOwnerId: string | null;
  newOwnerName: string;
}

interface PersonInfo {
  id: string;
  name: string;
  career: string;
  semester?: number | null;
  avatarUrl: string;
}

/** Grupo esperando aprobación (lo ve quien modera). */
export interface GroupSubmission {
  id: string;
  name: string;
  description: string;
  category: GroupCategory;
  imagePath: string | null;
  imageUrl: string;
  createdAt: string;
  creator: PersonInfo;
  textScan: TextScan | null;
  /** De qué plataforma es el enlace (quien modera no ve el enlace). */
  linkNetwork: string;
  /** true si ya se había revisado antes (rechazado y corregido, o aprobado y editado). */
  resubmitted: boolean;
  previousNote: string;
  priorRejections: number;
  memberCount: number;
}

/** Petición pendiente de un grupo (lo ve quien modera). */
export interface GroupChangeItem {
  requestId: string;
  kind: ChangeKind;
  reason: string;
  createdAt: string;
  group: { id: string; name: string; imageUrl: string; memberCount: number };
  requester: PersonInfo;
  newOwner: PersonInfo | null;
}

export interface GroupMember {
  profileId: string;
  name: string;
  career: string;
  semester: number | null;
  avatarUrl: string;
  role: GroupRole;
  isCreator: boolean;
}

export interface JoinRequest {
  requestId: string;
  profileId: string;
  name: string;
  career: string;
  semester: number | null;
  avatarUrl: string;
  message: string;
  createdAt: string;
}

export interface GroupInput {
  name: string;
  description: string;
  category: GroupCategory;
  imagePath: string | null;
  /** Obligatorio al crear; al editar, vacío = no cambiar el enlace. */
  link: string;
}

// ---------------------------------------------------------------------------
// Enlace del grupo (espejo de validate_group_link en setup.sql)
// ---------------------------------------------------------------------------
const LINK_HOSTS: Record<string, string> = {
  'chat.whatsapp.com': 'WhatsApp',
  'whatsapp.com': 'WhatsApp',
  'wa.me': 'WhatsApp',
  'instagram.com': 'Instagram',
  'ig.me': 'Instagram',
  't.me': 'Telegram',
  'telegram.me': 'Telegram',
  'telegram.dog': 'Telegram',
  'discord.gg': 'Discord',
  'discord.com': 'Discord',
  'facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'fb.me': 'Facebook',
  'm.me': 'Facebook',
  'signal.group': 'Signal',
  'signal.me': 'Signal',
};

/** Nombre de la red del enlace ('WhatsApp', 'Instagram'…) o null si no es válido. */
export function linkNetwork(raw: string): string | null {
  const url = raw.trim();
  if (!/^https:\/\/[^\s/?#]+([/?#]\S*)?$/i.test(url) || url.length > 300) return null;
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return LINK_HOSTS[host] ?? null;
}

export function linkError(raw: string): string | null {
  if (!raw.trim()) return 'Pega el enlace de tu grupo de WhatsApp (u otra red).';
  if (!/^https:\/\//i.test(raw.trim())) return 'El enlace debe empezar con https://';
  if (!linkNetwork(raw)) return 'Usa un enlace de WhatsApp, Instagram, Telegram, Discord, Facebook o Signal.';
  return null;
}

export function validateGroupInput(input: GroupInput, { requireLink }: { requireLink: boolean }): string | null {
  const name = input.name.trim();
  if (name.length < 3) return 'El nombre debe tener al menos 3 caracteres.';
  if (name.length > 60) return 'El nombre puede tener máximo 60 caracteres.';
  if (input.description.trim().length > 500) return 'La descripción puede tener máximo 500 caracteres.';
  if (requireLink || input.link.trim()) return linkError(input.link);
  return null;
}

// ---------------------------------------------------------------------------
// Filas de Supabase
// ---------------------------------------------------------------------------
interface GroupRow {
  id: string;
  name: string;
  description: string;
  category: string;
  image_path: string | null;
  created_by: string;
  creator_name: string;
  created_at: string;
  member_count: number;
  my_role: GroupRole | null;
  my_request_status: RequestStatus | null;
  pending_requests: number;
  status: GroupStatus;
  review_note: string | null;
  pending_change: ChangeKind | null;
}
interface ChangeRequestRow {
  id: string;
  kind: ChangeKind;
  reason: string;
  status: ChangeStatus;
  resolution_note: string | null;
  created_at: string;
  requested_by: string;
  requester_name: string;
  new_owner_id: string | null;
  new_owner_name: string | null;
}
interface SubmissionRow {
  id: string;
  name: string;
  description: string;
  category: string;
  image_path: string | null;
  created_at: string;
  creator_id: string;
  creator_name: string;
  creator_career: string | null;
  creator_semester: number | null;
  creator_photo: string | null;
  text_scan: TextScan | null;
  link_network: string | null;
  resubmitted: boolean;
  previous_note: string | null;
  prior_rejections: number;
  member_count: number;
}
interface ChangeItemRow {
  request_id: string;
  kind: ChangeKind;
  reason: string;
  created_at: string;
  group_id: string;
  group_name: string;
  group_image_path: string | null;
  member_count: number;
  requester_id: string;
  requester_name: string;
  requester_career: string | null;
  requester_photo: string | null;
  new_owner_id: string | null;
  new_owner_name: string | null;
  new_owner_career: string | null;
  new_owner_photo: string | null;
}
interface MemberRow {
  profile_id: string;
  full_name: string;
  career_name: string | null;
  semester: number | null;
  photo: string | null;
  role: GroupRole;
  is_creator: boolean;
}
interface RequestRow {
  request_id: string;
  profile_id: string;
  full_name: string;
  career_name: string | null;
  semester: number | null;
  photo: string | null;
  message: string | null;
  created_at: string;
}

const mapGroup = (r: GroupRow): Group => ({
  id: r.id,
  name: r.name,
  description: r.description,
  category: (GROUP_CATEGORIES.some((c) => c.id === r.category) ? r.category : 'otro') as GroupCategory,
  imagePath: r.image_path,
  imageUrl: photoUrl(r.image_path),
  createdBy: r.created_by,
  creatorName: r.creator_name,
  createdAt: r.created_at,
  memberCount: r.member_count,
  myRole: r.my_role,
  requestStatus: r.my_request_status,
  pendingRequests: r.pending_requests,
  status: r.status ?? 'approved',
  reviewNote: r.review_note || '',
  pendingChange: r.pending_change ?? null,
});

const asCategory = (c: string): GroupCategory => (GROUP_CATEGORIES.some((x) => x.id === c) ? (c as GroupCategory) : 'otro');

const mapChangeRequest = (r: ChangeRequestRow): ChangeRequest => ({
  id: r.id,
  kind: r.kind,
  reason: r.reason,
  status: r.status,
  resolutionNote: r.resolution_note || '',
  createdAt: r.created_at,
  requesterName: r.requester_name,
  newOwnerId: r.new_owner_id,
  newOwnerName: r.new_owner_name || '',
});

const mapSubmission = (r: SubmissionRow): GroupSubmission => ({
  id: r.id,
  name: r.name,
  description: r.description,
  category: asCategory(r.category),
  imagePath: r.image_path,
  imageUrl: photoUrl(r.image_path),
  createdAt: r.created_at,
  creator: { id: r.creator_id, name: r.creator_name, career: r.creator_career || '', semester: r.creator_semester, avatarUrl: photoUrl(r.creator_photo) },
  textScan: r.text_scan,
  linkNetwork: r.link_network || 'Otra',
  resubmitted: r.resubmitted,
  previousNote: r.previous_note || '',
  priorRejections: r.prior_rejections,
  memberCount: r.member_count,
});

const mapChangeItem = (r: ChangeItemRow): GroupChangeItem => ({
  requestId: r.request_id,
  kind: r.kind,
  reason: r.reason,
  createdAt: r.created_at,
  group: { id: r.group_id, name: r.group_name, imageUrl: photoUrl(r.group_image_path), memberCount: r.member_count },
  requester: { id: r.requester_id, name: r.requester_name, career: r.requester_career || '', avatarUrl: photoUrl(r.requester_photo) },
  newOwner: r.new_owner_id
    ? { id: r.new_owner_id, name: r.new_owner_name || '', career: r.new_owner_career || '', avatarUrl: photoUrl(r.new_owner_photo) }
    : null,
});

const mapMember = (r: MemberRow): GroupMember => ({
  profileId: r.profile_id,
  name: r.full_name,
  career: r.career_name || '',
  semester: r.semester,
  avatarUrl: photoUrl(r.photo),
  role: r.role,
  isCreator: r.is_creator,
});

const mapRequest = (r: RequestRow): JoinRequest => ({
  requestId: r.request_id,
  profileId: r.profile_id,
  name: r.full_name,
  career: r.career_name || '',
  semester: r.semester,
  avatarUrl: photoUrl(r.photo),
  message: r.message || '',
  createdAt: r.created_at,
});

// ---------------------------------------------------------------------------
// Modo demo: todo vive en memoria
// ---------------------------------------------------------------------------
const demoPeople = [
  { id: 'demo-sofia', name: 'Sofía Álvarez', career: 'Diseño Gráfico', semester: 5 },
  { id: 'demo-diego', name: 'Diego Ramírez', career: 'Ingeniería en Sistemas', semester: 7 },
  { id: 'demo-valeria', name: 'Valeria Torres', career: 'Médico Cirujano', semester: 3 },
];

interface DemoDb {
  groups: Group[];
  members: Record<string, GroupMember[]>;
  requests: Record<string, JoinRequest[]>;
  links: Record<string, string>;
  /** Peticiones de cambio (pendientes y resueltas) por grupo, la más reciente primero. */
  changes: Record<string, ChangeRequest>;
  /** Quién envió cada grupo en revisión (para la cola de moderación). */
  creators: Record<string, PersonInfo>;
}

/** Lo que vería esta persona en la lista: grupos aprobados, y los suyos aunque estén en revisión o rechazados. */
function demoVisible(db: DemoDb): Group[] {
  const me = useAuthStore.getState().user?.id;
  return db.groups.filter((g) => g.status === 'approved' || g.createdBy === me || g.myRole !== null);
}

/** Filtro de texto muy simple solo para el modo demo (en producción lo hace la base de datos). */
function demoScan(text: string): TextScan {
  const hits: TextScan['hits'] = /pendej|idiot|puta|cabron|cabrón/i.test(text)
    ? [{ term: 'pendejo', category: 'insult', severity: 'high' }]
    : [];
  return { verdict: hits.length ? 'flagged' : 'clean', hits };
}

let demoDb: DemoDb | null = null;

function getDemoDb(): DemoDb {
  if (demoDb) return demoDb;
  const mk = (i: number, name: string, description: string, category: GroupCategory, members: number): Group => ({
    id: `demo-group-${i}`,
    name,
    description,
    category,
    imagePath: null,
    imageUrl: '',
    createdBy: demoPeople[i % demoPeople.length].id,
    creatorName: demoPeople[i % demoPeople.length].name,
    createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    memberCount: members,
    myRole: null,
    requestStatus: null,
    pendingRequests: 0,
    status: 'approved',
    reviewNote: '',
    pendingChange: null,
  });
  const groups = [
    mk(0, 'Estructura de Datos · Estudio', 'Repasamos ejercicios y nos preparamos para exámenes. Todos los niveles.', 'estudio', 14),
    mk(1, 'Rodada en bici UAA', 'Salidas los sábados por la mañana. Traer casco y agua.', 'deporte', 9),
    mk(2, 'Cineclub de los jueves', 'Vemos una película y la comentamos. Abierto a todas las carreras.', 'arte', 22),
    // Un grupo que la persona de la demo administra (para probar "Pedir cambios") y dos enviados en revisión
    { ...mk(3, 'Club de ajedrez', 'Partidas y torneos relámpago en la cafetería.', 'social', 2), createdBy: 'demo-user', creatorName: 'Carlos Mendoza', myRole: 'admin' as const },
    { ...mk(4, 'Voluntariado Cruz Roja', 'Colectas y brigadas de primeros auxilios.', 'voluntariado', 1), status: 'pending' as const, createdBy: 'demo-sofia', creatorName: 'Sofía Álvarez' },
    { ...mk(5, 'Fiesta de los pendejos', 'Aquí solo entran los que saben divertirse.', 'social', 1), status: 'pending' as const, createdBy: 'demo-diego', creatorName: 'Diego Ramírez' },
  ];
  demoDb = {
    groups,
    members: Object.fromEntries(
      groups.map((g) => {
        const p = demoPeople.find((d) => d.id === g.createdBy) ?? { id: g.createdBy, name: g.creatorName, career: '', semester: 0 };
        return [g.id, [{ profileId: p.id, name: p.name, career: p.career, semester: p.semester, avatarUrl: '', role: 'admin' as const, isCreator: true }]];
      })
    ),
    requests: {},
    links: Object.fromEntries(groups.map((g) => [g.id, 'https://chat.whatsapp.com/demo'])),
    changes: {},
    creators: Object.fromEntries(demoPeople.map((d) => [d.id, { id: d.id, name: d.name, career: d.career, semester: d.semester, avatarUrl: '' }])),
  };
  // El club de ajedrez tiene un segundo miembro, a quien se le puede pasar el grupo
  demoDb.members['demo-group-3'] = [
    { profileId: 'demo-user', name: 'Carlos Mendoza', career: 'Ingeniería en Sistemas', semester: 6, avatarUrl: '', role: 'admin', isCreator: true },
    { profileId: 'demo-diego', name: 'Diego Ramírez', career: 'Ingeniería en Sistemas', semester: 7, avatarUrl: '', role: 'member', isCreator: false },
  ];
  // Una petición de otro grupo, para que quien modera tenga algo que revisar
  demoDb.changes['demo-group-1'] = {
    id: 'demo-chg-1', kind: 'delete', reason: 'Ya nadie organiza las rodadas y el grupo quedó abandonado desde el semestre pasado.',
    status: 'pending', resolutionNote: '', createdAt: new Date(Date.now() - 7_200_000).toISOString(), requesterName: 'Diego Ramírez', newOwnerId: null, newOwnerName: '',
  };
  return demoDb;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface GroupsState {
  groups: Group[];
  /** Para quien modera: grupos por aprobar y peticiones pendientes. */
  submissions: GroupSubmission[];
  changeRequests: GroupChangeItem[];
  /** Cuenta a la que pertenece la lista cargada (evita mostrar grupos de otra sesión). */
  ownerId: string | null;
  isLoading: boolean;
  error: string | null;

  loadGroups: () => Promise<void>;
  createGroup: (input: GroupInput) => Promise<ActionResult & { id?: string }>;
  updateGroup: (id: string, input: GroupInput) => Promise<ActionResult>;
  /** Quien creó el grupo solo puede retirar uno que aún no se publicó; un moderador elimina con motivo. */
  deleteGroup: (id: string, note?: string) => Promise<ActionResult>;
  requestChange: (groupId: string, kind: ChangeKind, reason: string, newOwnerId?: string) => Promise<ActionResult>;
  cancelChange: (groupId: string) => Promise<ActionResult>;
  loadChangeRequest: (groupId: string) => Promise<ChangeRequest | null>;
  loadModeration: () => Promise<void>;
  reviewGroup: (groupId: string, decision: 'approve' | 'reject', note?: string) => Promise<ActionResult>;
  resolveChange: (requestId: string, approve: boolean, note?: string) => Promise<ActionResult>;
  requestJoin: (id: string, message: string) => Promise<ActionResult>;
  cancelRequest: (id: string) => Promise<ActionResult>;
  leaveGroup: (id: string) => Promise<ActionResult>;
  getLink: (id: string) => Promise<{ url?: string; message?: string }>;
  loadMembers: (id: string) => Promise<GroupMember[]>;
  loadRequests: (id: string) => Promise<JoinRequest[]>;
  resolveRequest: (groupId: string, requestId: string, approve: boolean) => Promise<ActionResult>;
  setAdmin: (groupId: string, profileId: string, makeAdmin: boolean) => Promise<ActionResult>;
  removeMember: (groupId: string, profileId: string) => Promise<ActionResult>;
  reset: () => void;
}

const auth = () => useAuthStore.getState();
const fail = (err: unknown, fallback: string): ActionResult => ({ success: false, message: friendlyError(err, fallback) });

export const useGroupsStore = create<GroupsState>((set, get) => {
  /** Recarga la lista sin mostrar el estado de carga (después de una acción). */
  const refresh = () => get().loadGroups();

  const patchDemoGroup = (id: string, patch: Partial<Group>) => {
    const db = getDemoDb();
    db.groups = db.groups.map((g) => (g.id === id ? { ...g, ...patch } : g));
    set({ groups: demoVisible(db) });
  };

  return {
    groups: [],
    submissions: [],
    changeRequests: [],
    ownerId: null,
    isLoading: false,
    error: null,

    reset: () => {
      demoDb = null;
      set({ groups: [], submissions: [], changeRequests: [], ownerId: null, isLoading: false, error: null });
    },

    loadGroups: async () => {
      const me = auth().user;
      if (!me) return;
      if (get().ownerId !== me.id) set({ groups: [], submissions: [], changeRequests: [], ownerId: me.id });
      if (auth().isDemo) {
        set({ groups: demoVisible(getDemoDb()), isLoading: false, error: null });
        return;
      }
      if (get().groups.length === 0) set({ isLoading: true });
      const { data, error } = await supabase.rpc('list_groups');
      if (error) {
        set({ isLoading: false, error: friendlyError(error, 'No se pudieron cargar los grupos.') });
        return;
      }
      set({ groups: ((data || []) as GroupRow[]).map(mapGroup), isLoading: false, error: null });
    },

    createGroup: async (input) => {
      const { user, isDemo } = auth();
      if (!user) return { success: false };
      const invalid = validateGroupInput(input, { requireLink: true });
      if (invalid) return { success: false, message: invalid };

      if (isDemo) {
        const db = getDemoDb();
        const id = `demo-group-${Date.now()}`;
        const group: Group = {
          id,
          name: input.name.trim(),
          description: input.description.trim(),
          category: input.category,
          imagePath: input.imagePath,
          imageUrl: input.imagePath || '',
          createdBy: user.id,
          creatorName: user.name,
          createdAt: new Date().toISOString(),
          memberCount: 1,
          myRole: 'admin',
          requestStatus: null,
          pendingRequests: 0,
          status: 'pending',
          reviewNote: '',
          pendingChange: null,
        };
        db.groups = [group, ...db.groups];
        db.creators[user.id] = { id: user.id, name: user.name, career: user.career, semester: user.semester, avatarUrl: user.avatarUrl };
        db.links[id] = input.link.trim();
        db.members[id] = [
          { profileId: user.id, name: user.name, career: user.career, semester: user.semester, avatarUrl: user.avatarUrl, role: 'admin', isCreator: true },
        ];
        set({ groups: demoVisible(db) });
        return { success: true, id };
      }

      const { data, error } = await supabase.rpc('create_group', {
        p_name: input.name.trim(),
        p_description: input.description.trim(),
        p_category: input.category,
        p_image_path: input.imagePath,
        p_link: input.link.trim(),
      });
      if (error) return fail(error, 'No se pudo crear el grupo.');
      await refresh();
      return { success: true, id: data as string };
    },

    updateGroup: async (id, input) => {
      if (!auth().user) return { success: false };
      const invalid = validateGroupInput(input, { requireLink: false });
      if (invalid) return { success: false, message: invalid };
      const previous = get().groups.find((g) => g.id === id);

      if (auth().isDemo) {
        const db = getDemoDb();
        if (input.link.trim()) db.links[id] = input.link.trim();
        const changed =
          previous?.name !== input.name.trim() || previous?.description !== input.description.trim() || previous?.imagePath !== input.imagePath;
        patchDemoGroup(id, {
          name: input.name.trim(),
          description: input.description.trim(),
          category: input.category,
          imagePath: input.imagePath,
          imageUrl: input.imagePath || '',
          ...(changed || previous?.status === 'rejected' ? { status: 'pending' as const } : {}),
        });
        return { success: true };
      }

      const { error } = await supabase.rpc('update_group', {
        p_group: id,
        p_name: input.name.trim(),
        p_description: input.description.trim(),
        p_category: input.category,
        p_image_path: input.imagePath,
        p_link: input.link.trim() || null,
      });
      if (error) return fail(error, 'No se pudo guardar el grupo.');
      if (previous?.imagePath && previous.imagePath !== input.imagePath) void removeStoredPhotos([previous.imagePath]);
      await refresh();
      return { success: true };
    },

    deleteGroup: async (id, note) => {
      if (auth().isDemo) {
        const db = getDemoDb();
        db.groups = db.groups.filter((g) => g.id !== id);
        set({ groups: demoVisible(db), submissions: get().submissions.filter((x) => x.id !== id), changeRequests: get().changeRequests.filter((c) => c.group.id !== id) });
        return { success: true };
      }
      const { data, error } = await supabase.rpc('delete_group', { p_group: id, p_note: note?.trim() || null });
      if (error) return fail(error, 'No se pudo eliminar el grupo.');
      if (typeof data === 'string' && data) void removeStoredPhotos([data]);
      set({ groups: get().groups.filter((g) => g.id !== id) });
      void get().loadModeration();
      return { success: true };
    },

    requestChange: async (groupId, kind, reason, newOwnerId) => {
      if (reason.trim().length < 10) return { success: false, message: 'Cuéntanos el motivo (mínimo 10 caracteres).' };
      if (kind === 'transfer' && !newOwnerId) return { success: false, message: 'Elige a la persona que llevará el grupo.' };

      if (auth().isDemo) {
        const db = getDemoDb();
        const owner = newOwnerId ? db.members[groupId]?.find((m) => m.profileId === newOwnerId) : undefined;
        db.changes[groupId] = {
          id: `demo-chg-${Date.now()}`, kind, reason: reason.trim(), status: 'pending', resolutionNote: '', createdAt: new Date().toISOString(),
          requesterName: auth().user?.name || 'Tú', newOwnerId: newOwnerId ?? null, newOwnerName: owner?.name || '',
        };
        patchDemoGroup(groupId, { pendingChange: kind });
        return { success: true };
      }
      const { error } = await supabase.rpc('request_group_change', {
        p_group: groupId, p_kind: kind, p_reason: reason.trim(), p_new_owner: newOwnerId ?? null,
      });
      if (error) return fail(error, 'No se pudo enviar la petición.');
      await refresh();
      return { success: true };
    },

    cancelChange: async (groupId) => {
      if (auth().isDemo) {
        const db = getDemoDb();
        delete db.changes[groupId];
        patchDemoGroup(groupId, { pendingChange: null });
        return { success: true };
      }
      const { error } = await supabase.rpc('cancel_group_change_request', { p_group: groupId });
      if (error) return fail(error, 'No se pudo cancelar la petición.');
      await refresh();
      return { success: true };
    },

    loadChangeRequest: async (groupId) => {
      if (auth().isDemo) return getDemoDb().changes[groupId] ?? null;
      const { data, error } = await supabase.rpc('get_group_change_request', { p_group: groupId });
      if (error) throw new Error(friendlyError(error, 'No se pudo cargar la petición.'));
      const row = ((data || []) as ChangeRequestRow[])[0];
      return row ? mapChangeRequest(row) : null;
    },

    loadModeration: async () => {
      const me = auth().user;
      if (!me || me.role === 'student') return;
      if (auth().isDemo) {
        const db = getDemoDb();
        const submissions: GroupSubmission[] = db.groups
          .filter((g) => g.status === 'pending')
          .map((g) => ({
            id: g.id, name: g.name, description: g.description, category: g.category, imagePath: g.imagePath, imageUrl: g.imageUrl, createdAt: g.createdAt,
            creator: db.creators[g.createdBy] ?? { id: g.createdBy, name: g.creatorName, career: '', avatarUrl: '' },
            textScan: demoScan(`${g.name} ${g.description}`), linkNetwork: 'WhatsApp', resubmitted: false, previousNote: '', priorRejections: 0, memberCount: g.memberCount,
          }))
          // igual que la base de datos: primero los marcados por el filtro
          .sort((x, y) => Number(y.textScan?.verdict === 'flagged') - Number(x.textScan?.verdict === 'flagged'));
        const changeRequests: GroupChangeItem[] = Object.entries(db.changes)
          .filter(([, c]) => c.status === 'pending')
          .map(([groupId, c]) => {
            const g = db.groups.find((x) => x.id === groupId)!;
            const owner = c.newOwnerId ? db.members[groupId]?.find((m) => m.profileId === c.newOwnerId) : undefined;
            return {
              requestId: c.id, kind: c.kind, reason: c.reason, createdAt: c.createdAt,
              group: { id: groupId, name: g?.name ?? 'Grupo', imageUrl: g?.imageUrl ?? '', memberCount: g?.memberCount ?? 0 },
              requester: { id: g?.createdBy ?? '', name: c.requesterName, career: '', avatarUrl: '' },
              newOwner: owner ? { id: owner.profileId, name: owner.name, career: owner.career, avatarUrl: '' } : null,
            };
          });
        set({ submissions, changeRequests });
        return;
      }
      const [subs, reqs] = await Promise.all([supabase.rpc('list_group_submissions'), supabase.rpc('list_group_change_requests')]);
      const failure = subs.error || reqs.error;
      if (failure) {
        set({ error: friendlyError(failure, 'No se pudo cargar la moderación de grupos.') });
        return;
      }
      set({
        submissions: ((subs.data || []) as SubmissionRow[]).map(mapSubmission),
        changeRequests: ((reqs.data || []) as ChangeItemRow[]).map(mapChangeItem),
      });
    },

    reviewGroup: async (groupId, decision, note) => {
      if (decision === 'reject' && (note ?? '').trim().length < 3) return { success: false, message: 'Escribe el motivo del rechazo: lo verá quien envió el grupo.' };
      if (auth().isDemo) {
        patchDemoGroup(groupId, decision === 'approve' ? { status: 'approved', reviewNote: '' } : { status: 'rejected', reviewNote: (note ?? '').trim() });
        await get().loadModeration();
        return { success: true };
      }
      const { error } = await supabase.rpc('review_group', { p_group: groupId, p_decision: decision, p_note: note?.trim() || null });
      if (error) return fail(error, 'No se pudo guardar la decisión.');
      await Promise.all([get().loadModeration(), refresh()]);
      return { success: true };
    },

    resolveChange: async (requestId, approve, note) => {
      if (!approve && (note ?? '').trim().length < 3) return { success: false, message: 'Escribe el motivo del rechazo: lo verán los administradores del grupo.' };
      if (auth().isDemo) {
        const db = getDemoDb();
        const entry = Object.entries(db.changes).find(([, c]) => c.id === requestId);
        if (!entry) return { success: false };
        const [groupId, c] = entry;
        if (!approve) {
          db.changes[groupId] = { ...c, status: 'rejected', resolutionNote: (note ?? '').trim() };
          patchDemoGroup(groupId, { pendingChange: null });
        } else if (c.kind === 'delete') {
          delete db.changes[groupId];
          db.groups = db.groups.filter((g) => g.id !== groupId);
          set({ groups: demoVisible(db) });
        } else {
          const owner = db.members[groupId]?.find((m) => m.profileId === c.newOwnerId);
          if (owner) {
            db.members[groupId] = db.members[groupId].map((m) => ({ ...m, isCreator: m.profileId === owner.profileId, role: m.profileId === owner.profileId ? 'admin' : m.role }));
            patchDemoGroup(groupId, { createdBy: owner.profileId, creatorName: owner.name, pendingChange: null, myRole: auth().user?.id === owner.profileId ? 'admin' : db.groups.find((g) => g.id === groupId)?.myRole ?? null });
          }
          db.changes[groupId] = { ...c, status: 'approved', resolutionNote: (note ?? '').trim() };
        }
        await get().loadModeration();
        return { success: true };
      }
      const { data, error } = await supabase.rpc('resolve_group_change', { p_request: requestId, p_approve: approve, p_note: note?.trim() || null });
      if (error) return fail(error, 'No se pudo resolver la petición.');
      if (typeof data === 'string' && data) void removeStoredPhotos([data]);
      await Promise.all([get().loadModeration(), refresh()]);
      return { success: true };
    },

    requestJoin: async (id, message) => {
      if (auth().isDemo) {
        patchDemoGroup(id, { requestStatus: 'pending' });
        return { success: true };
      }
      const { error } = await supabase.rpc('request_join_group', { p_group: id, p_message: message.trim() || null });
      if (error) return fail(error, 'No se pudo enviar la solicitud.');
      await refresh();
      return { success: true };
    },

    cancelRequest: async (id) => {
      if (auth().isDemo) {
        patchDemoGroup(id, { requestStatus: null });
        return { success: true };
      }
      const { error } = await supabase.rpc('cancel_join_request', { p_group: id });
      if (error) return fail(error, 'No se pudo cancelar la solicitud.');
      await refresh();
      return { success: true };
    },

    leaveGroup: async (id) => {
      if (auth().isDemo) {
        const g = get().groups.find((x) => x.id === id);
        patchDemoGroup(id, { myRole: null, requestStatus: null, memberCount: Math.max(0, (g?.memberCount ?? 1) - 1) });
        return { success: true };
      }
      const { error } = await supabase.rpc('leave_group', { p_group: id });
      if (error) return fail(error, 'No se pudo salir del grupo.');
      await refresh();
      return { success: true };
    },

    getLink: async (id) => {
      if (auth().isDemo) return { url: getDemoDb().links[id] };
      const { data, error } = await supabase.rpc('get_group_link', { p_group: id });
      if (error) return { message: friendlyError(error, 'No se pudo obtener el enlace.') };
      return { url: (data as string | null) || undefined };
    },

    loadMembers: async (id) => {
      if (auth().isDemo) return getDemoDb().members[id] ?? [];
      const { data, error } = await supabase.rpc('get_group_members', { p_group: id });
      if (error) throw new Error(friendlyError(error, 'No se pudieron cargar los miembros.'));
      return ((data || []) as MemberRow[]).map(mapMember);
    },

    loadRequests: async (id) => {
      if (auth().isDemo) return getDemoDb().requests[id] ?? [];
      const { data, error } = await supabase.rpc('get_group_requests', { p_group: id });
      if (error) throw new Error(friendlyError(error, 'No se pudieron cargar las solicitudes.'));
      return ((data || []) as RequestRow[]).map(mapRequest);
    },

    resolveRequest: async (groupId, requestId, approve) => {
      if (auth().isDemo) {
        const db = getDemoDb();
        const req = (db.requests[groupId] ?? []).find((r) => r.requestId === requestId);
        db.requests[groupId] = (db.requests[groupId] ?? []).filter((r) => r.requestId !== requestId);
        const g = db.groups.find((x) => x.id === groupId);
        if (approve && req) {
          db.members[groupId] = [
            ...(db.members[groupId] ?? []),
            { profileId: req.profileId, name: req.name, career: req.career, semester: req.semester, avatarUrl: req.avatarUrl, role: 'member', isCreator: false },
          ];
        }
        patchDemoGroup(groupId, {
          memberCount: (g?.memberCount ?? 0) + (approve ? 1 : 0),
          pendingRequests: db.requests[groupId].length,
        });
        return { success: true };
      }
      const { error } = await supabase.rpc('resolve_join_request', { p_request: requestId, p_approve: approve });
      if (error) return fail(error, 'No se pudo responder la solicitud.');
      await refresh();
      return { success: true };
    },

    setAdmin: async (groupId, profileId, makeAdmin) => {
      if (auth().isDemo) {
        const db = getDemoDb();
        db.members[groupId] = (db.members[groupId] ?? []).map((m) =>
          m.profileId === profileId ? { ...m, role: makeAdmin ? 'admin' : 'member' } : m
        );
        return { success: true };
      }
      const { error } = await supabase.rpc('set_group_admin', { p_group: groupId, p_profile: profileId, p_make_admin: makeAdmin });
      if (error) return fail(error, 'No se pudo cambiar el rol.');
      return { success: true };
    },

    removeMember: async (groupId, profileId) => {
      if (auth().isDemo) {
        const db = getDemoDb();
        db.members[groupId] = (db.members[groupId] ?? []).filter((m) => m.profileId !== profileId);
        const g = db.groups.find((x) => x.id === groupId);
        patchDemoGroup(groupId, { memberCount: Math.max(1, (g?.memberCount ?? 1) - 1) });
        return { success: true };
      }
      const { error } = await supabase.rpc('remove_group_member', { p_group: groupId, p_profile: profileId });
      if (error) return fail(error, 'No se pudo quitar a la persona.');
      await refresh();
      return { success: true };
    },
  };
});
