import React, { useState } from 'react';
import { Loader2, ShieldCheck, KeyRound, LogOut, Mail } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { supabase, friendlyError } from '@/lib/supabaseClient';
import { Avatar } from '@/components/Avatar';
import { card, inputCls, labelCls, outlineBtn, primaryBtn } from '@/features/events/ui';

const MIN_PASSWORD = 10;

/** Perfil de administración: solo datos de la cuenta y cambio de contraseña. */
export const AdminProfile: React.FC = () => {
  const { user, isDemo, logout } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user) return null;

  const problem =
    password.length < MIN_PASSWORD
      ? `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
      : password !== confirm
        ? 'Las contraseñas no coinciden.'
        : null;

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) {
      setMsg({ ok: false, text: problem });
      return;
    }
    setSaving(true);
    if (isDemo) {
      setSaving(false);
      setMsg({ ok: true, text: 'Modo demo: no se guardó nada.' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setMsg({ ok: false, text: friendlyError(error, 'No se pudo cambiar la contraseña.') });
      return;
    }
    setPassword('');
    setConfirm('');
    setMsg({ ok: true, text: 'Contraseña actualizada.' });
  };

  return (
    <div className="max-w-md w-full mx-auto space-y-4 pb-6">
      <section className={`${card} flex items-center gap-4`}>
        <Avatar name={user.name} className="w-16 h-16 text-xl" />
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold leading-tight truncate">{user.name}</h2>
          <p className="text-sm text-slate-500 dark:text-haze-400 flex items-center gap-1.5 truncate"><Mail className="w-3.5 h-3.5 shrink-0" />{user.email}</p>
          <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full bg-mint text-slate-900 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Administrador
          </span>
        </div>
      </section>

      <form onSubmit={changePassword} className={card}>
        <h3 className="text-xl font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5" /> Cambiar contraseña</h3>
        <p className="text-sm text-slate-500 dark:text-haze-400 -mt-2">Si tu cuenta se creó con la contraseña inicial, cámbiala ahora.</p>
        <div>
          <label htmlFor="adm-pw" className={labelCls}>Nueva contraseña</label>
          <input id="adm-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="adm-pw2" className={labelCls}>Repite la contraseña</label>
          <input id="adm-pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </div>
        {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? 'text-azure-700 dark:text-azure-300' : 'text-rose-700 dark:text-rose-400'}`}>{msg.text}</p>}
        <button type="submit" disabled={saving || !password} className={`${primaryBtn} w-full`}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar contraseña
        </button>
      </form>

      <button onClick={() => void logout()} className={`${outlineBtn} w-full`}><LogOut className="w-4 h-4" /> Cerrar sesión</button>
    </div>
  );
};
