import { useMemo } from 'react';
import { Autocomplete, Avatar, Chip, IconButton, List, ListItem, ListItemAvatar, ListItemButton, ListItemText, Stack, TextField, Tooltip, Typography } from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { BIBLE_KIND_LABELS } from '@/lib/bible';
import { EmptyState } from '@/components/EmptyState';

interface LinkOption {
  id: ID;
  name: string;
  group: string;
  color?: string;
  isDoc: boolean;
}

/** Linked characters, places, items, lore and notes (manual links + @-mentions). */
export function LinksTab({ docId }: { docId: ID }) {
  const doc = useStore((s) => s.docs[docId]);
  const bible = useStore((s) => s.bible);
  const docs = useStore((s) => s.docs);
  const updateMeta = useStore((s) => s.updateDocMeta);

  const options: LinkOption[] = useMemo(
    () => [
      ...bible.map((b) => ({ id: b.id, name: b.name, group: BIBLE_KIND_LABELS[b.kind].plural, color: b.color, isDoc: false })),
      ...Object.values(docs)
        .filter((d) => !d.trashed && (d.type === 'note' || d.type === 'research') && d.id !== docId)
        .map((d) => ({ id: d.id, name: d.title, group: d.type === 'note' ? 'Notes' : 'Research', isDoc: true })),
    ],
    [bible, docs, docId],
  );
  if (!doc) return null;

  const manual = new Set(doc.metadata.linkedIds);
  const mentioned = new Set(doc.metadata.mentionIds);
  const linkedIds = [...new Set([...manual, ...mentioned])];
  const linked = linkedIds.map((id) => options.find((o) => o.id === id)).filter((o): o is LinkOption => !!o);

  const open = (o: LinkOption) => {
    if (o.isDoc) useStore.getState().openDoc(o.id, { target: 'split' });
    else useStore.getState().openBibleEntry(o.id);
  };

  return (
    <Stack spacing={2}>
      <Autocomplete
        options={options.filter((o) => !manual.has(o.id))}
        groupBy={(o) => o.group}
        getOptionLabel={(o) => o.name}
        value={null}
        blurOnSelect
        onChange={(_, v) => v && void updateMeta(docId, { linkedIds: [...doc.metadata.linkedIds, v.id] })}
        renderInput={(p) => <TextField {...p} label="Link a character, place, item or note" />}
        noOptionsText="Nothing to link yet — create entries in Plan → Story Bible."
      />
      {linked.length === 0 ? (
        <EmptyState compact title="No links" description="Links connect this document to characters, locations and notes. They power the plot grid and help you find scenes later." />
      ) : (
        <List dense disablePadding aria-label="Linked items">
          {linked.map((o) => (
            <ListItem
              key={o.id}
              disablePadding
              secondaryAction={
                manual.has(o.id) ? (
                  <Tooltip title="Remove link">
                    <IconButton edge="end" size="small" aria-label={`Unlink ${o.name}`} onClick={() => void updateMeta(docId, { linkedIds: doc.metadata.linkedIds.filter((x) => x !== o.id) })}>
                      <LinkOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : undefined
              }
            >
              <ListItemButton onClick={() => open(o)}>
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: o.color || 'primary.main' }}>{o.isDoc ? <StickyNote2Icon fontSize="small" /> : o.name.charAt(0)}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={o.name}
                  secondary={
                    <Stack direction="row" spacing={0.5} component="span">
                      <span>{o.group}</span>
                      {mentioned.has(o.id) && <Chip component="span" size="small" label="@ mentioned" sx={{ height: 16, fontSize: 10 }} />}
                    </Stack>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
      <Typography variant="caption" color="text.secondary">
        Click a link to open it. Notes open in the split editor.
      </Typography>
    </Stack>
  );
}
