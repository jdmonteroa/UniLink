import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, User, Users, Flag, Lightbulb, LogOut } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { useThemeStore } from '@/features/theme/themeStore';
import { useEventsStore } from '@/features/events/eventsStore';
import { EventsView } from '@/features/events/EventsView';
import { GroupsModeration } from '@/features/groups/GroupsModeration';
import { useGroupsStore } from '@/features/groups/groupsStore';
import { Highlight } from '@/components/brand';
import { AdminProfile } from '@/features/admin/AdminProfile';
import { ReportsModeration } from '@/features/admin/ReportsModeration';
import { SuggestionsModeration } from '@/features/admin/SuggestionsModeration';
import { SunIcon, MoonIcon } from '@/components/icons';
import { Wordmark, spring } from '@/components/brand';

type Tab = 'events' | 'groups' | 'reports' | 'suggestions' | 'profile';

/**
 * App de administración: solo Eventos (moderación) y Perfil. Los administradores no usan
 * Descubrir, Matches ni Grupos, y no aparecen para los estudiantes.
 */
export const AdminShell: React.FC = () => {
  const { logout, isDemo } = useAuthStore();
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const [tab, setTab] = useState<Tab>('events');
  const [reportCount, setReportCount] = useState(0);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const pending = useEventsStore((s) => s.queue.length);
  const loadQueue = useEventsStore((s) => s.loadQueue);
  const groupPending = useGroupsStore((s) => s.submissions.length + s.changeRequests.length);
  const loadGroupModeration = useGroupsStore((s) => s.loadModeration);

  useEffect(() => {
    void loadQueue();
    void loadGroupModeration();
  }, [loadQueue, loadGroupModeration]);

  return (
    <div className="h-dvh bg-haze-50 dark:bg-ink-950 text-slate-900 dark:text-slate-50 flex flex-col transition-colors duration-500 overflow-hidden">
      <header className="shrink-0 z-40 pt-[env(safe-area-inset-top)] bg-haze-50/85 dark:bg-ink-950/85 backdrop-blur-md border-b border-slate-900/[0.06] dark:border-white/[0.06]">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Wordmark className="text-2xl" />
            <span className="px-2 py-0.5 rounded-full bg-mint text-slate-900 text-[10px] font-bold whitespace-nowrap">
              {isDemo ? 'admin · demo' : 'administración'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleDarkMode}
              className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-slate-900/10 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-sun hover:border-sun hover:text-slate-900 transition-colors"
              aria-label={isDarkMode ? 'Usar tema claro' : 'Usar tema oscuro'}
            >
              {isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => void logout()}
              className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 dark:text-haze-400 hover:bg-haze-100 dark:hover:bg-ink-800 hover:text-slate-900 dark:hover:text-slate-50 transition"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        <main className="max-w-md w-full mx-auto px-4 py-4">
          {tab === 'events' && <EventsView defaultTab="queue" />}
          {tab === 'groups' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-4xl font-semibold leading-none"><Highlight>Grupos</Highlight></h2>
                <p className="text-sm text-slate-500 dark:text-haze-400 mt-3">Aprueba los grupos nuevos y resuelve las peticiones.</p>
              </div>
              <GroupsModeration />
            </div>
          )}
          {tab === 'reports' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-4xl font-semibold leading-none"><Highlight>Reportes</Highlight></h2>
                <p className="text-sm text-slate-500 dark:text-haze-400 mt-3">Reportes entre estudiantes, con una copia de los mensajes de las últimas 24 horas.</p>
              </div>
              <ReportsModeration onCount={setReportCount} />
            </div>
          )}
          {tab === 'suggestions' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-4xl font-semibold leading-none"><Highlight>Sugerencias</Highlight></h2>
                <p className="text-sm text-slate-500 dark:text-haze-400 mt-3">Lo que los estudiantes proponen para mejorar la app.</p>
              </div>
              <SuggestionsModeration onCount={setSuggestionCount} />
            </div>
          )}
          {tab === 'profile' && <AdminProfile />}
        </main>
      </div>

      <nav className="shrink-0 z-40 pb-[env(safe-area-inset-bottom)] bg-haze-50/90 dark:bg-ink-950/90 backdrop-blur-md border-t border-slate-900/[0.06] dark:border-white/[0.06]">
        <div className="max-w-md mx-auto px-6 py-2 grid grid-cols-5">
          {(
            [
              { id: 'events', label: 'Eventos', Icon: CalendarDays },
              { id: 'groups', label: 'Grupos', Icon: Users },
              { id: 'reports', label: 'Reportes', Icon: Flag },
              { id: 'suggestions', label: 'Ideas', Icon: Lightbulb },
              { id: 'profile', label: 'Mi perfil', Icon: User },
            ] as const
          ).map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <motion.button
                key={id}
                whileTap={{ scale: 0.9 }}
                onClick={() => setTab(id)}
                aria-current={on ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-1.5 transition-colors ${
                  on ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-haze-500 hover:text-slate-700 dark:hover:text-haze-300'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5.5 h-5.5" strokeWidth={on ? 2.25 : 2} />
                  {((id === 'events' && pending > 0) || (id === 'groups' && groupPending > 0) || (id === 'reports' && reportCount > 0) || (id === 'suggestions' && suggestionCount > 0)) && (
                    <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-brand-600 ring-2 ring-haze-50 dark:ring-ink-950" />
                  )}
                </span>
                <span className="text-[11px] font-semibold">{label}</span>
                {on && <motion.span layoutId="admin-nav-dot" transition={spring} className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-sun" />}
              </motion.button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
