import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Loader2, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { LoginPage } from '@/features/auth/LoginPage';
import { DiscoverPage } from '@/features/discover/DiscoverPage';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { AdminShell } from '@/features/admin/AdminShell';
import { useAuthStore } from '@/features/auth/authStore';
import { Wordmark } from '@/components/brand';

const FullScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-haze-50 dark:bg-ink-950 text-slate-900 dark:text-slate-50 transition-colors duration-500">
    {children}
  </div>
);

const ProfileErrorScreen: React.FC = () => {
  const { profileError, reloadProfile, logout } = useAuthStore();
  const [retrying, setRetrying] = React.useState(false);
  return (
    <FullScreen>
      <div className="max-w-sm w-full text-center space-y-5">
        <Wordmark className="text-3xl" />
        <div className="w-14 h-14 mx-auto rounded-full bg-sun text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-semibold leading-tight">No pudimos cargar tu perfil</h1>
        <p className="text-sm text-slate-500 dark:text-haze-400">{profileError}</p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={async () => {
              setRetrying(true);
              await reloadProfile();
              setRetrying(false);
            }}
            className="w-full h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center justify-center gap-2 shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]"
          >
            {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Reintentar
          </button>
          <button
            onClick={() => void logout()}
            className="w-full h-12 rounded-full text-sm font-semibold text-slate-600 dark:text-haze-300 hover:bg-haze-100 dark:hover:bg-ink-800 flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </div>
    </FullScreen>
  );
};

const BlockedScreen: React.FC = () => {
  const { logout } = useAuthStore();
  return (
    <FullScreen>
      <div className="max-w-sm w-full text-center space-y-5">
        <Wordmark className="text-3xl" />
        <div className="w-14 h-14 mx-auto rounded-full bg-coral text-slate-900 flex items-center justify-center rotate-6 shadow-sticker">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-semibold leading-tight">Tu cuenta está bloqueada</h1>
        <p className="text-sm text-slate-500 dark:text-haze-400">
          Se bloqueó automáticamente por acumular 5 sanciones. Si crees que es un error, contacta a los administradores de UniLink.
        </p>
        <button
          onClick={() => void logout()}
          className="w-full h-12 rounded-full text-sm font-semibold border-2 border-slate-900/15 dark:border-white/15 hover:border-slate-900 dark:hover:border-white flex items-center justify-center gap-2 transition"
        >
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </div>
    </FullScreen>
  );
};

/**
 * Guardia principal:
 *  - mientras se restaura la sesión → pantalla de carga
 *  - error al leer el perfil → pantalla de reintento (NUNCA se manda al onboarding por error)
 *  - sin sesión → login
 *  - cuenta bloqueada → pantalla de bloqueo
 *  - administrador → app de administración (solo Eventos y Perfil)
 *  - onboarding pendiente → onboarding (una sola vez)
 *  - todo listo → app
 */
const AppGate: React.FC = () => {
  const { status, isAuthenticated, user, profileError } = useAuthStore();

  if (status === 'initializing') {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-5" role="status">
          <Wordmark className="text-5xl animate-pulse" />
          <div className="flex gap-1.5" aria-hidden>
            <span className="w-2 h-2 rounded-full bg-mint animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 rounded-full bg-sun animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 rounded-full bg-coral animate-bounce" />
          </div>
          <span className="sr-only">Cargando UniLink…</span>
        </div>
      </FullScreen>
    );
  }
  if (isAuthenticated && profileError) return <ProfileErrorScreen />;
  if (!isAuthenticated || !user) return <LoginPage />;
  if (user.isBlocked) return <BlockedScreen />;
  if (user.role === 'admin') return <AdminShell />;
  if (!user.onboardingCompleted) return <OnboardingFlow />;
  return <DiscoverPage />;
};

export const router = createBrowserRouter([
  { path: '/', element: <AppGate /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
