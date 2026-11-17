import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useStore } from '@/store';
import { requestPersistentStorage } from '@/db/db';
import { installUnloadHandlers } from '@/features/editor/autosave';
import { AppShell } from './AppShell';
import { HomePage } from '@/features/projects/HomePage';
import { DialogHost } from '@/components/DialogHost';
import { SnackbarHost } from '@/components/SnackbarHost';
import { PwaManager } from '@/features/pwa/PwaManager';
import { JungleDecor } from './JungleDecor';

/** Loads settings and projects, then shows Home (or the open project's shell). */
export function Bootstrap() {
  const [ready, setReady] = useState(false);
  const project = useStore((s) => s.project);
  const jungleDecor = useStore((s) => s.settings.themeMode === 'jungle' && s.settings.jungleDecor !== false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = useStore.getState();
      installUnloadHandlers();
      void requestPersistentStorage();
      try {
        await s.loadSettings();
        await s.loadProjects();
        // Inkwell opens on Home. App-icon shortcuts (?action=new-scene, ?view=goals) still go straight into the last project.
        const params = new URLSearchParams(window.location.search);
        if (params.has('action') || params.has('view')) {
          const { settings, projects } = useStore.getState();
          const last = projects.find((p) => p.id === settings.lastProjectId) ?? [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0] ?? null;
          if (last) await useStore.getState().openProject(last.id);
        }
      } catch (err) {
        console.error(err);
        useStore.getState().notify('Inkwell could not open its database. Is private browsing blocking storage?', 'error');
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {!ready ? (
        <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }} aria-busy="true">
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress aria-label="Loading Inkwell" />
            <Typography sx={{ mt: 2 }} color="text.secondary">
              Opening your desk…
            </Typography>
          </Box>
        </Box>
      ) : project ? (
        <AppShell />
      ) : (
        <HomePage />
      )}
      <DialogHost />
      <SnackbarHost />
      <PwaManager />
      {jungleDecor && <JungleDecor />}
    </>
  );
}
