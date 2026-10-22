import React from 'react';
import { Link } from 'react-router-dom';
import { Download, ShieldAlert, RefreshCw, Smartphone, ArrowLeft, Share, CheckCircle2 } from 'lucide-react';
import { Wordmark, Highlight } from '@/components/brand';
import { ANDROID_APK, isAndroid, isRunningAsApp } from '@/lib/android';

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <li className="flex items-start gap-3.5">
    <span className="w-8 h-8 shrink-0 rounded-full bg-sun text-slate-900 font-serif font-semibold flex items-center justify-center rotate-[-4deg] shadow-sticker">{n}</span>
    <span className="pt-0.5 text-sm leading-relaxed">
      <strong className="block text-base font-semibold">{title}</strong>
      <span className="text-slate-600 dark:text-haze-300">{children}</span>
    </span>
  </li>
);

/**
 * Página pública (/descargar): no pide iniciar sesión. Ahí se baja el APK de Android
 * con las instrucciones de instalación.
 */
export const DownloadPage: React.FC = () => {
  const alreadyApp = isRunningAsApp();
  const onAndroid = isAndroid();
  const size = ANDROID_APK.sizeMb ? ` · ${ANDROID_APK.sizeMb} MB` : '';

  return (
    <div className="min-h-dvh bg-haze-50 dark:bg-ink-950 text-slate-900 dark:text-slate-50 transition-colors duration-500">
      <main className="max-w-md mx-auto px-5 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-haze-300 hover:text-slate-900 dark:hover:text-slate-50 transition">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Link>
          <Wordmark className="text-2xl" />
        </div>

        <header className="space-y-3">
          <img src="/pwa-192x192.png" alt="" width={72} height={72} className="w-18 h-18 rounded-3xl -rotate-3 shadow-sticker" />
          <h1 className="text-4xl font-semibold leading-tight">
            UniLink para <Highlight>Android</Highlight>
          </h1>
          <p className="text-base text-slate-600 dark:text-haze-300">
            Instálala como cualquier app: se abre a pantalla completa desde tu menú de aplicaciones.
          </p>
        </header>

        {alreadyApp ? (
          <p className="flex items-start gap-2.5 p-4 rounded-2xl bg-mint/40 dark:bg-mint/10 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-azure-700 dark:text-azure-300" />
            <span>Ya estás usando UniLink como app. No necesitas descargar nada.</span>
          </p>
        ) : (
          <section className="rounded-3xl bg-white dark:bg-ink-850 p-5 shadow-soft-sm space-y-3">
            <a
              href={ANDROID_APK.url}
              download="UniLink.apk"
              className="w-full h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-base font-semibold flex items-center justify-center gap-2 shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]"
            >
              <Download className="w-5 h-5" /> Descargar APK
            </a>
            <p className="text-center text-xs text-slate-500 dark:text-haze-400">
              Versión {ANDROID_APK.version}{size} · Android
            </p>
            {!onAndroid && (
              <p className="text-center text-xs text-slate-500 dark:text-haze-400">
                Para instalarla, abre esta página desde tu teléfono Android (o pasa el archivo al teléfono).
              </p>
            )}
          </section>
        )}

        <section className="rounded-3xl bg-white dark:bg-ink-850 p-5 shadow-soft-sm space-y-4">
          <h2 className="text-2xl font-semibold">Cómo instalarla</h2>
          <ol className="space-y-4">
            <Step n={1} title="Descarga el archivo">
              Toca <strong>Descargar APK</strong>. Si tu navegador pregunta si quieres conservar el archivo, acepta.
            </Step>
            <Step n={2} title="Ábrelo">
              Toca el archivo en la notificación de descargas o en la app <strong>Archivos</strong>. Si Android avisa que no puede instalar apps de esta fuente, entra a <strong>Configuración</strong> y activa <strong>Permitir de esta fuente</strong> para tu navegador. Después regresa.
            </Step>
            <Step n={3} title="Instala y listo">
              Toca <strong>Instalar</strong> y luego <strong>Abrir</strong>. Inicia sesión con tu correo institucional como siempre.
            </Step>
          </ol>
        </section>

        <section className="space-y-3 text-sm">
          <p className="flex items-start gap-2.5 p-4 rounded-2xl bg-sun/30 dark:bg-sun/10">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              <strong>¿Android muestra un aviso de seguridad?</strong> Es normal con apps que no vienen de Play Store. Si Play Protect pregunta, elige <strong>Instalar de todos modos</strong>. Descarga el archivo solo desde esta página.
            </span>
          </p>
          <p className="flex items-start gap-2.5 p-4 rounded-2xl bg-white dark:bg-ink-850 shadow-soft-sm">
            <RefreshCw className="w-5 h-5 shrink-0 mt-0.5" />
            <span><strong>Se actualiza sola.</strong> Cuando mejoremos UniLink, lo verás al abrirla: no tienes que descargar otro archivo. Necesita el navegador Chrome instalado en el teléfono.</span>
          </p>
          <p className="flex items-start gap-2.5 p-4 rounded-2xl bg-white dark:bg-ink-850 shadow-soft-sm">
            <Smartphone className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              <strong>¿Usas iPhone?</strong> No hay APK para iOS. Abre UniLink en <strong>Safari</strong>, toca <Share className="inline w-3.5 h-3.5 -mt-0.5" /> <strong>Compartir</strong> y elige <strong>Agregar a inicio</strong>.
            </span>
          </p>
        </section>
      </main>
    </div>
  );
};
