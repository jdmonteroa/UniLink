import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  ArrowLeft,
  ImagePlus,
  Loader2,
  AlertCircle,
  Users,
  ExternalLink,
  Check,
  X,
  Crown,
  ShieldCheck,
  ShieldOff,
  UserMinus,
  Pencil,
  Trash2,
  LogOut,
  Clock,
  Link2,
  Info,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import {
  useGroupsStore,
  GROUP_CATEGORIES,
  categoryLabel,
  linkNetwork,
  linkError,
  type Group,
  type GroupCategory,
  type GroupMember,
  type JoinRequest,
} from '@/features/groups/groupsStore';
import { photoUrl, removeStoredPhotos, uploadProfilePhoto } from '@/lib/photos';
import { Avatar } from '@/components/Avatar';
import { confirmDialog } from '@/components/ConfirmDialog';
import { Highlight } from '@/components/brand';
import { GroupChangePanel } from '@/features/groups/GroupChangePanel';
import { chip } from '@/features/events/ui';
import { GroupsModeration } from '@/features/groups/GroupsModeration';

const MAX_DESCRIPTION = 500;
const inputCls =
  'w-full px-4 py-3 rounded-lg bg-white/70 dark:bg-white/[0.04] border-2 border-slate-900/10 dark:border-white/10 text-base text-slate-900 dark:text-slate-50 outline-none transition-colors focus:border-slate-900 dark:focus:border-slate-50 placeholder:text-slate-500 dark:placeholder:text-haze-400';
const labelCls = 'block mb-1.5 text-sm font-semibold';
const card = 'rounded-3xl bg-white dark:bg-ink-850 p-5 shadow-soft-sm space-y-4';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none';
const outlineBtn =
  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full border-2 border-slate-900/15 dark:border-white/15 hover:border-slate-900 dark:hover:border-white text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none';
const iconBtn =
  'w-9 h-9 flex items-center justify-center rounded-full text-slate-600 dark:text-haze-300 hover:bg-haze-100 dark:hover:bg-ink-800 hover:text-slate-900 dark:hover:text-slate-50 transition';

const CATEGORY_BG: Record<GroupCategory, string> = {
  estudio: 'bg-mint',
  deporte: 'bg-sun',
  arte: 'bg-coral',
  musica: 'bg-coral',
  videojuegos: 'bg-mint',
  tecnologia: 'bg-mint',
  idiomas: 'bg-sun',
  voluntariado: 'bg-sun',
  social: 'bg-coral',
  otro: 'bg-haze-200 dark:bg-ink-700',
};

type Notice = { kind: 'error' | 'ok'; text: string } | null;
type View = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'form'; editId?: string };

const NoticeBanner: React.FC<{ notice: Notice }> = ({ notice }) => (
  <AnimatePresence>
    {notice && (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        role="status"
        className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
          notice.kind === 'error'
            ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
            : 'bg-mint/40 dark:bg-mint/10 text-azure-900 dark:text-azure-200'
        }`}
      >
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{notice.text}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

/** Imagen del grupo, o un cuadro de color con la inicial si no tiene. */
const GroupImage: React.FC<{ group: Pick<Group, 'name' | 'category' | 'imageUrl'>; className?: string }> = ({ group, className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (group.imageUrl && !failed) {
    return <img src={group.imageUrl} alt="" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center font-serif font-semibold text-slate-900 ${CATEGORY_BG[group.category]} ${className}`} aria-hidden>
      <span className="text-[1.6em]">{group.name.trim()[0]?.toUpperCase() || '?'}</span>
    </div>
  );
};

const useNotice = () => {
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
};

const Spinner: React.FC = () => (
  <div className="flex justify-center py-12" role="status" aria-label="Cargando">
    <div className="flex gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full bg-mint animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2.5 h-2.5 rounded-full bg-sun animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2.5 h-2.5 rounded-full bg-coral animate-bounce" />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------
const GroupCard: React.FC<{ group: Group; onOpen: () => void }> = ({ group, onOpen }) => {
  const status =
    group.myRole === 'admin' ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
        <ShieldCheck className="w-3.5 h-3.5" /> Administras
        {group.pendingRequests > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px]">{group.pendingRequests}</span>
        )}
      </span>
    ) : group.myRole === 'member' ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-azure-700 dark:text-azure-300">
        <Check className="w-3.5 h-3.5" /> Eres miembro
      </span>
    ) : group.requestStatus === 'pending' ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-sun">
        <Clock className="w-3.5 h-3.5" /> Solicitud enviada
      </span>
    ) : null;

  const reviewBadge =
    group.status === 'pending' ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-sun">
        <Clock className="w-3.5 h-3.5" /> En revisión
      </span>
    ) : group.status === 'rejected' ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
        <AlertCircle className="w-3.5 h-3.5" /> Rechazado · toca para corregir
      </span>
    ) : group.pendingChange ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-haze-300">
        <Clock className="w-3.5 h-3.5" /> Petición en revisión
      </span>
    ) : null;

  return (
    <button
      onClick={onOpen}
      className="w-full text-left flex items-center gap-3.5 p-3 rounded-2xl bg-white dark:bg-ink-850 shadow-soft-sm hover:-translate-y-0.5 active:scale-[0.99] transition"
    >
      <GroupImage group={group} className="w-16 h-16 rounded-2xl shrink-0 text-2xl" />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block font-semibold truncate">{group.name}</span>
        <span className="block text-xs text-slate-500 dark:text-haze-400">
          {categoryLabel(group.category)} · {group.memberCount} {group.memberCount === 1 ? 'miembro' : 'miembros'}
        </span>
        {reviewBadge}
        {group.status === 'approved' && status}
      </span>
    </button>
  );
};

const GroupList: React.FC<{ onOpen: (id: string) => void; onCreate: () => void }> = ({ onOpen, onCreate }) => {
  const { groups, isLoading, error, loadGroups } = useGroupsStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<GroupCategory | 'all'>('all');

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter(
      (g) =>
        (category === 'all' || g.category === category) &&
        (!q || g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q))
    );
  }, [groups, query, category]);

  const mine = filtered.filter((g) => g.myRole);
  const others = filtered.filter((g) => !g.myRole);

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-4xl font-semibold leading-none">
            <Highlight>Grupos</Highlight>
          </h2>
          <p className="text-sm text-slate-500 dark:text-haze-400 mt-3">Pide entrar y te damos el enlace cuando te acepten.</p>
        </div>
        <button onClick={onCreate} className={`${primaryBtn} h-11 px-4 shrink-0`}>
          <Plus className="w-4 h-4" /> Proponer
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar grupos"
          aria-label="Buscar grupos"
          className={`${inputCls} pl-11`}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" role="group" aria-label="Filtrar por categoría">
        {[{ id: 'all' as const, label: 'Todos' }, ...GROUP_CATEGORIES].map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            aria-pressed={category === c.id}
            className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
              category === c.id
                ? 'bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900'
                : 'bg-haze-100 dark:bg-ink-800 text-slate-700 dark:text-haze-300 hover:bg-haze-200 dark:hover:bg-ink-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}

      {isLoading && groups.length === 0 ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-4 px-6 py-12 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10">
          <span className="w-16 h-16 rounded-full bg-mint text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker">
            <Users className="w-7 h-7" />
          </span>
          <h3 className="text-2xl font-semibold">Aún no hay grupos</h3>
          <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[30ch]">Propón el primero: un grupo de estudio, de deporte, de lo que quieras. Un administrador lo revisa antes de publicarlo.</p>
          <button onClick={onCreate} className={primaryBtn}>Proponer un grupo</button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-haze-400 py-10">No encontramos grupos con esa búsqueda.</p>
      ) : (
        <>
          {mine.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-haze-400">Mis grupos</h3>
              {mine.map((g) => <GroupCard key={g.id} group={g} onOpen={() => onOpen(g.id)} />)}
            </section>
          )}
          {others.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-haze-400">
                {mine.length > 0 ? 'Explorar' : 'Grupos de tu universidad'}
              </h3>
              {others.map((g) => <GroupCard key={g.id} group={g} onOpen={() => onOpen(g.id)} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------
const MemberRow: React.FC<{
  member: GroupMember;
  canManage: boolean;
  isCreatorViewing: boolean;
  isMe: boolean;
  onToggleAdmin: () => void;
  onRemove: () => void;
}> = ({ member, canManage, isCreatorViewing, isMe, onToggleAdmin, onRemove }) => (
  <li className="flex items-center gap-3">
    <Avatar src={member.avatarUrl} name={member.name} className="w-10 h-10 text-sm" />
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-sm truncate flex items-center gap-1.5">
        {member.name}
        {isMe && <span className="text-xs font-normal text-slate-500 dark:text-haze-400">(tú)</span>}
        {member.isCreator ? (
          <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-sun shrink-0" aria-label="Creador" />
        ) : member.role === 'admin' ? (
          <ShieldCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-label="Administrador" />
        ) : null}
      </p>
      <p className="text-xs text-slate-500 dark:text-haze-400 truncate">
        {[member.career, member.semester ? `${member.semester}.º semestre` : ''].filter(Boolean).join(' · ')}
      </p>
    </div>
    {canManage && !member.isCreator && !isMe && (
      <div className="flex shrink-0">
        {isCreatorViewing && (
          <button
            onClick={onToggleAdmin}
            className={iconBtn}
            aria-label={member.role === 'admin' ? `Quitar administrador a ${member.name}` : `Hacer administrador a ${member.name}`}
            title={member.role === 'admin' ? 'Quitar administrador' : 'Hacer administrador'}
          >
            {member.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </button>
        )}
        {(isCreatorViewing || member.role !== 'admin') && (
          <button onClick={onRemove} className={`${iconBtn} hover:text-rose-600`} aria-label={`Quitar a ${member.name} del grupo`} title="Quitar del grupo">
            <UserMinus className="w-4 h-4" />
          </button>
        )}
      </div>
    )}
  </li>
);

const GroupDetail: React.FC<{ id: string; onBack: () => void; onEdit: () => void }> = ({ id, onBack, onEdit }) => {
  const { user } = useAuthStore();
  const store = useGroupsStore();
  const group = store.groups.find((g) => g.id === id);
  const [notice, setNotice] = useNotice();
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const isMember = !!group?.myRole;
  const isAdmin = group?.myRole === 'admin';
  const isCreator = !!group && group.createdBy === user?.id;
  const isPlatformMod = user?.role === 'moderator' || user?.role === 'admin';
  const approved = group?.status === 'approved';
  const [showModDelete, setShowModDelete] = useState(false);
  const [modReason, setModReason] = useState('');

  const reload = async () => {
    if (!group) return;
    try {
      if (isMember) setMembers(await store.loadMembers(id));
      if (isAdmin) setRequests(await store.loadRequests(id));
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'No se pudo cargar el grupo.' });
    }
  };

  useEffect(() => {
    void reload();
    // Se recarga cuando cambia el rol (p. ej. al ser aceptado) o la cantidad de miembros
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, group?.myRole, group?.memberCount, group?.pendingRequests]);

  if (!group) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className={iconBtn} aria-label="Volver"><ArrowLeft className="w-5 h-5" /></button>
        <p className="text-sm text-slate-500 dark:text-haze-400">Este grupo ya no existe.</p>
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<{ success: boolean; message?: string }>, okText?: string) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.success) setNotice({ kind: 'error', text: res.message || 'No se pudo completar la acción.' });
    else if (okText) setNotice({ kind: 'ok', text: okText });
    return res.success;
  };

  const openLink = async () => {
    setBusy('link');
    const res = await store.getLink(id);
    setBusy(null);
    if (!res.url) {
      setNotice({ kind: 'error', text: res.message || 'Este grupo no tiene enlace.' });
      return;
    }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  };

  const leave = async () => {
    const ok = await confirmDialog({
      title: `¿Salir de ${group.name}?`,
      message: 'Para volver a entrar tendrás que pedirlo de nuevo.',
      confirmLabel: 'Salir',
      tone: 'danger',
    });
    if (ok && (await run('leave', () => store.leaveGroup(id)))) onBack();
  };

  // Quien lo creó solo puede retirar un grupo que todavía no se publicó (en revisión o rechazado)
  const withdraw = async () => {
    const ok = await confirmDialog({
      title: `¿Retirar ${group.name}?`,
      message: 'Se borrará el grupo y no se enviará a revisión. Esta acción no se puede deshacer.',
      confirmLabel: 'Retirar grupo',
      tone: 'danger',
    });
    if (ok && (await run('delete', () => store.deleteGroup(id)))) onBack();
  };

  // Un moderador o administrador elimina un grupo aprobado, siempre con motivo
  const modDelete = async () => {
    const ok = await confirmDialog({
      title: `¿Eliminar ${group.name}?`,
      message: 'Se borrará para todos sus miembros y el motivo quedará registrado. No se puede deshacer.',
      confirmLabel: 'Eliminar grupo',
      tone: 'danger',
    });
    if (ok && (await run('delete', () => store.deleteGroup(id, modReason)))) onBack();
  };

  const kick = async (m: GroupMember) => {
    const ok = await confirmDialog({
      title: `¿Quitar a ${m.name.split(' ')[0]}?`,
      message: 'Dejará de ver el enlace del grupo.',
      confirmLabel: 'Quitar',
      tone: 'danger',
      icon: 'user-x',
    });
    if (ok && (await run(`kick-${m.profileId}`, () => store.removeMember(id, m.profileId), 'Persona quitada del grupo.'))) await reload();
  };

  const toggleAdmin = async (m: GroupMember) => {
    const make = m.role !== 'admin';
    if (await run(`role-${m.profileId}`, () => store.setAdmin(id, m.profileId, make), make ? `${m.name.split(' ')[0]} ahora es administrador.` : 'Ya no es administrador.')) {
      await reload();
    }
  };

  const answer = async (r: JoinRequest, approve: boolean) => {
    const ok = await run(`req-${r.requestId}`, () => store.resolveRequest(id, r.requestId, approve), approve ? `${r.name.split(' ')[0]} entró al grupo.` : 'Solicitud rechazada.');
    if (ok) await reload();
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className={iconBtn} aria-label="Volver a grupos"><ArrowLeft className="w-5 h-5" /></button>
        {isAdmin && (
          <button onClick={onEdit} className={`${iconBtn} w-auto px-3 gap-1.5 text-sm font-semibold`}>
            <Pencil className="w-4 h-4" /> Editar
          </button>
        )}
      </div>

      <GroupImage group={group} className="w-full aspect-16/9 rounded-3xl text-5xl" />

      <div className="space-y-1.5">
        <h2 className="text-3xl font-semibold leading-tight">{group.name}</h2>
        <p className="text-sm text-slate-500 dark:text-haze-400">
          {categoryLabel(group.category)} · {group.memberCount} {group.memberCount === 1 ? 'miembro' : 'miembros'} · Creado por {group.creatorName.split(' ')[0]}
        </p>
        {group.description && <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed pt-1 whitespace-pre-line">{group.description}</p>}
      </div>

      <NoticeBanner notice={notice} />

      {group.status === 'pending' && (
        <p className="flex gap-2.5 p-4 rounded-2xl bg-sun/30 dark:bg-sun/10 text-sm">
          <Clock className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            <strong>Tu grupo está en revisión.</strong> Un administrador de UniLink verá el nombre, la imagen y la descripción antes de publicarlo.
            Mientras tanto nadie más lo ve. Puedes editarlo o retirarlo.
          </span>
        </p>
      )}
      {group.status === 'rejected' && (
        <div className="p-4 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 text-sm space-y-3">
          <p className="flex gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              <strong>Tu grupo no pasó la revisión.</strong>
              {group.reviewNote && <> Motivo: {group.reviewNote}</>}
            </span>
          </p>
          <button onClick={onEdit} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold transition active:scale-[0.97]">
            <Pencil className="w-4 h-4" /> Corregir y reenviar
          </button>
        </div>
      )}

      {/* Acción principal según mi relación con el grupo */}
      {isMember ? (
        !approved ? null : <button onClick={() => void openLink()} disabled={busy === 'link'} className={`${primaryBtn} w-full h-14 text-base`}>
          {busy === 'link' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          Abrir el grupo
        </button>
      ) : group.requestStatus === 'pending' ? (
        <div className={`${card} text-center`}>
          <p className="font-semibold flex items-center justify-center gap-2"><Clock className="w-4 h-4" /> Solicitud enviada</p>
          <p className="text-sm text-slate-500 dark:text-haze-400">Cuando un administrador te acepte, aquí aparecerá el enlace.</p>
          <button onClick={() => void run('cancel', () => store.cancelRequest(id))} disabled={busy === 'cancel'} className={outlineBtn}>
            Cancelar solicitud
          </button>
        </div>
      ) : (
        <div className={card}>
          {group.requestStatus === 'rejected' && (
            <p className="text-sm text-rose-700 dark:text-rose-400">Tu solicitud anterior fue rechazada. Puedes intentarlo de nuevo pasados unos días.</p>
          )}
          <div>
            <label htmlFor="join-msg" className={`${labelCls} flex justify-between`}>
              <span>Mensaje para los administradores <span className="font-normal text-slate-500 dark:text-haze-400">(opcional)</span></span>
              <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{message.length}/200</span>
            </label>
            <textarea
              id="join-msg"
              rows={2}
              maxLength={200}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cuéntales por qué quieres unirte"
              className={inputCls}
            />
          </div>
          <button
            onClick={() => void run('join', () => store.requestJoin(id, message), 'Solicitud enviada.')}
            disabled={busy === 'join'}
            className={`${primaryBtn} w-full`}
          >
            {busy === 'join' && <Loader2 className="w-4 h-4 animate-spin" />}
            Pedir unirme
          </button>
        </div>
      )}

      {/* Solicitudes pendientes (solo administradores) */}
      {isAdmin && requests.length > 0 && (
        <section className={card}>
          <h3 className="text-xl font-semibold">Solicitudes ({requests.length})</h3>
          <ul className="space-y-4">
            {requests.map((r) => (
              <li key={r.requestId} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar src={r.avatarUrl} name={r.name} className="w-11 h-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{r.name}</p>
                    <p className="text-xs text-slate-500 dark:text-haze-400 truncate">
                      {[r.career, r.semester ? `${r.semester}.º semestre` : ''].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    onClick={() => void answer(r, false)}
                    disabled={busy === `req-${r.requestId}`}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-haze-100 dark:bg-ink-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-700 transition disabled:opacity-60"
                    aria-label={`Rechazar a ${r.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void answer(r, true)}
                    disabled={busy === `req-${r.requestId}`}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-mint text-slate-900 shadow-sticker hover:-translate-y-0.5 transition disabled:opacity-60"
                    aria-label={`Aceptar a ${r.name}`}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
                {r.message && <p className="text-sm text-slate-600 dark:text-haze-300 pl-14">“{r.message}”</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Miembros (solo los ven los miembros) */}
      {isMember && (
        <section className={card}>
          <h3 className="text-xl font-semibold">Miembros</h3>
          {members === null ? (
            <Spinner />
          ) : (
            <ul className="space-y-3.5">
              {members.map((m) => (
                <MemberRow
                  key={m.profileId}
                  member={m}
                  canManage={isAdmin}
                  isCreatorViewing={isCreator}
                  isMe={m.profileId === user?.id}
                  onToggleAdmin={() => void toggleAdmin(m)}
                  onRemove={() => void kick(m)}
                />
              ))}
            </ul>
          )}
          {isCreator && <p className="text-xs text-slate-500 dark:text-haze-400">Solo quien ya está en el grupo puede ser administrador. Tú decides quién.</p>}
        </section>
      )}

      {isMember && !isCreator && (
        <button onClick={() => void leave()} className={`${outlineBtn} w-full text-rose-700 dark:text-rose-400`}>
          <LogOut className="w-4 h-4" /> Salir del grupo
        </button>
      )}
      {isAdmin && approved && <GroupChangePanel group={group} members={members} isCreator={isCreator} onNotice={setNotice} />}

      {isCreator && !approved && (
        <button onClick={() => void withdraw()} className={`${outlineBtn} w-full text-rose-700 dark:text-rose-400`}>
          <Trash2 className="w-4 h-4" /> Retirar grupo
        </button>
      )}

      {isPlatformMod && approved && (
        <section className={card} aria-label="Administración de UniLink">
          <div>
            <h3 className="text-xl font-semibold">Administración de UniLink</h3>
            <p className="text-sm text-slate-500 dark:text-haze-400 mt-1">Solo un administrador puede eliminar un grupo aprobado.</p>
          </div>
          {!showModDelete ? (
            <button onClick={() => setShowModDelete(true)} className={`${outlineBtn} w-full text-rose-700 dark:text-rose-400`}>
              <Trash2 className="w-4 h-4" /> Eliminar grupo
            </button>
          ) : (
            <div className="space-y-3">
              <label htmlFor="mod-del" className={labelCls}>Motivo de la eliminación</label>
              <textarea id="mod-del" rows={3} maxLength={300} value={modReason} onChange={(e) => setModReason(e.target.value)} className={inputCls} />
              <div className="flex gap-3">
                <button onClick={() => { setShowModDelete(false); setModReason(''); }} className={`${outlineBtn} h-12`}>Cancelar</button>
                <button
                  onClick={() => void modDelete()}
                  disabled={modReason.trim().length < 5 || busy === 'delete'}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50"
                >
                  {busy === 'delete' && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar grupo
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Crear / editar
// ---------------------------------------------------------------------------
const GroupForm: React.FC<{ editId?: string; onDone: (id?: string) => void; onCancel: () => void }> = ({ editId, onDone, onCancel }) => {
  const { user, isDemo } = useAuthStore();
  const { groups, createGroup, updateGroup, getLink } = useGroupsStore();
  const existing = editId ? groups.find((g) => g.id === editId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState<GroupCategory>(existing?.category ?? 'estudio');
  const [imagePath, setImagePath] = useState<string | null>(existing?.imagePath ?? null);
  const [link, setLink] = useState('');
  const [currentNetwork, setCurrentNetwork] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touchedLink, setTouchedLink] = useState(false);
  const [notice, setNotice] = useNotice();
  const fileRef = useRef<HTMLInputElement>(null);
  // Archivos subidos en esta pantalla que podrían quedar huérfanos si se cancela
  const uploaded = useRef<string[]>([]);

  useEffect(() => {
    if (!editId) return;
    void getLink(editId).then((res) => res.url && setCurrentNetwork(linkNetwork(res.url)));
  }, [editId, getLink]);

  if (!user) return null;

  const isEdit = !!editId;
  const network = link.trim() ? linkNetwork(link) : null;
  const linkProblem = isEdit && !link.trim() ? null : linkError(link);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = isDemo ? URL.createObjectURL(file) : await uploadProfilePhoto(user.id, file);
      uploaded.current.push(path);
      setImagePath(path);
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'No se pudo subir la imagen.' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const discardUploads = (keep: string | null) => {
    if (isDemo) return;
    const orphans = uploaded.current.filter((p) => p !== keep);
    if (orphans.length) void removeStoredPhotos(orphans);
  };

  const cancel = () => {
    discardUploads(null);
    onCancel();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedLink(true);
    setSaving(true);
    const input = { name, description, category, imagePath, link };
    const res: { success: boolean; message?: string; id?: string } = isEdit
      ? await updateGroup(editId!, input)
      : await createGroup(input);
    setSaving(false);
    if (!res.success) {
      setNotice({ kind: 'error', text: res.message || 'No se pudo guardar el grupo.' });
      return;
    }
    discardUploads(imagePath);
    onDone(res.id ?? editId);
  };

  if (isEdit && !existing) {
    return (
      <div className="space-y-4">
        <button onClick={onCancel} className={iconBtn} aria-label="Volver"><ArrowLeft className="w-5 h-5" /></button>
        <p className="text-sm text-slate-500 dark:text-haze-400">Este grupo ya no existe.</p>
      </div>
    );
  }

  const preview = { name: name || 'Grupo', category, imageUrl: photoUrl(imagePath) };

  return (
    <form onSubmit={save} className="space-y-5 pb-6">
      <div className="flex items-center gap-2">
        <button type="button" onClick={cancel} className={iconBtn} aria-label="Cancelar"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="text-3xl font-semibold leading-none">{isEdit ? 'Editar grupo' : 'Proponer un grupo'}</h2>
      </div>

      <NoticeBanner notice={notice} />

      {!isEdit && (
        <p className="flex gap-2.5 p-3.5 rounded-xl bg-sun/30 dark:bg-sun/10 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Tu grupo se <strong>revisa antes de publicarse</strong>: un administrador verá el nombre, la imagen y la descripción. Evita insultos, contenido sexual y spam.</span>
        </p>
      )}
      {isEdit && existing?.status === 'approved' && (
        <p className="flex gap-2.5 p-3.5 rounded-xl bg-sun/30 dark:bg-sun/10 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Si cambias el <strong>nombre, la descripción o la imagen</strong>, el grupo vuelve a revisión. El enlace y la categoría se cambian al momento.</span>
        </p>
      )}
      {isEdit && existing?.status === 'rejected' && (
        <p className="flex gap-2.5 p-3.5 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-sm text-rose-900 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span><strong>No pasó la revisión.</strong>{existing.reviewNote && <> {existing.reviewNote}</>} Corrígelo y se enviará de nuevo.</span>
        </p>
      )}

      <div className="flex items-center gap-4">
        <GroupImage group={preview} className="w-24 h-24 rounded-3xl text-3xl shrink-0" />
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pickImage(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={outlineBtn}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {imagePath ? 'Cambiar imagen' : 'Agregar imagen'}
          </button>
          {imagePath && (
            <button type="button" onClick={() => setImagePath(null)} className="block text-sm font-semibold text-slate-500 dark:text-haze-400 hover:text-rose-600">
              Quitar imagen
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="g-name" className={`${labelCls} flex justify-between`}>
          <span>Nombre</span>
          <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{name.length}/60</span>
        </label>
        <input id="g-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ej. Repaso de Cálculo II" className={inputCls} required />
      </div>

      <div>
        <span className={labelCls}>Categoría</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
          {GROUP_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.id}
              role="radio"
              aria-checked={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                category === c.id
                  ? 'bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900'
                  : 'bg-haze-100 dark:bg-ink-800 text-slate-700 dark:text-haze-300 hover:bg-haze-200 dark:hover:bg-ink-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="g-desc" className={`${labelCls} flex justify-between`}>
          <span>¿De qué trata?</span>
          <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{description.length}/{MAX_DESCRIPTION}</span>
        </label>
        <textarea
          id="g-desc"
          rows={4}
          maxLength={MAX_DESCRIPTION}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Qué hacen, cuándo se juntan, a quién buscan…"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="g-link" className={labelCls}>
          Enlace del grupo {isEdit && <span className="font-normal text-slate-500 dark:text-haze-400">(déjalo vacío para conservar el actual{currentNetwork ? `: ${currentNetwork}` : ''})</span>}
        </label>
        <div className="relative">
          <Link2 className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="g-link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={() => setTouchedLink(true)}
            placeholder="https://chat.whatsapp.com/…"
            className={`${inputCls} pl-11`}
            autoComplete="off"
            aria-invalid={touchedLink && !!linkProblem}
          />
        </div>
        {touchedLink && linkProblem ? (
          <p className="text-sm text-rose-700 dark:text-rose-400 mt-1.5">{linkProblem}</p>
        ) : network ? (
          <p className="text-sm text-azure-700 dark:text-azure-300 mt-1.5">Enlace de {network} válido.</p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-haze-400 mt-1.5">
            Crea el grupo en WhatsApp (o tu red), copia su enlace de invitación y pégalo aquí. Solo lo verán quienes aceptes.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={cancel} className={`${outlineBtn} h-12`}>Cancelar</button>
        <button type="submit" disabled={saving || uploading || name.trim().length < 3 || !!linkProblem} className={`${primaryBtn} flex-1`}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? (existing?.status === 'rejected' ? 'Guardar y reenviar' : 'Guardar cambios') : 'Enviar a revisión'}
        </button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Contenedor
// ---------------------------------------------------------------------------
export const GroupsView: React.FC = () => {
  const { user } = useAuthStore();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [section, setSection] = useState<'groups' | 'moderation'>('groups');
  const loadGroups = useGroupsStore((s) => s.loadGroups);
  const loadModeration = useGroupsStore((s) => s.loadModeration);
  const moderationCount = useGroupsStore((s) => s.submissions.length + s.changeRequests.length);
  const topRef = useRef<HTMLDivElement>(null);
  const isModerator = !!user && user.role !== 'student';

  useEffect(() => {
    if (isModerator) void loadModeration();
  }, [isModerator, loadModeration]);

  // Al cambiar de pantalla, volver al inicio (el contenedor con scroll vive fuera de este componente)
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [view.kind]);

  return (
    <div ref={topRef} className="max-w-md w-full mx-auto scroll-mt-4">
      {view.kind === 'list' && isModerator && (
        <div className="flex gap-2 mb-4" role="tablist">
          <button role="tab" aria-selected={section === 'groups'} onClick={() => setSection('groups')} className={chip(section === 'groups')}>Grupos</button>
          <button role="tab" aria-selected={section === 'moderation'} onClick={() => setSection('moderation')} className={`inline-flex items-center gap-1.5 ${chip(section === 'moderation')}`}>
            Moderación
            {moderationCount > 0 && <span className="px-1.5 rounded-full bg-brand-600 text-white text-[10px] leading-4">{moderationCount}</span>}
          </button>
        </div>
      )}
      {view.kind === 'list' && section === 'moderation' && isModerator && <GroupsModeration />}
      {view.kind === 'list' && !(section === 'moderation' && isModerator) && (
        <GroupList onOpen={(id) => setView({ kind: 'detail', id })} onCreate={() => setView({ kind: 'form' })} />
      )}
      {view.kind === 'detail' && (
        <GroupDetail id={view.id} onBack={() => { setView({ kind: 'list' }); void loadGroups(); }} onEdit={() => setView({ kind: 'form', editId: view.id })} />
      )}
      {view.kind === 'form' && (
        <GroupForm
          editId={view.editId}
          onCancel={() => setView(view.editId ? { kind: 'detail', id: view.editId } : { kind: 'list' })}
          onDone={(id) => setView(id ? { kind: 'detail', id } : { kind: 'list' })}
        />
      )}
    </div>
  );
};
