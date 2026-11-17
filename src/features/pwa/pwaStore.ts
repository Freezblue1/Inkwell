/** PWA state: install prompt, standalone mode, connectivity and offline readiness. */
import { create } from 'zustand';

/** Chromium's install prompt event (not yet in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);

interface PwaState {
  installEvent: BeforeInstallPromptEvent | null;
  standalone: boolean;
  online: boolean;
  offlineReady: boolean;
  setInstallEvent(e: BeforeInstallPromptEvent | null): void;
  setStandalone(v: boolean): void;
  setOnline(v: boolean): void;
  setOfflineReady(v: boolean): void;
  /** Shows the browser's install dialog. Returns true if the user accepted. */
  install(): Promise<boolean>;
}

export const usePwa = create<PwaState>((set, get) => ({
  installEvent: null,
  standalone: detectStandalone(),
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  offlineReady: false,
  setInstallEvent: (installEvent) => set({ installEvent }),
  setStandalone: (standalone) => set({ standalone }),
  setOnline: (online) => set({ online }),
  setOfflineReady: (offlineReady) => set({ offlineReady }),
  async install() {
    const e = get().installEvent;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    set({ installEvent: null });
    return outcome === 'accepted';
  },
}));
