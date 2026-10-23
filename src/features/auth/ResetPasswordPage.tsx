import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check, Circle, Loader2, AlertCircle, MailQuestion, CheckCircle2, ArrowRight } from 'lucide-react';
import { Wordmark, Highlight } from '@/components/brand';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { passwordChecks, passwordProblem } from '@/lib/password';
import { parseAuthLinkError, updatePassword, waitForRecoverySession } from '@/features/auth/passwordReset';

type Phase = 'checking' | 'ready' | 'expired' | 'invalid' | 'done' | 'unconfigured';

const inputCls =
  'w-full h-13 px-4 pr-12 rounded-lg bg-white/70 dark:bg-white/[0.04] border-2 border-slate-900/10 dark:border-white/10 text-base outline-none transition-colors hover:border-slate-900/25 dark:hover:border-white/20 focus:border-slate-900 dark:focus:border-slate-50 placeholder:text-slate-500 dark:placeholder:text-haze-400';
const primaryBtn =
  'w-full h-14 px-6 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-base font-semibold flex items-center justify-center gap-2 shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none';

const Rule: React.FC<{ ok: boolean; children: React.ReactNode }> = ({ ok, children }) => (
  <li className={`flex items-center gap-2 text-sm ${ok ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-haze-400'}`}>
    {ok ? <Check className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
    {children}
  </li>
);

/**
 * Página pública /restablecer. Aquí llega la persona desde el enlace del correo de "Olvidé mi contraseña":
 * Supabase abre una sesión de recuperación al leer el enlace y esta pantalla pide la contraseña nueva.
 */
export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setPhase('unconfigured');
      return;
    }
    const linkProblem = parseAuthLinkError(window.location.hash);
    if (linkProblem) {
      setPhase(linkProblem);
      return;
    }
    let cancelled = false;
    void waitForRecoverySession().then((ok) => !cancelled && setPhase(ok ? 'ready' : 'invalid'));
    return () => {
      cancelled = true;
    };
  }, []);

  const checks = passwordChecks(password);
  const matches = confirm.length > 0 && password === confirm;
  const canSubmit = !passwordProblem(password) && matches && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSaving(true);
    const res = await updatePassword(password);
    setSaving(false);
    if (res.success) {
      setPassword('');
      setConfirm('');
      setPhase('done');
    } else {
      setError(res.message || 'No se pudo cambiar la contraseña.');
    }
  };

  const message = (icon: React.ReactNode, title: string, text: string, action?: React.ReactNode) => (
    <div className="text-center space-y-4">
      {icon}
      <h1 className="text-3xl font-semibold leading-tight">{title}</h1>
      <p className="text-sm text-slate-600 dark:text-haze-300">{text}</p>
      {action}
    </div>
  );

  return (
    <div className="min-h-dvh bg-haze-50 dark:bg-ink-950 text-slate-900 dark:text-slate-50 transition-colors duration-500">
      <main className="max-w-md mx-auto px-5 py-10 space-y-8">
        <div className="flex justify-center"><Wordmark className="text-3xl" /></div>

        <section className="rounded-3xl bg-white dark:bg-ink-850 p-6 shadow-soft-sm">
          {phase === 'checking' && (
            <div className="flex flex-col items-center gap-4 py-6" role="status">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm text-slate-600 dark:text-haze-300">Verificando tu enlace…</p>
            </div>
          )}

          {phase === 'unconfigured' &&
            message(
              <span className="mx-auto w-14 h-14 rounded-full bg-sun text-slate-900 flex items-center justify-center rotate-6 shadow-sticker"><AlertCircle className="w-6 h-6" /></span>,
              'No disponible',
              'Supabase no está configurado en este entorno, así que no se puede cambiar la contraseña.'
            )}

          {(phase === 'expired' || phase === 'invalid') &&
            message(
              <span className="mx-auto w-14 h-14 rounded-full bg-coral text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker"><MailQuestion className="w-6 h-6" /></span>,
              phase === 'expired' ? 'Tu enlace venció' : 'Este enlace ya no sirve',
              phase === 'expired'
                ? 'Los enlaces de recuperación duran poco por seguridad. Pide uno nuevo y ábrelo desde tu correo.'
                : 'Puede que ya lo hayas usado, o que el enlace esté incompleto. Pide uno nuevo desde la pantalla de inicio de sesión.',
              <div className="space-y-2.5 pt-1">
                <button type="button" onClick={() => navigate('/?recuperar=1', { replace: true })} className={primaryBtn}>
                  Pedir un enlace nuevo <ArrowRight className="w-4.5 h-4.5" />
                </button>
                <button type="button" onClick={() => navigate('/', { replace: true })} className="w-full h-11 rounded-full text-sm font-semibold text-slate-600 dark:text-haze-300 hover:bg-haze-100 dark:hover:bg-ink-800 transition">
                  Volver al inicio
                </button>
              </div>
            )}

          {phase === 'done' &&
            message(
              <span className="mx-auto w-14 h-14 rounded-full bg-mint text-slate-900 flex items-center justify-center rotate-6 shadow-sticker"><CheckCircle2 className="w-6 h-6" /></span>,
              'Contraseña actualizada',
              'Ya puedes usar tu contraseña nueva. Por seguridad cerramos tu sesión en otros dispositivos.',
              <button type="button" onClick={() => navigate('/', { replace: true })} className={primaryBtn}>
                Entrar a UniLink <ArrowRight className="w-4.5 h-4.5" />
              </button>
            )}

          {phase === 'ready' && (
            <form onSubmit={submit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold leading-tight">Crea tu <Highlight>contraseña nueva</Highlight></h1>
                <p className="text-sm text-slate-600 dark:text-haze-300">Elige una que no uses en otros sitios.</p>
              </div>

              <div>
                <label htmlFor="new-password" className="block mb-2 text-sm font-semibold">Contraseña nueva</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                    aria-pressed={show}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-slate-500 dark:text-haze-400 hover:bg-haze-100 dark:hover:bg-ink-800 transition"
                  >
                    {show ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
                <ul className="mt-3 space-y-1.5" aria-label="Requisitos de la contraseña">
                  <Rule ok={checks.length}>Al menos 8 caracteres</Rule>
                  <Rule ok={checks.letters}>Con letras</Rule>
                  <Rule ok={checks.numbers}>Con números</Rule>
                </ul>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block mb-2 text-sm font-semibold">Repite la contraseña</label>
                <input
                  id="confirm-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); if (error) setError(null); }}
                  aria-invalid={confirm.length > 0 && !matches}
                  className={inputCls}
                />
                {confirm.length > 0 && !matches && <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">Las contraseñas no coinciden.</p>}
              </div>

              {error && (
                <p role="alert" className="p-3.5 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
                </p>
              )}

              <button type="submit" disabled={!canSubmit} className={primaryBtn}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};
