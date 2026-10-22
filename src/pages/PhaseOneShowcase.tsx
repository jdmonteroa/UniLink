import React from 'react';
import { useThemeStore, ConnectionMode } from '@/features/theme/themeStore';
import { SampleCard } from '@/components/preview/SampleCard';
import {
  SunIcon,
  MoonIcon,
  BookOpenIcon,
  UserGroupIcon,
  HeartIcon,
  SparklesIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils';

export const PhaseOneShowcase: React.FC = () => {
  const {
    isDarkMode,
    activeModePreview,
    toggleDarkMode,
    setActiveModePreview,
  } = useThemeStore();

  const modes: {
    id: ConnectionMode;
    label: string;
    icon: typeof BookOpenIcon;
    badgeText: string;
  }[] = [
    {
      id: 'friendship',
      label: 'Amistad',
      icon: UserGroupIcon,
      badgeText: 'Campus & Salidas',
    },
    {
      id: 'dating',
      label: 'Pareja',
      icon: HeartIcon,
      badgeText: 'Citas & Conexión',
    },
  ];

  return (
    <div className="min-h-screen bg-haze-50 dark:bg-ink-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Header flotante con controles de tema */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-ink-900/70 border-b border-haze-200 dark:border-ink-700 transition-colors">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          {/* Logo UniLink con degradado rosa/morado */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-brand-600 to-azure-500 flex items-center justify-center text-white font-extrabold text-xl shadow-glow-brand">
              U
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                  UniLink
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-ink-800 text-brand-700 dark:text-brand-300 border border-haze-200 dark:border-ink-700">
                  Fase 1: Identidad & UI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-haze-400">
                Conexión universitaria verificada
              </p>
            </div>
          </div>

          {/* Selector de Modo Nocturno / Claro */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-haze-200 dark:border-ink-700 bg-white/80 dark:bg-ink-800 text-slate-700 dark:text-brand-200 hover:scale-105 transition shadow-xs text-xs font-semibold"
              aria-label="Cambiar tema de color"
            >
              {isDarkMode ? (
                <>
                  <SunIcon className="w-4 h-4 text-amber-400" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <MoonIcon className="w-4 h-4 text-brand-600" />
                  <span>Modo Nocturno</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* Título y descripción */}
        <section className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100/70 dark:bg-ink-800 text-brand-700 dark:text-brand-300 border border-haze-200 dark:border-ink-700 text-xs font-semibold">
            <SparklesIcon className="w-3.5 h-3.5 text-brand-500" />
            <span>Nueva Identidad Visual: "Lila & Rosa Conexión"</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Diseñada para conectar,{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-brand-500 via-brand-500 to-brand-500">
              atractiva, moderna y auténtica
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-haze-400 max-w-xl mx-auto leading-relaxed">
            Eliminamos el look genérico para crear una interfaz con personalidad propia: degradados en rosas y morados magnéticos, esquinas suaves, tarjetas translúcidas y modo nocturno en obsidiana profunda.
          </p>
        </section>

        {/* Pestañas de Modos de Conexión */}
        <section className="space-y-4">
          <div className="flex justify-center">
            <div className="inline-flex p-1.5 rounded-full bg-white dark:bg-ink-850 border border-haze-200 dark:border-ink-700 shadow-xs gap-1">
              {modes.map((mode) => {
                const isActive = activeModePreview === mode.id;
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setActiveModePreview(mode.id)}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200',
                      isActive
                        ? 'bg-linear-to-r from-brand-600 to-azure-500 hover:brightness-110 text-white shadow-glow-brand scale-100'
                        : 'text-slate-600 dark:text-brand-300 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Demostración interactiva de la tarjeta */}
          <div className="py-2">
            <SampleCard mode={activeModePreview} />
          </div>

          <p className="text-center text-xs text-slate-400 dark:text-haze-400">
            💖 <em>Prueba pulsar <strong>"Me Interesa"</strong> para ver la animación de confeti temático y el feedback reactivo.</em>
          </p>
        </section>

        {/* Detalles de la paleta y características */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-5 rounded-3xl bg-white/70 dark:bg-ink-850/70 border border-haze-200 dark:border-ink-700 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-ink-800 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold">
              ✨
            </div>
            <h3 className="font-bold text-sm">Paleta Rosa & Violeta</h3>
            <p className="text-xs text-slate-500 dark:text-haze-400 leading-relaxed">
              Fucsia vibrante (`#8266ff`), rosa chicle chic (`#6b4cf0`) y violeta magnético (`#5b8def`) que transmiten química, simpatía y conexión.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-white/70 dark:bg-ink-850/70 border border-haze-200 dark:border-ink-700 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-ink-800 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold">
              🌙
            </div>
            <h3 className="font-bold text-sm">Dos Modos Pulidos</h3>
            <p className="text-xs text-slate-500 dark:text-haze-400 leading-relaxed">
              Nocturno en obsidiana violeta profunda (`#0C0817`) con resplandores de neón, y Claro en blanco perla con toques lila suave (`#FAF8FD`).
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-white/70 dark:bg-ink-850/70 border border-haze-200 dark:border-ink-700 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-ink-800 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold">
              🎓
            </div>
            <h3 className="font-bold text-sm">Verificación Real</h3>
            <p className="text-xs text-slate-500 dark:text-haze-400 leading-relaxed">
              Insignias de correo institucional autenticado, materias en común, coincidencia de horario y 3 modos separados (Estudio, Amistad, Pareja).
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-haze-200 dark:border-ink-700 py-6 text-center text-xs text-slate-400 dark:text-haze-400">
        UniLink © 2026 • Red universitaria con verificación institucional
      </footer>
    </div>
  );
};
