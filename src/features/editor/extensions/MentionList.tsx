import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Avatar, List, ListItemAvatar, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import type { BibleEntry } from '@/types/models';
import { BIBLE_KIND_LABELS } from '@/lib/bible';

export interface MentionListProps {
  items: BibleEntry[];
  command: (attrs: { id: string; label: string; kind: string }) => void;
}

export interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/** Autocomplete popup for @-mentions of story bible entries. */
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList({ items, command }, ref) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [items]);

  const select = (i: number) => {
    const item = items[i];
    if (item) command({ id: item.id, label: item.name, kind: item.kind });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (!items.length) return false;
      if (event.key === 'ArrowDown') {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        select(index);
        return true;
      }
      return false;
    },
  }));

  return (
    <Paper elevation={8} sx={{ minWidth: 240, maxWidth: 320, overflow: 'hidden' }}>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
          No matching characters, places or items. Add them in Plan → Story Bible.
        </Typography>
      ) : (
        <List dense role="listbox" aria-label="Mention suggestions">
          {items.map((item, i) => (
            <ListItemButton key={item.id} selected={i === index} onMouseDown={(e) => e.preventDefault()} onClick={() => select(i)} role="option" aria-selected={i === index}>
              <ListItemAvatar sx={{ minWidth: 40 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: item.color || 'primary.main' }}>{item.name.charAt(0)}</Avatar>
              </ListItemAvatar>
              <ListItemText primary={item.name} secondary={BIBLE_KIND_LABELS[item.kind].singular} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
});
