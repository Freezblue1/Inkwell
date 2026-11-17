/** Small Accept / Reject bubble shown when you click into a tracked change. */
import { BubbleMenu, useEditorState, type Editor } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import { Button, Paper, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { changeAt } from './resolve';
import { passInfo } from './passes';
import { PassDot } from './RevisionMenu';
import { useStore } from '@/store';

const bubbleKey = new PluginKey('revisionBubble');

export function RevisionBubble({ editor }: { editor: Editor }) {
  const info = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = e.state.selection;
      const c = s.empty ? changeAt(e.state.doc, s.from) : null;
      return c ? `${c.kind}:${c.pass}` : '';
    },
  });
  const change = info ? { kind: info.split(':')[0], pass: Number(info.split(':')[1]) } : null;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={bubbleKey}
      tippyOptions={{ duration: 120, placement: 'top', maxWidth: 'none' }}
      shouldShow={({ state, oldState }) => {
        if (useStore.getState().revisionView === 'final' || !state.selection.empty) return false;
        // Not while typing: only after moving the cursor into a change.
        if (oldState && !oldState.doc.eq(state.doc)) return false;
        const c = changeAt(state.doc, state.selection.from);
        return !!c && state.selection.from > c.from && state.selection.from < c.to;
      }}
    >
      <Paper elevation={6} role="toolbar" aria-label="Tracked change" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 1.25, pr: 0.5, py: 0.25, borderRadius: 3 }}>
        {change && (
          <>
            <PassDot n={change.pass} />
            <Typography variant="caption" sx={{ whiteSpace: 'nowrap', mr: 0.5 }}>
              {change.kind === 'insert' ? 'Added' : 'Deleted'} · {passInfo(change.pass).name}
            </Typography>
          </>
        )}
        <Button size="small" startIcon={<CheckIcon fontSize="small" />} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().resolveRevisionAtSelection('accept').run()}>
          Accept
        </Button>
        <Button size="small" color="inherit" startIcon={<CloseIcon fontSize="small" />} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().resolveRevisionAtSelection('reject').run()}>
          Reject
        </Button>
      </Paper>
    </BubbleMenu>
  );
}
