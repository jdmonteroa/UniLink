import React from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { isRunningAsApp } from '@/lib/android';
import { cn } from '@/lib/utils';

/**
 * Botón grande "Descargar app" que va junto al logo. Lleva a /descargar (donde está el APK).
 * No se muestra si la web ya corre como app instalada.
 */
export const DownloadAppButton: React.FC<{ className?: string }> = ({ className }) => {
  if (isRunningAsApp()) return null;
  return (
    <Link
      to="/descargar"
      className={cn(
        'inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-full whitespace-nowrap',
        'bg-brand-600 hover:bg-brand-700 text-white text-sm sm:text-base font-bold',
        'shadow-glow-brand ring-2 ring-sun/80 transition hover:-translate-y-0.5 active:scale-[0.97]',
        className
      )}
    >
      <Download className="w-4.5 h-4.5 shrink-0" strokeWidth={2.5} />
      Descargar app
    </Link>
  );
};
