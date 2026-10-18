import { create } from 'zustand';

/**
 * Estado de instalación de la PWA.
 *
 * El navegador lanza `beforeinstallprompt` (Chrome/Edge/Android) muy temprano,
 * casi siempre antes de que el usuario llegue a su perfil. Por eso se escucha
 * aquí, al cargar la app, y se guarda para usarlo cuando presione "Instalar".
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'prompt' | 'ios' | 'none';

interface PwaState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  promptInstall: () => Promise<boolean>;
}

const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** Safari en iPhone/iPad no tiene botón de instalar: se agrega desde "Compartir". */
const isIosSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const otherBrowser = /crios|fxios|edgios|opios/i.test(ua);
  return iOS && !otherBrowser;
};

export const usePwaStore = create<PwaState>((set, get) => ({
  deferredPrompt: null,
  installed: isStandalone(),
  promptInstall: async () => {
    const evt = get().deferredPrompt;
    if (!evt) return false;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    set({ deferredPrompt: null });
    return outcome === 'accepted';
  },
}));

/** Qué forma de instalar ofrecer en este dispositivo. */
export function installPlatform(state: Pick<PwaState, 'deferredPrompt' | 'installed'>): InstallPlatform {
  if (state.installed) return 'none';
  if (state.deferredPrompt) return 'prompt';
  if (isIosSafari()) return 'ios';
  return 'none';
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // guardamos el aviso para mostrarlo con nuestro propio botón
    usePwaStore.setState({ deferredPrompt: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    usePwaStore.setState({ installed: true, deferredPrompt: null });
  });
}
