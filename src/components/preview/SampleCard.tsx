import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckBadgeIcon,
  SparklesIcon,
  HeartIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@/components/icons';
import { ConnectionMode } from '@/features/theme/themeStore';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface SampleCardProps {
  mode: ConnectionMode;
}

export const SampleCard: React.FC<SampleCardProps> = ({ mode }) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [liked, setLiked] = useState<boolean | null>(null);

  // Perfiles de demostración estilizados y realistas
  const profileData = {
    study: {
      name: 'Sofía',
      age: 21,
      career: 'Ing. Biomédica',
      university: 'UNAM • CU',
      compatibility: 94,
      sharedSubjectsCount: 3,
      sharedSubjects: ['Bioinstrumentación', 'Fisiología II', 'Bioseñales'],
      freeTimeOverlap: 'Martes y Jueves 4:00 - 6:00 PM',
      tags: ['Ciencia', 'Música Indie', 'Lectura', 'Café Filtro', 'Python'],
      photos: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
      ],
      bio: 'Creativa, apasionada por la biotecnología y el diseño de sensores. Busco alguien con quien estudiar para los parciales y tomar café.',
      modeLabel: 'Estudio',
    },
    friendship: {
      name: 'Valeria',
      age: 20,
      career: 'Diseño & Comunicación',
      university: 'UdeG • CUAAD',
      compatibility: 91,
      sharedSubjectsCount: 2,
      sharedSubjects: ['Tipografía Avanzada', 'Semiótica'],
      freeTimeOverlap: 'Miércoles y Viernes 1:00 - 3:00 PM',
      tags: ['Fotografía 35mm', 'Cineclub', 'Bádminton', 'Matcha', 'Exposiciones'],
      photos: [
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
      ],
      bio: 'Siempre lista para probar comida cerca del campus, visitar galerías de arte o ir al cineclub los jueves. ¡Vamos por un matcha!',
      modeLabel: 'Amistad',
    },
    dating: {
      name: 'Camila',
      age: 22,
      career: 'Arquitectura',
      university: 'ITESM • Campus GDL',
      compatibility: 96,
      sharedSubjectsCount: 2,
      sharedSubjects: ['Urbanismo Sostenible', 'Historia del Arte'],
      freeTimeOverlap: 'Viernes después de las 3:00 PM',
      tags: ['Jazz en Vivo', 'Museos', 'Cafeterías', 'Plantas', 'Arquitectura'],
      photos: [
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      ],
      bio: 'Amante de las buenas pláticas con un flat white, las maquetas con buena música y caminar por la ciudad buscando edificios con historia.',
      modeLabel: 'Pareja',
    },
  }[mode];

  const handleAction = (isLike: boolean) => {
    setLiked(isLike);
    if (isLike) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.75 },
        colors: ['#8266ff', '#6b4cf0', '#5b8def', '#9d89ff', '#bbaeff'],
      });
    }
    setTimeout(() => {
      setLiked(null);
    }, 1300);
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto">
      {/* Tarjeta con esquinas suaves y efecto de cristal */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-4xl bg-white/90 dark:bg-surface-cardDark/90 backdrop-blur-2xl border border-haze-200 dark:border-ink-700 shadow-soft-lg transition-all duration-300"
      >
        {/* Contenedor de Fotografía */}
        <div className="relative aspect-[4/4.8] w-full overflow-hidden bg-slate-900 group">
          <img
            src={profileData.photos[photoIndex]}
            alt={profileData.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Degradado inferior con tinte violeta/rosa tenue */}
          <div className="absolute inset-0 bg-linear-to-t from-ink-950 via-ink-950/30 to-transparent pointer-events-none" />

          {/* Indicadores de fotos superiores */}
          <div className="absolute top-3 inset-x-4 flex gap-1.5 z-10">
            {profileData.photos.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPhotoIndex(idx)}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-300',
                  idx === photoIndex
                    ? 'bg-white shadow-xs'
                    : 'bg-white/30 hover:bg-white/50'
                )}
                aria-label={`Foto ${idx + 1}`}
              />
            ))}
          </div>

          {/* Chips flotantes institucionales (Arriba de la foto) */}
          <div className="absolute top-7 inset-x-4 flex items-center justify-between text-xs z-10 pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white/90 font-medium text-[11px] border border-white/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              {profileData.career}
            </span>

            {/* Insignia de Estudiante Verificado */}
            <div className="px-2.5 py-1 rounded-full bg-brand-600/80 backdrop-blur-md text-white font-semibold text-[10px] uppercase tracking-wider border border-brand-400/30 flex items-center gap-1 shadow-glow-brand">
              <CheckBadgeIcon className="w-3.5 h-3.5 fill-brand-300 text-brand-900" />
              <span>Verificado</span>
            </div>
          </div>

          {/* Botones discretos de avance/retroceso de foto */}
          {photoIndex > 0 && (
            <button
              onClick={() => setPhotoIndex((p) => Math.max(0, p - 1))}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition"
              aria-label="Anterior"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
          )}
          {photoIndex < profileData.photos.length - 1 && (
            <button
              onClick={() => setPhotoIndex((p) => Math.min(profileData.photos.length - 1, p + 1))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition"
              aria-label="Siguiente"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}

          {/* Nombre, edad y Anillo de Compatibilidad sobre la foto */}
          <div className="absolute bottom-3 inset-x-4 flex items-end justify-between z-10 text-white">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {profileData.name}, {profileData.age}
                </h3>
              </div>
              <p className="text-xs text-brand-200/90 font-medium mt-0.5">
                {profileData.university}
              </p>
            </div>

            {/* Anillo de Compatibilidad Magnético */}
            <div className="flex flex-col items-center">
              <div className="relative w-12 h-12 rounded-full bg-surface-cardDark/80 backdrop-blur-md border border-brand-500/40 p-1 flex items-center justify-center shadow-glow-brand">
                <span className="text-xs font-extrabold text-transparent bg-clip-text bg-linear-to-r from-brand-400 to-brand-300">
                  {profileData.compatibility}%
                </span>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-brand-200/80 mt-1 font-semibold">
                Match
              </span>
            </div>
          </div>

          {/* Animación de Me Interesa / Pasar */}
          <AnimatePresence>
            {liked !== null && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.15, opacity: 0 }}
                className={cn(
                  'absolute inset-0 flex items-center justify-center font-extrabold text-2xl uppercase tracking-widest z-30 backdrop-blur-xs',
                  liked
                    ? 'bg-linear-to-tr from-brand-600/40 to-brand-600/40 text-brand-100 border-4 border-brand-400 m-8 rounded-3xl -rotate-6 shadow-glow-brand'
                    : 'bg-black/50 text-slate-300 border-4 border-slate-400 m-8 rounded-3xl rotate-6'
                )}
              >
                {liked ? '✨ ¡Me Interesa!' : 'Pasar'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sección inferior: Razones de match & Intereses */}
        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Píldora de Materias Compartidas */}
          <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-haze-200 dark:border-ink-700">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-brand-600 text-white shadow-soft-sm">
              <SparklesIcon className="w-3.5 h-3.5" />
            </span>
            <div className="text-xs">
              <span className="font-bold text-brand-700 dark:text-brand-300">
                Comparten {profileData.sharedSubjectsCount} materias:
              </span>{' '}
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {profileData.sharedSubjects.join(', ')}
              </span>
            </div>
          </div>

          {/* Disponibilidad Horaria */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 px-1">
            <ClockIcon className="w-4 h-4 text-brand-500 shrink-0" />
            <span>
              Libres en común:{' '}
              <strong className="text-slate-900 dark:text-slate-100 font-semibold">
                {profileData.freeTimeOverlap}
              </strong>
            </span>
          </div>

          {/* Biografía */}
          <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed px-1">
            "{profileData.bio}"
          </p>

          {/* Chips de Intereses lindos y redondeados */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {profileData.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-full text-[11px] font-semibold bg-haze-100 dark:bg-ink-800 text-haze-700 dark:text-haze-300 hover:scale-105 transition-transform"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Botones de Acción: Pasar y Me Interesa */}
          <div className="flex items-center justify-center gap-4 pt-3 pb-1">
            {/* Botón Pasar */}
            <button
              type="button"
              onClick={() => handleAction(false)}
              className="px-6 py-3.5 rounded-full border border-slate-200 dark:border-ink-700 bg-white dark:bg-surface-cardDark text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-ink-800 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition active:scale-95"
            >
              <XMarkIcon className="w-4 h-4 stroke-[2.5]" />
              <span>Pasar</span>
            </button>

            {/* Botón Me Interesa (Gradiente vibrante y magnético) */}
            <button
              type="button"
              onClick={() => handleAction(true)}
              className="px-8 py-3.5 rounded-full bg-linear-to-r from-brand-600 to-azure-500 hover:brightness-110 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-glow-gradient transition-all active:scale-95 ring-2 ring-brand-400/30"
            >
              <HeartIcon className="w-4 h-4 fill-white" />
              <span>Me Interesa</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
