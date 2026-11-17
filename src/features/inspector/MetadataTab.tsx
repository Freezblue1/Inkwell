import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, Chip, Divider, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import type { CustomFieldDef, ID, SpecialChapter } from '@/types/models';
import { SPECIAL_CHAPTERS } from '@/lib/specialChapters';
import { useStore } from '@/store';
import { statusColor } from '@/lib/defaults';
import { newId } from '@/lib/ids';
import { formatDateTime } from '@/lib/dates';
import { promptDialog } from '@/components/DialogHost';
import { useDebouncedCallback } from '@/hooks/useDebounced';

/** Status, label, POV, location, timeline, tags, target and custom fields. */
export function MetadataTab({ docId }: { docId: ID }) {
  const doc = useStore((s) => s.docs[docId]);
  const project = useStore((s) => s.project);
  const bible = useStore((s) => s.bible);
  const allDocs = useStore((s) => s.docs);
  const updateDoc = useStore((s) => s.updateDoc);
  const updateMeta = useStore((s) => s.updateDocMeta);
  const updateProject = useStore((s) => s.updateProject);
  const [target, setTarget] = useState(doc?.targetWordCount ? String(doc.targetWordCount) : '');
  useEffect(() => setTarget(doc?.targetWordCount ? String(doc.targetWordCount) : ''), [doc?.targetWordCount]);
  const saveCustom = useDebouncedCallback((fieldId: string, value: string) => {
    const d = useStore.getState().docs[docId];
    if (d) void updateMeta(docId, { custom: { ...d.metadata.custom, [fieldId]: value } });
  }, 400);

  if (!doc || !project) return null;
  const characters = bible.filter((b) => b.kind === 'character');
  const locations = bible.filter((b) => b.kind === 'location');
  const allTags = [...new Set(Object.values(allDocs).flatMap((d) => d.metadata.tags))].sort();

  const addCustomField = async () => {
    const name = await promptDialog({ title: 'New custom field', label: 'Field name (e.g. Weather, Subplot, Draft #)' });
    if (!name?.trim()) return;
    const field: CustomFieldDef = { id: newId(), name: name.trim(), type: 'text' };
    await updateProject({ customFields: [...project.customFields, field] });
  };

  return (
    <Stack spacing={2}>
      {doc.type === 'chapter' && (
        <Stack direction="row" spacing={1}>
          <TextField
            select
            fullWidth
            label="Chapter type"
            value={doc.metadata.special ?? '__numbered'}
            onChange={(e) => {
              const v = e.target.value;
              void useStore.getState().setSpecialChapter(docId, v === '__numbered' ? null : (v as SpecialChapter), doc.metadata.specialLabel || 'Coda');
            }}
            helperText={doc.metadata.special ? 'Unnumbered — compiled under its own heading' : 'Numbered automatically when you compile'}
          >
            <MenuItem value="__numbered">Numbered chapter</MenuItem>
            {SPECIAL_CHAPTERS.map((sc) => (
              <MenuItem key={sc.value} value={sc.value}>
                {sc.value === 'custom' ? 'Custom heading' : sc.label}
              </MenuItem>
            ))}
          </TextField>
          {doc.metadata.special === 'custom' && (
            <TextField
              label="Heading"
              defaultValue={doc.metadata.specialLabel}
              onBlur={(e) => e.target.value.trim() && void useStore.getState().setSpecialChapter(docId, 'custom', e.target.value)}
              sx={{ width: 140 }}
            />
          )}
        </Stack>
      )}
      <TextField
        select
        label="Status"
        value={doc.status || '__none'}
        onChange={async (e) => {
          const v = e.target.value;
          if (v === '__custom') {
            const name = await promptDialog({ title: 'Custom status', label: 'Status name' });
            if (!name?.trim()) return;
            if (!project.statuses.includes(name.trim())) await updateProject({ statuses: [...project.statuses, name.trim()] });
            await updateDoc(docId, { status: name.trim() });
          } else await updateDoc(docId, { status: v === '__none' ? '' : v });
        }}
      >
        <MenuItem value="__none">
          <em>No status</em>
        </MenuItem>
        {project.statuses.map((s) => (
          <MenuItem key={s} value={s}>
            <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: statusColor(s), display: 'inline-block', mr: 1 }} />
            {s}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem value="__custom">Add custom status…</MenuItem>
      </TextField>

      <TextField select label="Label" value={doc.label ?? '__none'} onChange={(e) => void updateDoc(docId, { label: e.target.value === '__none' ? null : e.target.value })}>
        <MenuItem value="__none">
          <em>No label</em>
        </MenuItem>
        {project.labels.map((l) => (
          <MenuItem key={l.id} value={l.id}>
            <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.color, display: 'inline-block', mr: 1 }} />
            {l.name}
          </MenuItem>
        ))}
      </TextField>

      <Autocomplete
        options={characters}
        getOptionLabel={(o) => o.name}
        value={characters.find((c) => c.id === doc.metadata.pov) ?? null}
        onChange={(_, v) => void updateMeta(docId, { pov: v?.id ?? null })}
        renderInput={(p) => <TextField {...p} label="Point of view" placeholder="Character" />}
        noOptionsText="Add characters in Plan → Story Bible"
      />

      <Autocomplete
        options={locations}
        getOptionLabel={(o) => o.name}
        value={locations.find((c) => c.id === doc.metadata.locationId) ?? null}
        onChange={(_, v) => void updateMeta(docId, { locationId: v?.id ?? null })}
        renderInput={(p) => <TextField {...p} label="Location" />}
        noOptionsText="Add locations in Plan → Story Bible"
      />

      <Stack direction="row" spacing={1}>
        <TextField
          label="Story date"
          type="date"
          value={doc.metadata.timelineDate}
          onChange={(e) => void updateMeta(docId, { timelineDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
        <TextField
          label="Time"
          type="time"
          value={doc.metadata.timelineTime}
          onChange={(e) => void updateMeta(docId, { timelineTime: e.target.value })}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 130 }}
        />
      </Stack>

      <Autocomplete
        multiple
        freeSolo
        options={allTags}
        value={doc.metadata.tags}
        onChange={(_, v) => void updateMeta(docId, { tags: [...new Set(v.map((t) => t.trim()).filter(Boolean))] })}
        renderTags={(value, getTagProps) => value.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} key={option} />)}
        renderInput={(p) => <TextField {...p} label="Tags / keywords" placeholder="Type and press Enter" />}
      />

      <TextField
        label="Word target"
        value={target}
        inputMode="numeric"
        onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))}
        onBlur={() => {
          const n = parseInt(target, 10);
          void updateDoc(docId, { targetWordCount: n > 0 ? n : null });
        }}
        helperText="Shows a progress bar in the binder"
      />

      <Divider />
      <Stack direction="row" alignItems="center">
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Custom fields
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => void addCustomField()}>
          Field
        </Button>
      </Stack>
      {project.customFields.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Add project-wide fields such as “Weather” or “Subplot”.
        </Typography>
      )}
      {project.customFields.map((f) => (
        <Stack key={f.id} direction="row" spacing={1} alignItems="center">
          <TextField
            label={f.name}
            fullWidth
            defaultValue={doc.metadata.custom[f.id] ?? ''}
            onChange={(e) => saveCustom(f.id, e.target.value)}
            onBlur={() => saveCustom.flush()}
          />
          <IconButton
            size="small"
            aria-label={`Remove field ${f.name}`}
            onClick={() => void updateProject({ customFields: project.customFields.filter((x) => x.id !== f.id) })}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Created {formatDateTime(doc.createdAt)} · Modified {formatDateTime(doc.updatedAt)}
      </Typography>
    </Stack>
  );
}
