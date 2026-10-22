import { create } from 'zustand';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { photoUrl, removeStoredPhotos } from '@/lib/photos';
import { useAuthStore, type ActionResult } from '@/features/auth/authStore';

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
  });
  const groups = [
    mk(0, 'Estructura de Datos · Estudio', 'Repasamos ejercicios y nos preparamos para exámenes. Todos los niveles.', 'estudio', 14),
    mk(1, 'Rodada en bici', 'Salidas los sábados por la mañana. Traer casco y agua.', 'deporte', 9),
    mk(2, 'Cineclub de los jueves', 'Vemos una película y la comentamos. Abierto a todas las carreras.', 'arte', 22),
  ];
  demoDb = {
    groups,
    members: Object.fromEntries(
      groups.map((g) => {
        const p = demoPeople.find((d) => d.id === g.createdBy)!;
        return [g.id, [{ profileId: p.id, name: p.name, career: p.career, semester: p.semester, avatarUrl: '', role: 'admin' as const, isCreator: true }]];
      })
    ),
    requests: {},
    links: Object.fromEntries(groups.map((g) => [g.id, 'https://chat.whatsapp.com/demo'])),
  };
  return demoDb;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface GroupsState {
  groups: Group[];
  /** Cuenta a la que pertenece la lista cargada (evita mostrar grupos de otra sesión). */
  ownerId: string | null;
  isLoading: boolean;
  error: string | null;

  loadGroups: () => Promise<void>;
  createGroup: (input: GroupInput) => Promise<ActionResult & { id?: string }>;
  updateGroup: (id: string, input: GroupInput) => Promise<ActionResult>;
  deleteGroup: (id: string) => Promise<ActionResult>;
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
    set({ groups: db.groups });
  };

  return {
    groups: [],
    ownerId: null,
    isLoading: false,
    error: null,

    reset: () => {
      demoDb = null;
      set({ groups: [], ownerId: null, isLoading: false, error: null });
    },

    loadGroups: async () => {
      const me = auth().user;
      if (!me) return;
      if (get().ownerId !== me.id) set({ groups: [], ownerId: me.id });
      if (auth().isDemo) {
        set({ groups: getDemoDb().groups, isLoading: false, error: null });
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
        };
        db.groups = [group, ...db.groups];
        db.links[id] = input.link.trim();
        db.members[id] = [
          { profileId: user.id, name: user.name, career: user.career, semester: user.semester, avatarUrl: user.avatarUrl, role: 'admin', isCreator: true },
        ];
        set({ groups: db.groups });
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
        patchDemoGroup(id, {
          name: input.name.trim(),
          description: input.description.trim(),
          category: input.category,
          imagePath: input.imagePath,
          imageUrl: input.imagePath || '',
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

    deleteGroup: async (id) => {
      if (auth().isDemo) {
        const db = getDemoDb();
        db.groups = db.groups.filter((g) => g.id !== id);
        set({ groups: db.groups });
        return { success: true };
      }
      const { data, error } = await supabase.rpc('delete_group', { p_group: id });
      if (error) return fail(error, 'No se pudo eliminar el grupo.');
      if (typeof data === 'string' && data) void removeStoredPhotos([data]);
      set({ groups: get().groups.filter((g) => g.id !== id) });
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
