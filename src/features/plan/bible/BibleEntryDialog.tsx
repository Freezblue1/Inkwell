import { useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import type { BibleEntry, Character, Relationship } from '@/types/models';
import { useStore } from '@/store';
import { BIBLE_FIELDS, BIBLE_KIND_LABELS } from '@/lib/bible';
import { addAsset, deleteAsset } from '@/db/repos/assets';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { confirmDialog } from '@/components/DialogHost';
import { DOC_COLORS } from '@/features/binder/docIcons';
import { sceneSequence } from '@/lib/tree';

/** Editor for one story bible entry (global dialog). */
export default function BibleEntryDialog() {
  const id = useStore((s) => s.bibleEditId);
  const stored = useStore((s) => s.bible.find((b) => b.id === id));
  const bible = useStore((s) => s.bible);
  const project = useStore((s) => s.project);
  const docs = useStore((s) => s.docs);
  const close = () => useStore.getState().openBibleEntry(null);
  const [draft, setDraft] = useState<BibleEntry | null>(stored ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const img = useAssetUrl(draft?.imageAssetId);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const storedId = stored?.id;

  // Reset the draft only when a different entry is opened.
  useEffect(() => {
    dirty.current = false;
    setDraft(useStore.getState().bible.find((b) => b.id === storedId) ?? null);
  }, [storedId]);

  // Autosave edits shortly after typing stops (only when the user changed something).
  useEffect(() => {
    if (!draft || !dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dirty.current = false;
      void useStore.getState().saveBibleEntry(draft);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft]);

  if (!id) return null;
  if (!stored || !draft) {
    return (
      <Dialog open onClose={close}>
        <DialogTitle>Entry not found</DialogTitle>
        <DialogContent>
          <Typography>This bible entry no longer exists.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  const set = (patch: Record<string, unknown>) => {
    dirty.current = true;
    setDraft((d) => (d ? ({ ...d, ...patch } as BibleEntry) : d));
  };
  const flushAndClose = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (dirty.current) {
      dirty.current = false;
      void useStore.getState().saveBibleEntry(draft);
    }
    close();
  };

  const others = bible.filter((b) => b.id !== draft.id);
  const appearances = sceneSequence(docs).filter(
    (d) => d.metadata.linkedIds.includes(draft.id) || d.metadata.mentionIds.includes(draft.id) || d.metadata.pov === draft.id || d.metadata.locationId === draft.id,
  );

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return useStore.getState().notify('Please choose an image file.', 'warning');
    try {
      const asset = await addAsset(project!.id, file);
      if (draft.imageAssetId) await deleteAsset(draft.imageAssetId);
      set({ imageAssetId: asset.id });
    } catch (e) {
      useStore.getState().notify(e instanceof Error ? e.message : 'Upload failed', 'error');
    }
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: `Delete “${draft.name}”?`, message: 'Links and mentions to it will show as missing.', confirmLabel: 'Delete', danger: true }))) return;
    if (draft.imageAssetId) await deleteAsset(draft.imageAssetId);
    await useStore.getState().deleteBibleEntry(draft.id);
    close();
  };

  return (
    <Dialog open onClose={flushAndClose} maxWidth="md" fullWidth fullScreen={fullScreen} aria-labelledby="bible-title">
      <DialogTitle id="bible-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline" color="text.secondary" display="block">
            {BIBLE_KIND_LABELS[draft.kind].singular}
          </Typography>
          <TextField
            variant="standard"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            inputProps={{ 'aria-label': 'Name', style: { fontSize: 24 } }}
            fullWidth
          />
        </Box>
        <IconButton aria-label="Close" onClick={flushAndClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: 3 }}>
          <Stack spacing={2}>
            <Box
              sx={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden', display: 'grid', placeItems: 'center', bgcolor: draft.color || 'action.hover', cursor: 'pointer', position: 'relative' }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label={img ? 'Change image' : 'Upload image'}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
            >
              {img ? <Box component="img" src={img} alt={draft.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <AddPhotoAlternateIcon sx={{ fontSize: 48, opacity: 0.6 }} />}
            </Box>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
                e.target.value = '';
              }}
            />
            {img && (
              <Button size="small" color="inherit" onClick={() => draft.imageAssetId && void deleteAsset(draft.imageAssetId).then(() => set({ imageAssetId: null }))}>
                Remove image
              </Button>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Color
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {DOC_COLORS.map((c) => (
                  <Box
                    key={c}
                    component="button"
                    aria-label={`Color ${c}`}
                    onClick={() => set({ color: c })}
                    sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: c, border: 2, borderColor: draft.color === c ? 'text.primary' : 'transparent', cursor: 'pointer', p: 0 }}
                  />
                ))}
              </Stack>
            </Box>
            {project?.seriesId && (
              <FormControlLabel
                control={<Switch checked={!!draft.seriesId} onChange={(e) => set({ seriesId: e.target.checked ? project.seriesId : null })} />}
                label="Share with series"
              />
            )}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Appears in
              </Typography>
              {appearances.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Not linked to any scene yet.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {appearances.slice(0, 12).map((d) => (
                    <ListItemButton
                      key={d.id}
                      onClick={() => {
                        flushAndClose();
                        useStore.getState().openDoc(d.id);
                      }}
                      sx={{ px: 1 }}
                    >
                      <ListItemText primary={d.title} primaryTypographyProps={{ noWrap: true, fontSize: 13 }} />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>
          </Stack>

          <Stack spacing={2}>
            {BIBLE_FIELDS[draft.kind].map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                placeholder={f.placeholder}
                value={String((draft as unknown as Record<string, unknown>)[f.key] ?? '')}
                onChange={(e) => set({ [f.key]: e.target.value })}
                multiline={f.multiline}
                minRows={f.multiline ? 2 : undefined}
                fullWidth
              />
            ))}

            {draft.kind === 'character' && (
              <RelationshipsEditor
                value={(draft as Character).relationships}
                options={others.filter((o) => o.kind === 'character')}
                onChange={(relationships) => set({ relationships })}
              />
            )}

            <Autocomplete
              multiple
              options={others}
              groupBy={(o) => BIBLE_KIND_LABELS[o.kind].plural}
              getOptionLabel={(o) => o.name}
              value={others.filter((o) => draft.linkedIds.includes(o.id))}
              onChange={(_, v) => set({ linkedIds: v.map((x) => x.id) })}
              renderTags={(value, getTagProps) =>
                value.map((o, index) => (
                  <Chip size="small" label={o.name} {...getTagProps({ index })} key={o.id} onClick={() => useStore.getState().openBibleEntry(o.id)} />
                ))
              }
              renderInput={(p) => <TextField {...p} label="Cross-links" placeholder="Related entries" />}
            />
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={draft.tags}
              onChange={(_, v) => set({ tags: v })}
              renderTags={(value, getTagProps) => value.map((o, index) => <Chip size="small" label={o} {...getTagProps({ index })} key={o} />)}
              renderInput={(p) => <TextField {...p} label="Tags" placeholder="Type and press Enter" />}
            />
            <TextField label="Notes" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} multiline minRows={3} fullWidth />
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="error" startIcon={<DeleteIcon />} onClick={() => void remove()}>
          Delete
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Changes save automatically
        </Typography>
        <Button variant="contained" onClick={flushAndClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RelationshipsEditor({ value, options, onChange }: { value: Relationship[]; options: BibleEntry[]; onChange: (v: Relationship[]) => void }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Relationships
        </Typography>
        <Tooltip title="Add relationship">
          <span>
            <IconButton size="small" aria-label="Add relationship" disabled={!options.length} onClick={() => onChange([...value, { targetId: options[0].id, type: '' }])}>
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {value.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {options.length ? 'Add how this character relates to others — it feeds the relationship map.' : 'Create more characters to add relationships.'}
        </Typography>
      )}
      <Stack spacing={1}>
        {value.map((r, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              placeholder="e.g. Sister of, Rival, Mentor"
              value={r.type}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
              sx={{ flex: 1 }}
              inputProps={{ 'aria-label': 'Relationship' }}
            />
            <Autocomplete
              size="small"
              options={options}
              getOptionLabel={(o) => o.name}
              value={options.find((o) => o.id === r.targetId) ?? null}
              onChange={(_, v) => v && onChange(value.map((x, j) => (j === i ? { ...x, targetId: v.id } : x)))}
              renderInput={(p) => <TextField {...p} placeholder="Character" />}
              sx={{ flex: 1 }}
            />
            <IconButton size="small" aria-label="Remove relationship" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
