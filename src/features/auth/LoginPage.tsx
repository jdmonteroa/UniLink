import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuthStore, isAllowedInstitutionalEmail } from '@/features/auth/authStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useThemeStore } from '@/features/theme/themeStore';
import {
  SunIcon,
  MoonIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  BookOpenIcon,
  UserGroupIcon,
} from '@/components/icons';
import { CheckCircle2, AlertCircle, Loader2, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Wordmark, Highlight, STICKER } from '@/components/brand';
import { DownloadAppButton } from '@/components/DownloadAppButton';
import { isRunningAsApp } from '@/lib/android';

/*
  Login — "campus, pero ligero".
  Base de DESIGN.md (papel hueso / carbón, tinta / tiza, Crimson Academic) +
  una paleta de stickers para darle juventud: girasol, menta y coral.
  El carmesí sigue siendo el único color de ACCIÓN; los stickers solo decoran
  el saludo (Estudio, Amistades y Comunidad).
*/

const C = STICKER;

const ink = 'text-[#1C1C1E] dark:text-[#F9F9FB]';
const muted = 'text-gray-500 dark:text-gray-400';
const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A30021] dark:focus-visible:outline-[#F0607A]';
const spring = { type: 'spring', stiffness: 380, damping: 26 } as const;
const softSerif = "[font-variation-settings:'SOFT'_100,'WONK'_1]";

const fieldCls = cn(
  'w-full h-13 px-4 rounded-lg border-2 text-base outline-none transition-[border-color,background-color] duration-200',
  'bg-white/70 dark:bg-white/[0.04] text-[#1C1C1E] dark:text-[#F9F9FB]',
  'placeholder:text-gray-500 dark:placeholder:text-gray-400 caret-[#A30021] dark:caret-[#F0607A]'
);
const fieldIdle =
  'border-[#1C1C1E]/10 dark:border-white/10 hover:border-[#1C1C1E]/25 dark:hover:border-white/20 focus:border-[#1C1C1E] dark:focus:border-[#F9F9FB] focus:bg-white dark:focus:bg-white/[0.07]';
const labelCls = 'block mb-2 text-sm font-semibold';

/* Stickers que decoran el saludo */
const stickers = [
  { label: 'Estudio', Icon: BookOpenIcon, bg: C.mint, rotate: -6 },
  { label: 'Amistades', Icon: UserGroupIcon, bg: C.sun, rotate: 4 },
  { label: 'Comunidad', Icon: UsersRound, bg: C.coral, rotate: -3 },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithSupabase, registerWithSupabase, resendConfirmation, isLoading, error, clearError } =
    useAuthStore();
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const reduceMotion = useReducedMotion();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Verificación en tiempo real del dominio
  const isDomainValid = isAllowedInstitutionalEmail(email);
  const needsConfirmation = Boolean(error && error.toLowerCase().includes('confirmas tu correo'));
  const hasTypedAt = email.includes('@');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessNotice(null);

    if (isRegister) {
      const res = await registerWithSupabase(email, password, name);
      if (res.success) {
        if (res.message) {
          setSuccessNotice(res.message);
        } else {
          navigate('/');
        }
      }
    } else {
      const res = await loginWithSupabase(email, password);
      if (res.success) {
        navigate('/');
      }
    }
  };

  const handleResend = async () => {
    const res = await resendConfirmation(email);
    clearError();
    setSuccessNotice(res.message || null);
  };

  const switchTo = (register: boolean) => {
    setIsRegister(register);
    clearError();
    setSuccessNotice(null);
  };

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col overflow-x-hidden bg-[#F5F4F0] dark:bg-[#121212] transition-colors duration-500',
        'selection:bg-[#FFC93C] selection:text-[#1C1C1E]',
        ink
      )}
    >
      {/* Barra superior */}
      <header className="w-full max-w-6xl mx-auto px-5 sm:px-8 pt-5 sm:pt-7 flex items-center justify-between">
        <Wordmark className="text-[1.75rem]" />

        {/* Sin sesión: el botón de descarga ocupa el lugar del icono de tema.
            Si ya se usa la app instalada (el botón se oculta), se conserva el icono de tema. */}
        {isRunningAsApp() ? (
          <motion.button
            type="button"
            onClick={toggleDarkMode}
            whileTap={{ scale: 0.9, rotate: -20 }}
            className={cn(
              'w-11 h-11 flex items-center justify-center rounded-full border-2 border-[#1C1C1E]/10 dark:border-white/10',
              'hover:bg-[#FFC93C] hover:border-[#FFC93C] hover:text-[#1C1C1E] transition-colors duration-200',
              focusRing
            )}
            aria-label={isDarkMode ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDarkMode ? 'sun' : 'moon'}
                initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                transition={{ duration: 0.25 }}
              >
                {isDarkMode ? <SunIcon className="w-4.5 h-4.5" /> : <MoonIcon className="w-4.5 h-4.5" />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        ) : (
          <DownloadAppButton />
        )}
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-8 pb-12 sm:pt-12 lg:pt-16 grid lg:grid-cols-12 gap-10 lg:gap-14 lg:items-center">
        {/* Saludo + stickers */}
        <section className="lg:col-span-6">
          <ul className="flex flex-wrap gap-2.5 mb-7" aria-label="Modos de conexión">
            {stickers.map(({ label, Icon, bg, rotate }, i) => (
              <motion.li
                key={label}
                initial={reduceMotion ? false : { opacity: 0, y: 14, rotate: 0, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, rotate, scale: 1 }}
                transition={{ ...spring, delay: 0.08 + i * 0.07 }}
                whileHover={reduceMotion ? undefined : { rotate: rotate * -1, y: -3, scale: 1.06 }}
                className="inline-flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-full text-sm font-semibold text-[#1C1C1E] cursor-default select-none shadow-[0_2px_0_rgba(28,28,30,0.12)]"
                style={{ backgroundColor: bg }}
              >
                <Icon className="w-4 h-4" strokeWidth={2.25} />
                {label}
              </motion.li>
            ))}
          </ul>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isRegister ? 'register' : 'login'}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1
                className={cn(
                  'font-serif font-semibold text-[3.1rem] sm:text-6xl lg:text-[5rem] leading-[1.02] tracking-[-0.025em] text-balance',
                  softSerif
                )}
              >
                {isRegister ? 'Tu gente ya está ' : 'Qué bueno verte '}
                <Highlight>{isRegister ? 'en el campus' : 'otra vez'}</Highlight>
              </h1>
              <p className={cn('mt-6 max-w-[38ch] text-base sm:text-lg leading-relaxed', muted)}>
                {isRegister
                  ? 'Conecta con estudiantes de tu universidad.'
                  : 'Ingresa con tu correo institucional y sigue donde te quedaste.'}
              </p>
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Formulario */}
        <section className="lg:col-span-5 lg:col-start-8 w-full max-w-md lg:max-w-none">
          {/* Iniciar sesión / Crear cuenta */}
          <div
            role="tablist"
            aria-label="Tipo de acceso"
            className="grid grid-cols-2 p-1 rounded-full bg-[#1C1C1E]/[0.06] dark:bg-white/[0.06]"
          >
            {[
              { label: 'Iniciar sesión', active: !isRegister, register: false },
              { label: 'Crear cuenta', active: isRegister, register: true },
            ].map((tab) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={tab.active}
                onClick={() => switchTo(tab.register)}
                className={cn(
                  'relative h-11 rounded-full text-sm font-semibold transition-colors duration-200',
                  focusRing,
                  tab.active
                    ? 'text-[#F9F9FB] dark:text-[#1C1C1E]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-[#1C1C1E] dark:hover:text-[#F9F9FB]'
                )}
              >
                {tab.active && (
                  <motion.span
                    layoutId="login-tab"
                    transition={spring}
                    className="absolute inset-0 rounded-full bg-[#1C1C1E] dark:bg-[#F9F9FB]"
                  />
                )}
                <span className="relative">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Avisos */}
          <div className="mt-5 space-y-3 empty:hidden">
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 text-sm flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
                {needsConfirmation && (
                  <button
                    type="button"
                    onClick={handleResend}
                    className={cn('ml-auto shrink-0 underline underline-offset-4 font-semibold', focusRing)}
                  >
                    Reenviar
                  </button>
                )}
              </div>
            )}

            {!isSupabaseConfigured && (
              <div className="p-3.5 rounded-lg bg-[#FFC93C]/25 dark:bg-[#FFC93C]/10 text-[#5C4300] dark:text-[#FFDF8A] text-sm">
                Supabase no está configurado en <code className="font-mono text-[0.85em]">.env</code>. Agrega tus claves para poder
                iniciar sesión o crear una cuenta.
              </div>
            )}

            {successNotice && (
              <div
                role="status"
                className="p-3.5 rounded-lg bg-[#8FE3C0]/35 dark:bg-[#8FE3C0]/10 text-emerald-900 dark:text-emerald-200 text-sm flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <AnimatePresence initial={false}>
              {isRegister && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <label htmlFor="login-name" className={labelCls}>
                    ¿Cómo te llamas?
                  </label>
                  <input
                    id="login-name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Ej. Valeria Lozano"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(fieldCls, fieldIdle, 'font-serif text-lg')}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label htmlFor="login-email" className={cn(labelCls, 'flex items-center justify-between')}>
                <span>Correo institucional</span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">@edu.uaa.mx</span>
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="tu.usuario@edu.uaa.mx"
                  value={email}
                  aria-invalid={hasTypedAt && !isDomainValid}
                  aria-describedby={email.length > 0 ? 'login-email-hint' : undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) clearError();
                  }}
                  className={cn(
                    fieldCls,
                    'pr-12',
                    hasTypedAt
                      ? isDomainValid
                        ? 'border-emerald-500 dark:border-emerald-400 bg-white dark:bg-white/[0.07]'
                        : 'border-rose-500 dark:border-rose-400'
                      : fieldIdle
                  )}
                />
                <AnimatePresence>
                  {isDomainValid && (
                    <motion.span
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                      className="absolute right-3 top-1/2 -mt-3.5 w-7 h-7 rounded-full bg-[#8FE3C0] text-[#1C1C1E] flex items-center justify-center"
                      aria-hidden
                    >
                      <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Feedback en tiempo real del dominio */}
              {email.length > 0 && (
                <p id="login-email-hint" className="mt-2 text-sm flex items-center gap-1.5">
                  {isDomainValid ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Correo institucional válido.
                    </span>
                  ) : (
                    <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Usa tu correo @edu.uaa.mx o @alumnos.uaa.mx</span>
                    </span>
                  )}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className={labelCls}>
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={8}
                placeholder={isRegister ? 'Mínimo 8 caracteres, letras y números' : 'Tu contraseña'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(fieldCls, fieldIdle)}
              />
            </div>

            {/* Acción principal */}
            <motion.button
              type="submit"
              disabled={isLoading || (email.length > 0 && !isDomainValid)}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={{ scale: 0.97, y: 0 }}
              transition={spring}
              className={cn(
                'group w-full h-14 mt-2 px-6 rounded-full bg-[#A30021] hover:bg-[#B5072B] text-white',
                'text-base font-semibold flex items-center justify-center gap-2',
                'shadow-[0_6px_16px_-6px_rgba(163,0,33,0.55)] hover:shadow-[0_10px_22px_-8px_rgba(163,0,33,0.6)] transition-[background-color,box-shadow] duration-200',
                'disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none',
                focusRing
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? 'Crear mi cuenta' : 'Entrar'}</span>
                  <ArrowRightIcon className="w-4.5 h-4.5 transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </motion.button>
          </form>

          <p className={cn('mt-6 flex items-center justify-center gap-2 text-sm text-center', muted)}>
            <ShieldCheckIcon className="w-4 h-4 shrink-0" />
            <span>Solo estudiantes con correo institucional pueden entrar</span>
          </p>
        </section>
      </main>

      <footer className={cn('w-full max-w-6xl mx-auto px-5 sm:px-8 pb-6 text-xs', muted)}>
        UniLink © 2026
      </footer>
    </div>
  );
};
