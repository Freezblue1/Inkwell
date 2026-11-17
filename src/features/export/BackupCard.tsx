import { useRef, useState } from 'react';
import { Button, Card, CardContent, Stack, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { useStore } from '@/store';
import { exportBundle, importBundle, isProjectBundle } from '@/db/bundle';
import { downloadBlob, fileSafe } from '@/lib/export/download';
import { flushAll } from '@/features/editor/autosave';

/** Backup the whole project to a single .inkwell file, or restore one. */
export function BackupCard() {
  const project = useStore((s) => s.project);
  const notify = useStore((s) => s.notify);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!project) return null;

  const backup = async () => {
    setBusy(true);
    try {
      await flushAll();
      const bundle = await exportBundle(project.id);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([JSON.stringify(bundle)], { type: 'application/json' }), `${fileSafe(project.title)}-${stamp}.inkwell`);
      notify('Backup downloaded — keep it somewhere safe (cloud drive, USB stick…)');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Backup failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File) => {
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      if (!isProjectBundle(data)) throw new Error('This file is not an Inkwell backup.');
      const id = await importBundle(data);
      await useStore.getState().loadProjects();
      notify(`Restored “${data.project.title}” as a new project`, 'success', { label: 'Open', run: () => void useStore.getState().openProject(id) });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not restore the backup', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }} gutterBottom>
          Backup &amp; restore
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          One <code>.inkwell</code> file holds everything: text, snapshots, story bible, research files, goals and settings for this project. Restoring always creates a new copy.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => void backup()} disabled={busy}>
            Download backup
          </Button>
          <Button startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()} disabled={busy}>
            Restore…
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".inkwell,.json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restore(f);
              e.target.value = '';
            }}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
