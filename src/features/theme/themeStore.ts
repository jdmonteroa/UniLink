import { create } from 'zustand';

export type DesignProposal = 'campus-pulse' | 'alma-mater';
export type ConnectionMode = 'study' | 'friendship' | 'dating';

interface ThemeState {
  isDarkMode: boolean;
  activeDesign: DesignProposal;
  activeModePreview: ConnectionMode;
  toggleDarkMode: () => void;
  setDesignProposal: (proposal: DesignProposal) => void;
  setActiveModePreview: (mode: ConnectionMode) => void;
}

const THEME_KEY = 'unilink-theme';

function readInitialDark(): boolean {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === 'dark';
  } catch {
    // almacenamiento bloqueado: usamos la preferencia del sistema
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

const initialDark = readInitialDark();
if (typeof document !== 'undefined') applyDark(initialDark);

export const useThemeStore = create<ThemeState>((set) => ({
  isDarkMode: initialDark,
  activeDesign: 'campus-pulse',
  activeModePreview: 'study',
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      applyDark(next);
      try {
        localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      } catch {
        // sin almacenamiento: el tema solo dura esta visita
      }
      return { isDarkMode: next };
    }),
  setDesignProposal: (proposal) =>
    set(() => {
      if (proposal === 'alma-mater') {
        document.documentElement.setAttribute('data-design-system', 'editorial');
      } else {
        document.documentElement.removeAttribute('data-design-system');
      }
      return { activeDesign: proposal };
    }),
  setActiveModePreview: (mode) => set({ activeModePreview: mode }),
}));
