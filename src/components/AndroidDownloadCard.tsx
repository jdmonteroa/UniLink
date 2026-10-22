import React from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, ArrowRight } from 'lucide-react';
import { isRunningAsApp } from '@/lib/android';

/** Tarjeta del perfil con el botón de descarga. Se oculta si ya se usa la app instalada. */
export const AndroidDownloadCard: React.FC = () => {
  if (isRunningAsApp()) return null;
  return (
    <section className="rounded-3xl bg-white dark:bg-ink-850 p-5 shadow-soft-sm">
      <div className="flex items-center gap-4">
        <span className="w-14 h-14 shrink-0 rounded-2xl bg-mint text-slate-900 flex items-center justify-center rotate-3 shadow-sticker">
          <Smartphone className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold leading-tight">App para Android</h3>
          <p className="text-sm text-slate-500 dark:text-haze-400 mt-0.5">Descarga el APK y ábrela sin el navegador.</p>
        </div>
      </div>
      <Link
        to="/descargar"
        className="mt-4 w-full h-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]"
      >
        Descargar la app <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
};
