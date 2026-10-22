import React, { useEffect, useMemo, useState } from 'react';
import { Check, X, Loader2, ShieldAlert, ShieldCheck, Link2, Trash2, Search, UserCog, RotateCcw } from 'lucide-react';
import { useGroupsStore, categoryLabel, type GroupChangeItem, type GroupSubmission } from '@/features/groups/groupsStore';
import { Avatar } from '@/components/Avatar';
import { confirmDialog } from '@/components/ConfirmDialog';
import { card, chip, inputCls, labelCls, NoticeBanner, outlineBtn, Spinner, useNotice } from '@/features/events/ui';

type Tab = 'submissions' | 'requests' | 'all';

const HIT_CATEGORY: Record<string, string> = {
  insult: 'Insulto', profanity: 'Grosería', sexual: 'Contenido sexual', violence: 'Violencia o amenaza', spam: 'Spam o estafa', link: 'Contiene enlace',
};
const SEVERITY: Record<string, { label: string; cls: string }> = {
  high: { label: 'grave', cls: 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-200' },
  medium: { label: 'moderado', cls: 'bg-sun/60 text-slate-900 dark:bg-sun/25 dark:text-slate-100' },
  low: { label: 'leve', cls: 'bg-haze-200 text-slate-700 dark:bg-ink-700 dark:text-haze-300' },
};
const QUICK_REJECT = [
  'El nombre no es claro o no corresponde a la comunidad.',
  'La imagen no es apropiada.',
  'La descripción tiene lenguaje ofensivo o spam.',
  'Ya existe un grupo igual.',
  'No se pudo comprobar que sea un grupo legítimo.',
];

/** Cuadro para escribir un motivo (rechazos y eliminaciones). */
const ReasonBox: React.FC<{
  id: string;
  label: string;
  quick?: string[];
  min: number;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}> = ({ id, label, quick, min, confirmLabel, busy, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  const ok = reason.trim().length >= min;
  return (
    <div className="space-y-3 pt-4 border-t border-slate-900/10 dark:border-white/10">
      <label htmlFor={id} className={`${labelCls} flex justify-between`}>
        <span>{label}</span>
        <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{reason.length}/300</span>
      </label>
      {quick && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button type="button" key={q} onClick={() => setReason((r) => (r ? `${r} ${q}` : q).slice(0, 300))} className="px-2.5 py-1 rounded-full text-xs bg-haze-100 dark:bg-ink-800 hover:bg-haze-200 dark:hover:bg-ink-700 transition-colors text-left">
              + {q.replace(/\.$/, '')}
            </button>
          ))}
        </div>
      )}
      <textarea id={id} rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className={`${outlineBtn} h-12`}>Cancelar</button>
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          disabled={!ok || busy}
          className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {confirmLabel}
        </button>
      </div>
    </div>
  );
};

const Person: React.FC<{ name: string; career: string; avatarUrl: string; right?: React.ReactNode }> = ({ name, career, avatarUrl, right }) => (
  <div className="flex items-center gap-3 p-3 rounded-2xl bg-haze-100 dark:bg-ink-800">
    <Avatar src={avatarUrl} name={name} className="w-10 h-10 text-sm" />
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-sm truncate">{name}</p>
      {career && <p className="text-xs text-slate-500 dark:text-haze-400 truncate">{career}</p>}
    </div>
    {right}
  </div>
);

// ---------------------------------------------------------------------------
// Grupos por aprobar
// ---------------------------------------------------------------------------
const SubmissionCard: React.FC<{ item: GroupSubmission; onDone: (text: string) => void; onError: (text: string) => void }> = ({ item, onDone, onError }) => {
  const reviewGroup = useGroupsStore((s) => s.reviewGroup);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const verdict = item.textScan?.verdict ?? 'clean';
  const v = {
    clean: { label: 'Sin coincidencias', cls: 'bg-mint/60 text-slate-900 dark:bg-mint/20 dark:text-slate-100', Icon: ShieldCheck },
    review: { label: 'Revisar', cls: 'bg-sun/60 text-slate-900 dark:bg-sun/25 dark:text-slate-100', Icon: ShieldAlert },
    flagged: { label: 'Marcado', cls: 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-200', Icon: ShieldAlert },
  }[verdict];

  const decide = async (decision: 'approve' | 'reject', note?: string) => {
    setBusy(true);
    const res = await reviewGroup(item.id, decision, note);
    setBusy(false);
    if (res.success) onDone(decision === 'approve' ? 'Grupo aprobado: ya es visible para toda la universidad.' : 'Grupo rechazado.');
    else onError(res.message || 'No se pudo guardar la decisión.');
  };

  return (
    <article className={`${card} space-y-4`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={`Imagen del grupo ${item.name}`} className="w-full max-h-72 object-contain rounded-2xl bg-haze-100 dark:bg-ink-800" />
      ) : (
        <p className="text-sm text-slate-500 dark:text-haze-400 p-4 rounded-2xl bg-haze-100 dark:bg-ink-800 text-center">Este grupo no tiene imagen.</p>
      )}
      <div className="space-y-1.5">
        {item.resubmitted && (
          <p className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-haze-200 dark:bg-ink-700 text-xs font-semibold"><RotateCcw className="w-3.5 h-3.5" /> Reenviado tras una revisión</p>
        )}
        <h3 className="text-2xl font-semibold leading-tight break-words">{item.name}</h3>
        <p className="text-sm text-slate-500 dark:text-haze-400">{categoryLabel(item.category)}</p>
        {item.description ? (
          <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words pt-1">{item.description}</p>
        ) : (
          <p className="text-sm italic text-slate-500 dark:text-haze-400">Sin descripción.</p>
        )}
      </div>

      {item.resubmitted && item.previousNote && (
        <p className="text-sm p-3 rounded-xl bg-haze-100 dark:bg-ink-800"><strong>Motivo del rechazo anterior:</strong> {item.previousNote}</p>
      )}

      <Person
        name={item.creator.name}
        career={[item.creator.career, item.creator.semester ? `${item.creator.semester}.º semestre` : ''].filter(Boolean).join(' · ')}
        avatarUrl={item.creator.avatarUrl}
        right={<span className="text-xs text-slate-600 dark:text-haze-300 shrink-0">{item.priorRejections} {item.priorRejections === 1 ? 'rechazo' : 'rechazos'}</span>}
      />

      <section className="space-y-2.5" aria-label="Resultado de los filtros">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-haze-400">Filtros automáticos</h4>
        <p className="flex items-center gap-2 text-sm font-semibold">
          Texto (nombre y descripción)
          <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${v.cls}`}><v.Icon className="w-3.5 h-3.5" /> {v.label}</span>
        </p>
        {item.textScan && item.textScan.hits.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {item.textScan.hits.map((h) => (
              <li key={`${h.term}-${h.category}`} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-white dark:bg-ink-850 border border-slate-900/10 dark:border-white/10 text-sm">
                <span className="font-semibold">“{h.term}”</span>
                <span className="text-slate-500 dark:text-haze-400">{HIT_CATEGORY[h.category] ?? h.category}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY[h.severity]?.cls ?? ''}`}>{SEVERITY[h.severity]?.label ?? h.severity}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-haze-400">No se encontraron términos de la lista.</p>
        )}
        <p className="flex items-start gap-2 text-sm">
          <Link2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Enlace de <strong>{item.linkNetwork}</strong> <span className="text-slate-500 dark:text-haze-400">(el enlace solo lo ven los miembros)</span></span>
        </p>
        <p className="text-xs text-slate-500 dark:text-haze-400">Los filtros solo orientan. Revisa la imagen y decide tú.</p>
      </section>

      {!rejecting ? (
        <div className="flex gap-3">
          <button onClick={() => setRejecting(true)} disabled={busy} className={`${outlineBtn} flex-1 h-12`}><X className="w-4 h-4" /> Rechazar</button>
          <button
            onClick={() => void decide('approve')}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-mint text-slate-900 text-sm font-semibold shadow-sticker transition hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprobar
          </button>
        </div>
      ) : (
        <ReasonBox
          id={`rej-${item.id}`}
          label="Motivo (lo verá quien envió el grupo)"
          quick={QUICK_REJECT}
          min={3}
          confirmLabel="Rechazar grupo"
          busy={busy}
          onConfirm={(r) => void decide('reject', r)}
          onCancel={() => setRejecting(false)}
        />
      )}
    </article>
  );
};

// ---------------------------------------------------------------------------
// Peticiones (eliminar / cambiar de encargado)
// ---------------------------------------------------------------------------
const ChangeCard: React.FC<{ item: GroupChangeItem; onDone: (text: string) => void; onError: (text: string) => void }> = ({ item, onDone, onError }) => {
  const resolveChange = useGroupsStore((s) => s.resolveChange);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const isDelete = item.kind === 'delete';

  const resolve = async (approve: boolean, note?: string) => {
    if (approve) {
      const ok = await confirmDialog({
        title: isDelete ? `¿Eliminar "${item.group.name}"?` : `¿Pasar "${item.group.name}" a ${item.newOwner?.name ?? 'otra persona'}?`,
        message: isDelete ? `Se borrará el grupo para sus ${item.group.memberCount} miembros. No se puede deshacer.` : 'La persona elegida quedará como creadora y administradora del grupo.',
        confirmLabel: isDelete ? 'Eliminar grupo' : 'Aprobar cambio',
        tone: isDelete ? 'danger' : 'warning',
      });
      if (!ok) return;
    }
    setBusy(true);
    const res = await resolveChange(item.requestId, approve, note);
    setBusy(false);
    if (res.success) onDone(!approve ? 'Petición rechazada.' : isDelete ? 'Grupo eliminado.' : 'Grupo cedido.');
    else onError(res.message || 'No se pudo resolver la petición.');
  };

  return (
    <article className={`${card} space-y-4`}>
      <div className="flex items-start gap-3">
        <span className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-slate-900 ${isDelete ? 'bg-coral' : 'bg-sun'}`}>
          {isDelete ? <Trash2 className="w-5 h-5" /> : <UserCog className="w-5 h-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-haze-400">{isDelete ? 'Pide eliminar el grupo' : 'Pide cambiar de encargado'}</p>
          <h3 className="text-xl font-semibold leading-tight break-words">{item.group.name}</h3>
          <p className="text-sm text-slate-500 dark:text-haze-400">{item.group.memberCount} {item.group.memberCount === 1 ? 'miembro' : 'miembros'}</p>
        </div>
      </div>

      <Person name={item.requester.name} career={item.requester.career} avatarUrl={item.requester.avatarUrl} right={<span className="text-xs text-slate-500 dark:text-haze-400">quien pide</span>} />
      <blockquote className="pl-4 border-l-4 border-sun text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">“{item.reason}”</blockquote>
      {item.newOwner && <Person name={item.newOwner.name} career={item.newOwner.career} avatarUrl={item.newOwner.avatarUrl} right={<span className="text-xs text-slate-500 dark:text-haze-400">lo llevaría</span>} />}

      {!rejecting ? (
        <div className="flex gap-3">
          <button onClick={() => setRejecting(true)} disabled={busy} className={`${outlineBtn} flex-1 h-12`}><X className="w-4 h-4" /> Rechazar</button>
          <button
            onClick={() => void resolve(true)}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-mint text-slate-900 text-sm font-semibold shadow-sticker transition hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprobar
          </button>
        </div>
      ) : (
        <ReasonBox
          id={`chg-${item.requestId}`}
          label="Motivo (lo verán los administradores del grupo)"
          min={3}
          confirmLabel="Rechazar petición"
          busy={busy}
          onConfirm={(r) => void resolve(false, r)}
          onCancel={() => setRejecting(false)}
        />
      )}
    </article>
  );
};

// ---------------------------------------------------------------------------
// Pantalla completa
// ---------------------------------------------------------------------------
export const GroupsModeration: React.FC = () => {
  const { submissions, changeRequests, groups, loadModeration, loadGroups, deleteGroup } = useGroupsStore();
  const [tab, setTab] = useState<Tab>('submissions');
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useNotice();
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([loadModeration(), loadGroups()]).finally(() => setLoaded(true));
  }, [loadModeration, loadGroups]);

  const approved = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => g.status === 'approved' && (!q || g.name.toLowerCase().includes(q)));
  }, [groups, query]);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'submissions', label: 'Por aprobar', count: submissions.length },
    { id: 'requests', label: 'Peticiones', count: changeRequests.length },
    { id: 'all', label: 'Todos los grupos' },
  ];

  const remove = async (id: string, reason: string, name: string) => {
    const ok = await confirmDialog({
      title: `¿Eliminar "${name}"?`,
      message: 'Se borrará para todos sus miembros y el motivo quedará registrado. No se puede deshacer.',
      confirmLabel: 'Eliminar grupo',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const res = await deleteGroup(id, reason);
    setBusy(false);
    if (res.success) {
      setDeletingId(null);
      setNotice({ kind: 'ok', text: 'Grupo eliminado.' });
    } else setNotice({ kind: 'error', text: res.message || 'No se pudo eliminar el grupo.' });
  };

  if (!loaded) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 inline-flex items-center gap-1.5 ${chip(tab === t.id)}`}>
            {t.label}
            {!!t.count && <span className="px-1.5 rounded-full bg-brand-600 text-white text-[10px] leading-4">{t.count}</span>}
          </button>
        ))}
      </div>
      <NoticeBanner notice={notice} />

      {tab === 'submissions' &&
        (submissions.length === 0 ? (
          <Empty title="Todo al día" text="No hay grupos esperando aprobación." />
        ) : (
          <>
            <p className="text-sm text-slate-500 dark:text-haze-400">Revisa el nombre, la imagen y la descripción. Primero salen los marcados por el filtro.</p>
            {submissions.map((s) => (
              <SubmissionCard key={s.id} item={s} onDone={(text) => setNotice({ kind: 'ok', text })} onError={(text) => setNotice({ kind: 'error', text })} />
            ))}
          </>
        ))}

      {tab === 'requests' &&
        (changeRequests.length === 0 ? (
          <Empty title="Sin peticiones" text="Nadie ha pedido eliminar un grupo ni cambiar de encargado." />
        ) : (
          changeRequests.map((c) => (
            <ChangeCard key={c.requestId} item={c} onDone={(text) => setNotice({ kind: 'ok', text })} onError={(text) => setNotice({ kind: 'error', text })} />
          ))
        ))}

      {tab === 'all' && (
        <>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar un grupo" aria-label="Buscar un grupo" className={`${inputCls} pl-11`} />
          </div>
          {approved.length === 0 ? (
            <Empty title="Sin grupos" text="No hay grupos aprobados con ese nombre." />
          ) : (
            <ul className="space-y-3">
              {approved.map((g) => (
                <li key={g.id} className={`${card} space-y-3`}>
                  <div className="flex items-center gap-3">
                    {g.imageUrl ? <img src={g.imageUrl} alt="" className="w-12 h-12 rounded-2xl object-cover shrink-0" /> : <span className="w-12 h-12 rounded-2xl bg-haze-200 dark:bg-ink-700 shrink-0 flex items-center justify-center font-serif font-semibold">{g.name[0]?.toUpperCase()}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{g.name}</p>
                      <p className="text-xs text-slate-500 dark:text-haze-400 truncate">{categoryLabel(g.category)} · {g.memberCount} {g.memberCount === 1 ? 'miembro' : 'miembros'} · {g.creatorName.split(' ')[0]}</p>
                    </div>
                    {deletingId !== g.id && (
                      <button onClick={() => setDeletingId(g.id)} aria-label={`Eliminar ${g.name}`} className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-slate-500 dark:text-haze-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-700 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {deletingId === g.id && (
                    <ReasonBox id={`del-${g.id}`} label="Motivo de la eliminación" min={5} confirmLabel="Eliminar grupo" busy={busy} onConfirm={(r) => void remove(g.id, r, g.name)} onCancel={() => setDeletingId(null)} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

const Empty: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10">
    <span className="w-14 h-14 rounded-full bg-mint text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker"><ShieldCheck className="w-6 h-6" /></span>
    <h3 className="text-2xl font-semibold">{title}</h3>
    <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[30ch]">{text}</p>
  </div>
);
