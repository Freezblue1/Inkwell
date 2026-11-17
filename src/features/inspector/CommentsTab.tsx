import { useEffect, useRef, useState } from 'react';
import { Box, Card, CardActionArea, CardActions, CardContent, FormControlLabel, IconButton, InputBase, Stack, Switch, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ChatBubbleIcon from '@mui/icons-material/ChatBubbleOutline';
import type { ID, InkComment } from '@/types/models';
import { useStore } from '@/store';
import { relativeTime } from '@/lib/dates';
import { useDebouncedCallback } from '@/hooks/useDebounced';
import { EmptyState } from '@/components/EmptyState';
import { revealComment } from '@/features/editor/editorActions';

/** Comments for the document: edit, resolve/reopen, jump to text, delete. */
export function CommentsTab({ docId }: { docId: ID }) {
  const comments = useStore((s) => s.comments);
  const focusId = useStore((s) => s.focusCommentId);
  const [showResolved, setShowResolved] = useState(false);
  const list = comments
    .filter((c) => c.docId === docId && (showResolved || !c.resolved))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || a.createdAt - b.createdAt);
  const resolvedCount = comments.filter((c) => c.docId === docId && c.resolved).length;

  return (
    <Stack spacing={1.5}>
      <FormControlLabel control={<Switch size="small" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />} label={`Show resolved (${resolvedCount})`} />
      {list.length === 0 ? (
        <EmptyState compact icon={<ChatBubbleIcon />} title="No comments" description="Select text and press Ctrl+Alt+M (or the comment button) to leave yourself a note." />
      ) : (
        list.map((c) => <CommentCard key={c.id} comment={c} focused={focusId === c.id} />)
      )}
    </Stack>
  );
}

function CommentCard({ comment, focused }: { comment: InkComment; focused: boolean }) {
  const [text, setText] = useState(comment.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const save = useDebouncedCallback((v: string) => void useStore.getState().updateComment(comment.id, { text: v }), 400);

  useEffect(() => {
    if (focused) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: 'nearest' });
      useStore.getState().setFocusComment(null);
    }
  }, [focused]);

  const s = useStore.getState;
  const jump = () => {
    const ed = s().activeEditor;
    if (ed && s().activeEditorDocId === comment.docId) revealComment(ed, comment.id);
    else {
      s().openDoc(comment.docId);
      setTimeout(() => {
        const e2 = s().activeEditor;
        if (e2) revealComment(e2, comment.id);
      }, 400);
    }
  };

  const remove = () => {
    const ed = s().activeEditor;
    if (ed && s().activeEditorDocId === comment.docId) ed.commands.removeCommentById(comment.id);
    void s().deleteComment(comment.id);
  };

  return (
    <Card sx={{ opacity: comment.resolved ? 0.6 : 1, borderLeft: 3, borderLeftColor: comment.resolved ? 'success.main' : 'secondary.main' }}>
      <CardActionArea onClick={jump} sx={{ px: 1.5, pt: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          “{comment.quote}”
        </Typography>
      </CardActionArea>
      <CardContent sx={{ py: 1, px: 1.5 }}>
        <InputBase
          inputRef={inputRef}
          multiline
          fullWidth
          placeholder="Write a comment…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            save(e.target.value);
          }}
          onBlur={() => save.flush()}
          inputProps={{ 'aria-label': 'Comment text' }}
          sx={{ fontSize: 14 }}
        />
      </CardContent>
      <CardActions sx={{ px: 1, pt: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, pl: 0.5 }}>
          {relativeTime(comment.createdAt)}
        </Typography>
        <Box>
          <Tooltip title={comment.resolved ? 'Reopen' : 'Resolve'}>
            <IconButton size="small" aria-label={comment.resolved ? 'Reopen comment' : 'Resolve comment'} onClick={() => void s().updateComment(comment.id, { resolved: !comment.resolved })}>
              {comment.resolved ? <ReplayIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete comment">
            <IconButton size="small" aria-label="Delete comment" onClick={remove}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </CardActions>
    </Card>
  );
}
