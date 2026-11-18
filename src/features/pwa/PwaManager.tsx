/**
 * Wires Inkwell into the platform as a PWA:
 * - registers the service worker and offers updates (saving first),
 * - captures the install prompt, tracks online/offline,
 * - handles app-icon shortcuts (?action=… / ?view=…),
 * - opens .inkwell backups launched from the OS (installed app, Chromium).
 */
import { useEffect, useRef } from 'react';
import { Alert, Button, Snackbar } from '@mui/material';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useStore } from '@/store';
import type { View } from '@/store/uiSlice';
import { flushAll } from '@/features/editor/autosave';
import { importBundle, isProjectBundle } from '@/db/bundle';
import { newSceneAfterCurrent } from '@/features/tools/useGlobalShortcuts';
import { usePwa, type BeforeInstallPromptEvent } from './pwaStore';
import { desktop, isDesktop } from '@/lib/desktop';
import { UpdateReadySnackbar, useDesktopUpdates } from './DesktopUpdates';
import { flushFolderSync } from '@/features/folderSync/folderSync';

const UPDATE_CHECK_MS = 60 * 60 * 1000;
const VIEWS: View[] = ['write', 'plan', 'research', 'goals', 'export', 'history'];

interface LaunchParams {
  files: { getFile(): Promise<File> }[];
}
type LaunchQueue = { setConsumer(cb: (p: LaunchParams) => void): void };

async function openBackupFile(file: File) {
  const s = useStore.getState();
  try {
    const data = JSON.parse(await file.text());
    if (!isProjectBundle(data)) throw new Error(`“${file.name}” is not an Inkwell backup.`);
    const id = await importBundle(data);
    await s.loadProjects();
    await useStore.getState().openProject(id);
    s.notify(`Opened “${data.project.title}” from ${file.name} (as a new copy)`);
  } catch (e) {
    s.notify(e instanceof Error ? e.message : 'Could not open that file', 'error');
  }
}

/** Desktop app vs. browser/PWA. The desktop app has no service worker. */
export function PwaManager() {
  return isDesktop() ? <DesktopManager /> : <WebPwaManager />;
}

/** Electron: save before the window closes, open .inkwell files passed in by Windows. */
function DesktopManager() {
  useDesktopUpdates();
  useEffect(() => {
    const bridge = desktop();
    if (!bridge) return;
    usePwa.getState().setStandalone(true);
    bridge.onAppClosing(async () => {
      await flushAll();
      await flushFolderSync();
    });
    bridge.onOpenFile(({ name, text }) => void openBackupFile(new File([text], name, { type: 'application/json' })));
    bridge.ready();
  }, []);
  return (
    <>
      <AppShortcuts />
      <UpdateReadySnackbar />
    </>
  );
}

/** App-icon shortcuts (?action=… / ?view=…), shared by web and desktop. */
function AppShortcuts() {
  const projectId = useStore((s) => s.project?.id);
  const handledUrl = useRef(false);
  useEffect(() => {
    if (handledUrl.current || !projectId) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const view = params.get('view') as View | null;
    if (!action && !view) return;
    handledUrl.current = true;
    const s = useStore.getState();
    if (view && VIEWS.includes(view)) s.setView(view);
    if (action === 'new-scene') void newSceneAfterCurrent();
    if (action === 'scratchpad') s.openDialog('scratchpad');
    window.history.replaceState(null, '', window.location.pathname);
  }, [projectId]);
  return null;
}

function WebPwaManager() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
    onOfflineReady() {
      usePwa.getState().setOfflineReady(true);
      useStore.getState().notify('Inkwell is ready to work offline', 'success');
    },
    onRegisterError(error) {
      console.warn('[Inkwell] service worker registration failed', error);
    },
  });

  // Install prompt, installed event, display mode and connectivity.
  useEffect(() => {
    const pwa = usePwa.getState();
    const onPrompt = (e: Event) => {
      e.preventDefault(); // we show our own "Install" entry instead of the mini-infobar
      pwa.setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      pwa.setInstallEvent(null);
      useStore.getState().notify('Inkwell is installed — find it with your other apps');
    };
    const onOnline = () => {
      pwa.setOnline(true);
      useStore.getState().notify('Back online', 'info');
    };
    const onOffline = () => {
      pwa.setOnline(false);
      useStore.getState().notify('You’re offline — everything keeps saving on this device', 'info');
    };
    const mq = window.matchMedia('(display-mode: standalone)');
    const onMode = () => pwa.setStandalone(mq.matches);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    mq.addEventListener?.('change', onMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      mq.removeEventListener?.('change', onMode);
    };
  }, []);

  // Files opened with the installed app (file_handlers in the manifest).
  useEffect(() => {
    const lq = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
    lq?.setConsumer(async (params) => {
      for (const handle of params.files ?? []) await openBackupFile(await handle.getFile());
    });
  }, []);

  const reload = async () => {
    // Never lose a keystroke: save everything before the new version takes over.
    await flushAll();
    await updateServiceWorker(true);
  };

  return (
    <>
    <AppShortcuts />
    <Snackbar open={needRefresh} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} sx={{ bottom: { xs: 88, sm: 24 } }}>
      <Alert
        severity="info"
        variant="filled"
        onClose={() => setNeedRefresh(false)}
        action={
          <Button color="inherit" size="small" onClick={() => void reload()}>
            Update
          </Button>
        }
        sx={{ alignItems: 'center' }}
      >
        A new version of Inkwell is ready.
      </Alert>
    </Snackbar>
    </>
  );
}
