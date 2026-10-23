import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Clock, Trash2, UserCog, XCircle, Send } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { useGroupsStore, type ChangeKind, type ChangeRequest, type Group, type GroupMember } from '@/features/groups/groupsStore';
import { confirmDialog } from '@/components/ConfirmDialog';
import { card, inputCls, labelCls, outlineBtn, primaryBtn, type Notice } from '@/features/events/ui';

const REASON_MAX = 500;

export const changeKindLabel = (kind: ChangeKind, newOwnerName?: string) =>
  kind === 'delete' ? 'Eliminar el grupo' : `Que ${newOwnerName || 'otra persona'} lleve el grupo`;

/**
 * "Pedir cambios": quien administra un grupo ya aprobado no lo elimina ni lo cede por su cuenta.
 * Manda una petición con motivo a un administrador de la plataforma, que la aprueba o la rechaza.
 */
export const GroupChangePanel: React.FC<{
  group: Group;
  members: GroupMember[] | null;
  isCreator: boolean;
  /** Ceder el grupo solo se puede cuando ya está aprobado; pedir eliminarlo vale en cualquier estado. */
  approved: boolean;
  onNotice: (notice: Notice) => void;
}> = ({ group, members, isCreator, approved, onNotice }) => {
  const { user } = useAuthStore();
  const { loadChangeRequest, requestChange, cancelChange } = useGroupsStore();
  const [req, setReq] = useState<ChangeRequest | null>(null);
  const [mode, setMode] = useState<'idle' | ChangeKind>('idle');
  const [reason, setReason] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setReq(await loadChangeRequest(group.id));
    } catch {
      setReq(null);
    }
  }, [loadChangeRequest, group.id]);

  // Se vuelve a leer cuando la petición cambia de estado (p. ej. la rechazaron)
  useEffect(() => {
    void reload();
  }, [reload, group.pendingChange]);

  const candidates = (members || []).filter((m) => m.profileId !== user?.id);
  const reasonOk = reason.trim().length >= 10;
  const canSend = reasonOk && !busy && (mode !== 'transfer' || !!newOwner);

  const reset = () => {
    setMode('idle');
    setReason('');
    setNewOwner('');
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'idle' || !canSend) return;
    setBusy(true);
    const res = await requestChange(group.id, mode, reason, mode === 'transfer' ? newOwner : undefined);
    setBusy(false);
    if (!res.success) {
      onNotice({ kind: 'error', text: res.message || 'No se pudo enviar la petición.' });
      return;
    }
    reset();
    await reload();
    onNotice({ kind: 'ok', text: 'Petición enviada. Un administrador la revisará; mientras tanto el grupo sigue igual.' });
  };

  const cancel = async () => {
    const ok = await confirmDialog({ title: '¿Cancelar la petición?', confirmLabel: 'Cancelar petición', tone: 'warning' });
    if (!ok) return;
    setBusy(true);
    const res = await cancelChange(group.id);
    setBusy(false);
    if (res.success) {
      await reload();
      onNotice({ kind: 'ok', text: 'Petición cancelada.' });
    } else onNotice({ kind: 'error', text: res.message || 'No se pudo cancelar.' });
  };

  const pending = req?.status === 'pending' ? req : null;
  const rejected = req?.status === 'rejected' ? req : null;

  return (
    <section className={card} aria-label="Pedir cambios al grupo">
      <div>
        <h3 className="text-xl font-semibold">Pedir cambios</h3>
        <p className="text-sm text-slate-500 dark:text-haze-400 mt-1">
          Los grupos no se eliminan por cuenta propia: manda una petición con el motivo y un administrador de UniLink la revisa. Mientras tanto el grupo sigue igual.
        </p>
      </div>

      {pending ? (
        <div className="space-y-3 p-4 rounded-2xl bg-sun/25 dark:bg-sun/10">
          <p className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Petición en revisión</p>
          <p className="text-sm"><strong>{changeKindLabel(pending.kind, pending.newOwnerName)}</strong></p>
          <p className="text-sm text-slate-700 dark:text-slate-300">“{pending.reason}”</p>
          <button onClick={() => void cancel()} disabled={busy} className={`${outlineBtn} w-full`}>Cancelar petición</button>
        </div>
      ) : (
        <>
          {rejected && mode === 'idle' && (
            <p className="flex gap-2 p-3 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-sm text-rose-900 dark:text-rose-200">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span><strong>Tu última petición ({changeKindLabel(rejected.kind, rejected.newOwnerName).toLowerCase()}) fue rechazada.</strong> {rejected.resolutionNote}</span>
            </p>
          )}

          {mode === 'idle' ? (
            <div className="space-y-2.5">
              <button onClick={() => setMode('delete')} className={`${outlineBtn} w-full text-rose-700 dark:text-rose-400`}>
                <Trash2 className="w-4 h-4" /> Pedir que se elimine el grupo
              </button>
              {isCreator && approved && (
                <button
                  onClick={() => setMode('transfer')}
                  disabled={candidates.length === 0}
                  className={`${outlineBtn} w-full`}
                >
                  <UserCog className="w-4 h-4" /> Pedir que lo lleve otra persona
                </button>
              )}
              {isCreator && approved && candidates.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-haze-400">Para ceder el grupo, la otra persona primero debe ser miembro.</p>
              )}
            </div>
          ) : (
            <form onSubmit={send} className="space-y-4">
              <p className="font-semibold">{mode === 'delete' ? 'Pedir que se elimine el grupo' : 'Pedir que lo lleve otra persona'}</p>

              {mode === 'transfer' && (
                <div>
                  <label htmlFor="gc-owner" className={labelCls}>¿Quién lo llevará?</label>
                  <select id="gc-owner" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} className={inputCls}>
                    <option value="">Elige a un miembro del grupo</option>
                    {candidates.map((m) => (
                      <option key={m.profileId} value={m.profileId}>{m.name}{m.career ? ` · ${m.career}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="gc-reason" className={`${labelCls} flex justify-between`}>
                  <span>Motivo</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{reason.length}/{REASON_MAX}</span>
                </label>
                <textarea
                  id="gc-reason"
                  rows={4}
                  maxLength={REASON_MAX}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={mode === 'delete' ? 'Cuéntale al administrador por qué quieres eliminarlo' : 'Cuéntale al administrador por qué se lo pasarías a esa persona'}
                  className={inputCls}
                />
                {reason.length > 0 && !reasonOk && <p className="mt-1.5 text-xs text-rose-700 dark:text-rose-400">Escribe al menos 10 caracteres.</p>}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={reset} disabled={busy} className={`${outlineBtn} h-12`}>Cancelar</button>
                <button type="submit" disabled={!canSend} className={`${primaryBtn} flex-1`}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar petición
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
};
