import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, SquarePlus, Check } from 'lucide-react';
import { usePwaStore, installPlatform } from '@/lib/pwa';

/**
 * Tarjeta "Instala UniLink" para el perfil.
 *  - Android / Chrome / Edge: botón que abre el aviso nativo de instalación.
 *  - iPhone (Safari): instrucciones, porque iOS no permite un botón de instalar.
 *  - Ya instalada o navegador sin soporte: no se muestra.
 */
export const InstallCard: React.FC = () => {
  const deferredPrompt = usePwaStore((s) => s.deferredPrompt);
  const installed = usePwaStore((s) => s.installed);
  const promptInstall = usePwaStore((s) => s.promptInstall);
  const [showIosSteps, setShowIosSteps] = useState(false);

  const platform = installPlatform({ deferredPrompt, installed });
  if (platform === 'none') return null;

  return (
    <section className="rounded-3xl bg-white dark:bg-ink-850 p-5 shadow-soft-sm">
      <div className="flex items-center gap-4">
        <img
          src="/pwa-192x192.png"
          alt=""
          className="w-14 h-14 rounded-2xl shrink-0 -rotate-3 shadow-sticker"
          width={56}
          height={56}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold leading-tight">Instala UniLink</h3>
          <p className="text-sm text-slate-500 dark:text-haze-400 mt-0.5">
            Ábrela desde tu pantalla de inicio, como cualquier app.
          </p>
        </div>
      </div>

      {platform === 'prompt' ? (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="mt-4 w-full h-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]"
        >
          <Download className="w-4 h-4" /> Instalar app
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowIosSteps((v) => !v)}
            aria-expanded={showIosSteps}
            className="mt-4 w-full h-12 rounded-full border-2 border-slate-900/10 dark:border-white/10 hover:border-slate-900 dark:hover:border-slate-50 text-sm font-semibold transition"
          >
            {showIosSteps ? 'Ocultar pasos' : '¿Cómo la instalo?'}
          </button>
          <AnimatePresence initial={false}>
            {showIosSteps && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <ol className="pt-4 space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-mint text-slate-900 flex items-center justify-center">
                      <Share className="w-3.5 h-3.5" />
                    </span>
                    <span className="pt-1">
                      En Safari, toca el botón <strong>Compartir</strong> (el cuadro con la flecha hacia arriba).
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-sun text-slate-900 flex items-center justify-center">
                      <SquarePlus className="w-3.5 h-3.5" />
                    </span>
                    <span className="pt-1">
                      Elige <strong>Agregar a inicio</strong>. Si no aparece, desliza la lista hacia abajo.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-coral text-slate-900 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span className="pt-1">
                      Toca <strong>Agregar</strong>. UniLink aparecerá en tu pantalla de inicio.
                    </span>
                  </li>
                </ol>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </section>
  );
};
