import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { spring } from '@/components/brand';

const UPDATE_CHECK_MS = 60 * 60 * 1000; // revisa si hay versión nueva cada hora

/**
 * Avisos de la PWA:
 *  - "Hay una versión nueva" cuando se publica un cambio (el usuario decide cuándo recargar).
 *  - "Sin conexión" mientras el celular no tiene internet.
 */
export const PwaPrompts: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_MS);
    },
  });

  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {offline && (
          <motion.div
            key="offline"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={spring}
            role="status"
            className="fixed top-[max(0.5rem,env(safe-area-inset-top))] inset-x-0 z-[90] flex justify-center px-4 pointer-events-none"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900 text-sm font-semibold shadow-soft-lg">
              <WifiOff className="w-4 h-4" /> Sin conexión
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {needRefresh && (
          <motion.div
            key="update"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={spring}
            role="status"
            className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[90] flex justify-center px-4"
          >
            <div className="w-full max-w-sm flex items-center gap-3 p-3 pl-4 rounded-2xl bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900 shadow-soft-lg">
              <span className="w-9 h-9 shrink-0 rounded-full bg-sun text-slate-900 flex items-center justify-center -rotate-6">
                <RefreshCw className="w-4 h-4" />
              </span>
              <p className="flex-1 text-sm font-medium leading-snug">Hay una versión nueva de UniLink.</p>
              <button
                type="button"
                onClick={() => setNeedRefresh(false)}
                className="px-2 h-9 text-sm font-semibold opacity-70 hover:opacity-100 transition"
              >
                Luego
              </button>
              <button
                type="button"
                onClick={() => {
                  // Si la página aún no la controla el service worker (primera visita),
                  // basta con recargar para abrir la versión nueva.
                  if (!navigator.serviceWorker?.controller) window.location.reload();
                  else void updateServiceWorker(true);
                }}
                className="h-9 px-4 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition active:scale-[0.97]"
              >
                Actualizar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
