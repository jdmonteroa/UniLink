/**
 * App de Android (APK). El archivo vive en public/downloads/unilink.apk y se sirve desde la misma web.
 * Es una Trusted Web Activity: abre este sitio a pantalla completa, así que las mejoras de la web
 * les llegan solas a quienes ya la instalaron. Solo hay que subir un APK nuevo si cambia el ícono,
 * el nombre, el paquete o la URL (ver README, "App de Android").
 */
export const ANDROID_APK = {
  url: '/downloads/unilink.apk',
  /** Subir este número cada vez que se reemplace el APK. */
  version: '1.0.0',
  sizeMb: __APK_SIZE_MB__,
};

export const isAndroid = (): boolean => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

/** true si la web ya corre como app instalada (APK o PWA), donde no tiene sentido ofrecer la descarga. */
export const isRunningAsApp = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    document.referrer.startsWith('android-app://') ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);
