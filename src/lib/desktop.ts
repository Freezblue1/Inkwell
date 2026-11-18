/** Bridge to the Electron desktop shell (window.inkwellDesktop, set by electron/preload.cjs). */

export interface UpdateInfo {
  status: 'idle' | 'checking' | 'up-to-date' | 'downloading' | 'ready' | 'error';
  current: string;
  latest?: string;
  notes?: string;
  progress?: number;
  error?: string;
  /** The last check was started by the user (menu or Settings). */
  manual?: boolean;
  checkedAt?: number;
  /** Only the packaged portable exe can update itself. */
  supported: boolean;
  auto: boolean;
}

export interface DesktopBridge {
  isDesktop: true;
  platform: string;
  onOpenFile(cb: (file: { name: string; text: string }) => void): void;
  onAppClosing(cb: () => Promise<void> | void): void;
  ready(): void;
  /** Missing in desktop builds older than 1.0.2. */
  folders?: {
    pick(current?: string | null): Promise<string | null>;
    exists(dir: string): Promise<boolean>;
    list(dir: string): Promise<{ name: string; mtime: number; size: number }[]>;
    read(dir: string, name: string): Promise<string>;
    write(dir: string, name: string, text: string): Promise<{ name: string; mtime: number; size: number }>;
    remove(dir: string, name: string): Promise<void>;
    moveToDeleted(dir: string, name: string): Promise<void>;
    readMeta(dir: string): Promise<string | null>;
    writeMeta(dir: string, text: string): Promise<void>;
    open(dir: string): Promise<string>;
  };
  /** Missing in desktop builds older than 1.0.1. */
  updates?: {
    info(): Promise<UpdateInfo>;
    check(): Promise<UpdateInfo>;
    setAuto(auto: boolean): Promise<UpdateInfo>;
    restart(): void;
    onStatus(cb: (info: UpdateInfo) => void): void;
  };
}

export function desktop(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { inkwellDesktop?: DesktopBridge }).inkwellDesktop ?? null;
}

export const isDesktop = (): boolean => !!desktop();
