import { useEffect, useMemo } from 'react';
import { GlobalStyles } from '@mui/material';
import { useStore } from '@/store';
import { ensureDailyProjectSnapshot } from '@/db/repos/snapshots';
import { createRollingBackup } from '@/db/bundle';
import { getStorageInfo } from '@/db/db';
import { flushAll } from '@/features/editor/autosave';

const BACKUP_INTERVAL_MS = 10 * 60 * 1000;
const STORAGE_CHECK_MS = 5 * 60 * 1000;

/**
 * Invisible component that runs background work for the open project:
 * daily project snapshot, rolling backups, sprint timer, storage warnings,
 * and styles that hide resolved comments.
 */
export function BackgroundTasks() {
  const projectId = useStore((s) => s.project?.id);
  const sprintRunning = useStore((s) => s.sprint.status === 'running');
  const comments = useStore((s) => s.comments);

  // Daily auto-snapshot of the whole project.
  useEffect(() => {
    if (!projectId) return;
    const t = setTimeout(() => {
      ensureDailyProjectSnapshot(projectId).catch((e) => console.warn('Daily snapshot failed', e));
    }, 5000);
    return () => clearTimeout(t);
  }, [projectId]);

  // Rolling backups: every 10 minutes if anything changed.
  useEffect(() => {
    if (!projectId) return;
    let lastStamp = 0;
    const run = async () => {
      const docs = useStore.getState().docs;
      const stamp = Object.values(docs).reduce((m, d) => Math.max(m, d.updatedAt), 0);
      if (stamp <= lastStamp) return;
      lastStamp = stamp;
      await flushAll();
      await createRollingBackup(projectId).catch((e) => console.warn('Rolling backup failed', e));
    };
    const first = setTimeout(run, 60_000);
    const iv = setInterval(run, BACKUP_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [projectId]);

  // Sprint timer.
  useEffect(() => {
    if (!sprintRunning) return;
    const iv = setInterval(() => useStore.getState().tickSprint(), 1000);
    return () => clearInterval(iv);
  }, [sprintRunning]);

  // Warn when storage is nearly full.
  useEffect(() => {
    let warned = false;
    const check = async () => {
      const info = await getStorageInfo();
      if (info && info.ratio > 0.85 && !warned) {
        warned = true;
        useStore
          .getState()
          .notify(
            `Browser storage is ${Math.round(info.ratio * 100)}% full. Export a backup and remove large research files.`,
            'warning',
            { label: 'Backup', run: () => useStore.getState().setView('export') },
          );
      }
    };
    void check();
    const iv = setInterval(check, STORAGE_CHECK_MS);
    return () => clearInterval(iv);
  }, []);

  // Resolved comments: keep the mark in the text, but hide its highlight.
  const resolvedCss = useMemo(() => {
    const ids = comments.filter((c) => c.resolved).map((c) => `[data-comment-id="${c.id}"]`);
    return ids.length ? { [ids.join(',')]: { background: 'none !important', borderBottom: 'none !important' } } : {};
  }, [comments]);

  return <GlobalStyles styles={resolvedCss} />;
}
