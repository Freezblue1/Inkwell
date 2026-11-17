/**
 * Promise-based confirm and prompt dialogs:
 *   if (await confirmDialog({ title: 'Delete?' })) …
 *   const name = await promptDialog({ title: 'Rename', initial: 'Old' });
 */
import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { create } from 'zustand';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  label?: string;
  initial?: string;
  confirmLabel?: string;
  multiline?: boolean;
}

type Request =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

const useDialogQueue = create<{ current: Request | null; push: (r: Request) => void; done: () => void }>((set) => ({
  current: null,
  push: (r) => set({ current: r }),
  done: () => set({ current: null }),
}));

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => useDialogQueue.getState().push({ kind: 'confirm', opts, resolve }));
}

export function promptDialog(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => useDialogQueue.getState().push({ kind: 'prompt', opts, resolve }));
}

export function DialogHost() {
  const { current, done } = useDialogQueue();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (current?.kind === 'prompt') setValue(current.opts.initial ?? '');
  }, [current]);

  if (!current) return null;

  const close = (ok: boolean) => {
    if (current.kind === 'confirm') current.resolve(ok);
    else current.resolve(ok ? value : null);
    done();
  };

  return (
    <Dialog open onClose={() => close(false)} maxWidth="xs" fullWidth aria-labelledby="dialog-host-title">
      <DialogTitle id="dialog-host-title">{current.opts.title}</DialogTitle>
      <DialogContent>
        {current.kind === 'confirm' && current.opts.message && <DialogContentText>{current.opts.message}</DialogContentText>}
        {current.kind === 'prompt' && (
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={current.opts.label}
            value={value}
            multiline={current.opts.multiline}
            minRows={current.opts.multiline ? 3 : undefined}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !current.opts.multiline) {
                e.preventDefault();
                close(true);
              }
            }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => close(false)}>Cancel</Button>
        <Button
          variant="contained"
          color={current.kind === 'confirm' && current.opts.danger ? 'error' : 'primary'}
          onClick={() => close(true)}
          autoFocus={current.kind === 'confirm'}
        >
          {current.opts.confirmLabel ?? (current.kind === 'confirm' ? 'Confirm' : 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
