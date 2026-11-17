/** Bridge to the Electron desktop shell (window.inkwellDesktop, set by electron/preload.cjs). */

export interface DesktopBridge {
  isDesktop: true;
  platform: string;
  onOpenFile(cb: (file: { name: string; text: string }) => void): void;
  onAppClosing(cb: () => Promise<void> | void): void;
  ready(): void;
}

export function desktop(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { inkwellDesktop?: DesktopBridge }).inkwellDesktop ?? null;
}

export const isDesktop = (): boolean => !!desktop();
