import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useStore } from '@/store';

/** Edits (or removes) the footnote at a position in the active editor. */
export default function FootnoteDialog() {
  const edit = useStore((s) => s.footnoteEdit);
  const editor = useStore((s) => s.activeEditor);
  const setEdit = useStore((s) => s.setFootnoteEdit);
  const [text, setText] = useState(edit?.text ?? '');
  if (!edit) return null;

  const close = () => {
    setEdit(null);
    editor?.commands.focus();
  };
  const save = () => {
    if (editor && !editor.isDestroyed) {
      if (text.trim()) editor.commands.updateFootnote(edit.pos, text.trim());
      else editor.commands.removeFootnote(edit.pos);
    }
    close();
  };

  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth aria-labelledby="footnote-title">
      <DialogTitle id="footnote-title">Footnote</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          margin="dense"
          label="Footnote text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
          }}
          helperText="Footnotes are numbered automatically and exported as notes. Ctrl+Enter to save."
        />
      </DialogContent>
      <DialogActions>
        <Button
          color="error"
          onClick={() => {
            editor?.commands.removeFootnote(edit.pos);
            close();
          }}
        >
          Delete footnote
        </Button>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
