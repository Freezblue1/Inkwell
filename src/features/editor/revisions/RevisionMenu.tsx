/** Toolbar button + menu for revision mode: pick a pass, markup/final view, navigate, accept/reject. */
import { useState } from 'react';
import { Box, Divider, IconButton, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Switch, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import RateReviewIcon from '@mui/icons-material/RateReviewOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecialOutlined';
import { useStore } from '@/store';
import { confirmDialog } from '@/components/DialogHost';
import { REVISION_PASSES, passInfo } from './passes';
import { listChanges, type RevisionAction } from './resolve';
import { resolveRevisionsInProject } from './project';

export function passColor(n: number, mode: 'light' | 'dark'): string {
  const p = passInfo(n);
  return mode === 'dark' ? p.dark : p.light;
}

export function PassDot({ n, size = 10 }: { n: number; size?: number }) {
  const theme = useTheme();
  return <Box component="span" aria-hidden sx={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', bgcolor: passColor(n, theme.palette.mode), flexShrink: 0 }} />;
}

export async function resolveInProject(action: RevisionAction, pass: number | null) {
  const s = useStore.getState();
  const label = pass ? passInfo(pass).name.toLowerCase() : 'all revisions';
  const ok = await confirmDialog({
    title: `${action === 'accept' ? 'Accept' : 'Reject'} ${label} in the whole project?`,
    message:
      action === 'accept'
        ? 'Added text becomes normal text and deleted text is removed, in every document. Each changed document is snapshotted first, so you can undo this from its Snapshots.'
        : 'Added text is removed and deleted text comes back, in every document. Each changed document is snapshotted first.',
    confirmLabel: action === 'accept' ? 'Accept all' : 'Reject all',
    danger: action === 'reject',
  });
  if (!ok) return;
  const ids = Object.values(s.docs)
    .filter((d) => !d.trashed)
    .map((d) => d.id);
  const n = await resolveRevisionsInProject(ids, action, pass);
  s.notify(n ? `${action === 'accept' ? 'Accepted' : 'Rejected'} ${label} in ${n} document${n === 1 ? '' : 's'}` : 'No tracked changes found', n ? 'success' : 'info');
}

export function RevisionMenu() {
  const theme = useTheme();
  const pass = useStore((s) => s.revisionPass);
  const view = useStore((s) => s.revisionView);
  const editor = useStore((s) => s.activeEditor);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [scope, setScope] = useState<number | 'all'>('all');
  const has = !!editor && !editor.isDestroyed;
  const changes = anchor && has ? listChanges(editor.state.doc) : [];
  const scoped = scope === 'all' ? changes : changes.filter((c) => c.pass === scope);
  const scopePass = scope === 'all' ? null : scope;
  const s = useStore.getState;

  const close = () => setAnchor(null);
  const act = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <>
      <Tooltip title={pass ? `Revision mode: ${passInfo(pass).name} (Ctrl+Alt+R)` : 'Revision mode (Ctrl+Alt+R)'}>
        <IconButton
          size="small"
          aria-label="Revision mode"
          aria-haspopup="menu"
          aria-pressed={!!pass}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={pass ? { bgcolor: 'action.selected', color: passColor(pass, theme.palette.mode) } : undefined}
        >
          <RateReviewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close} slotProps={{ paper: { sx: { minWidth: 300 } } }}>
        <ListSubheader sx={{ lineHeight: '32px' }}>Revision mode — new edits are tracked</ListSubheader>
        <MenuItem selected={!pass} onClick={act(() => s().setRevisionPass(null))}>
          <ListItemIcon>{!pass && <CheckIcon fontSize="small" />}</ListItemIcon>
          <ListItemText>Off</ListItemText>
        </MenuItem>
        {REVISION_PASSES.map((p) => {
          const n = changes.filter((c) => c.pass === p.n).length;
          return (
            <MenuItem key={p.n} selected={pass === p.n} onClick={act(() => s().setRevisionPass(p.n))}>
              <ListItemIcon>{pass === p.n ? <CheckIcon fontSize="small" sx={{ color: passColor(p.n, theme.palette.mode) }} /> : <PassDot n={p.n} size={12} />}</ListItemIcon>
              <ListItemText>{p.name}</ListItemText>
              {n > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {n} here
                </Typography>
              )}
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem onClick={() => s().setRevisionView(view === 'markup' ? 'final' : 'markup')}>
          <ListItemText primary="Show changes" secondary={view === 'markup' ? 'Colours and struck-out text visible' : 'Final view: deletions hidden'} />
          <Switch edge="end" size="small" checked={view === 'markup'} tabIndex={-1} inputProps={{ 'aria-label': 'Show changes' }} />
        </MenuItem>
        <Divider />
        <ListSubheader sx={{ lineHeight: '32px' }}>
          {has ? `${changes.length} change${changes.length === 1 ? '' : 's'} in this document` : 'Open a document to review its changes'}
        </ListSubheader>
        <MenuItem disabled={!changes.length} onClick={act(() => editor!.chain().focus().goToRevision(-1).run())}>
          <ListItemIcon>
            <NavigateBeforeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Previous change</ListItemText>
          <Typography variant="caption" color="text.secondary">
            Ctrl+Alt+,
          </Typography>
        </MenuItem>
        <MenuItem disabled={!changes.length} onClick={act(() => editor!.chain().focus().goToRevision(1).run())}>
          <ListItemIcon>
            <NavigateNextIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Next change</ListItemText>
          <Typography variant="caption" color="text.secondary">
            Ctrl+Alt+.
          </Typography>
        </MenuItem>
        <MenuItem disabled={!changes.length} onClick={act(() => editor!.chain().focus().resolveRevisionAtSelection('accept').run())}>
          <ListItemIcon>
            <CheckIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Accept selection or change at cursor</ListItemText>
        </MenuItem>
        <MenuItem disabled={!changes.length} onClick={act(() => editor!.chain().focus().resolveRevisionAtSelection('reject').run())}>
          <ListItemIcon>
            <CloseIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reject selection or change at cursor</ListItemText>
        </MenuItem>
        <Divider />
        <Box sx={{ px: 2, py: 1 }} onKeyDown={(e) => e.stopPropagation()}>
          <TextField select size="small" fullWidth label="Accept / reject all for" value={scope} onChange={(e) => setScope(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <MenuItem value="all">Every revision pass</MenuItem>
            {REVISION_PASSES.map((p) => (
              <MenuItem key={p.n} value={p.n}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PassDot n={p.n} /> {p.name}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <MenuItem disabled={!scoped.length} onClick={act(() => editor!.chain().focus().resolveAllRevisions('accept', scopePass).run())}>
          <ListItemIcon>
            <DoneAllIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Accept all in this document</ListItemText>
        </MenuItem>
        <MenuItem disabled={!scoped.length} onClick={act(() => editor!.chain().focus().resolveAllRevisions('reject', scopePass).run())}>
          <ListItemIcon>
            <ClearAllIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reject all in this document</ListItemText>
        </MenuItem>
        <MenuItem onClick={act(() => void resolveInProject('accept', scopePass))}>
          <ListItemIcon>
            <FolderSpecialIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Accept all in the project…</ListItemText>
        </MenuItem>
        <MenuItem onClick={act(() => void resolveInProject('reject', scopePass))}>
          <ListItemIcon>
            <FolderSpecialIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reject all in the project…</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
