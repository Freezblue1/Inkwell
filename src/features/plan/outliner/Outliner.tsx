import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Box,
  Checkbox,
  IconButton,
  InputBase,
  LinearProgress,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumnOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TableRowsIcon from '@mui/icons-material/TableRowsOutlined';
import type { ID, InkDocument } from '@/types/models';
import { useStore } from '@/store';
import { nearestAncestorOfType, sceneSequence } from '@/lib/tree';
import { statusColor } from '@/lib/defaults';
import { EmptyState } from '@/components/EmptyState';

interface Column {
  key: string;
  label: string;
  width?: number;
  sortValue: (d: InkDocument, ctx: Ctx) => string | number;
}

interface Ctx {
  docs: Record<ID, InkDocument>;
  names: Map<ID, string>;
  labels: Map<ID, string>;
  order: Map<ID, number>;
}

const COLUMNS: Column[] = [
  { key: 'title', label: 'Title', width: 200, sortValue: (d) => d.title.toLowerCase() },
  { key: 'chapter', label: 'Chapter', width: 140, sortValue: (d, c) => nearestAncestorOfType(c.docs, d.id, 'chapter')?.title ?? '' },
  { key: 'synopsis', label: 'Synopsis', width: 320, sortValue: (d) => d.synopsis.toLowerCase() },
  { key: 'status', label: 'Status', width: 120, sortValue: (d) => d.status },
  { key: 'pov', label: 'POV', width: 140, sortValue: (d, c) => c.names.get(d.metadata.pov ?? '') ?? '' },
  { key: 'location', label: 'Location', width: 140, sortValue: (d, c) => c.names.get(d.metadata.locationId ?? '') ?? '' },
  { key: 'words', label: 'Words', width: 90, sortValue: (d) => d.wordCount },
  { key: 'target', label: 'Target', width: 110, sortValue: (d) => d.targetWordCount ?? 0 },
  { key: 'label', label: 'Label', width: 130, sortValue: (d, c) => c.labels.get(d.label ?? '') ?? '' },
  { key: 'date', label: 'Story date', width: 130, sortValue: (d) => d.metadata.timelineDate },
];

const ROW_H = 52;

/** Spreadsheet-like outline of all scenes with sortable, customizable columns and inline editing. */
export function Outliner() {
  const docs = useStore((s) => s.docs);
  const project = useStore((s) => s.project);
  const bible = useStore((s) => s.bible);
  const visible = useStore((s) => s.settings.outlinerColumns);
  const updateSettings = useStore((s) => s.updateSettings);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [colAnchor, setColAnchor] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ctx: Ctx = useMemo(
    () => ({
      docs,
      names: new Map(bible.map((b) => [b.id, b.name])),
      labels: new Map((project?.labels ?? []).map((l) => [l.id, l.name])),
      order: new Map(sceneSequence(docs).map((d, i) => [d.id, i])),
    }),
    [docs, bible, project?.labels],
  );

  const rows = useMemo(() => {
    const list = sceneSequence(docs);
    if (!sort) return list;
    const col = COLUMNS.find((c) => c.key === sort.key);
    if (!col) return list;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = col.sortValue(a, ctx);
      const vb = col.sortValue(b, ctx);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }, [docs, sort, ctx]);

  const cols = COLUMNS.filter((c) => visible.includes(c.key) || c.key === 'title');
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW_H, overscan: 10 });
  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;
  const totalWords = rows.reduce((n, d) => n + d.wordCount, 0);
  const totalTarget = rows.reduce((n, d) => n + (d.targetWordCount ?? 0), 0);

  if (!rows.length) {
    return <EmptyState icon={<TableRowsIcon />} title="No scenes to outline" description="Add scenes in the binder or corkboard; they appear here as rows." />;
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }} spacing={1}>
        <Typography variant="h5" component="h2" sx={{ flex: 1 }}>
          Outliner
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {rows.length} scenes · {totalWords.toLocaleString()} words{totalTarget ? ` of ${totalTarget.toLocaleString()} targeted` : ''}
        </Typography>
        <Tooltip title="Choose columns">
          <IconButton aria-label="Choose columns" onClick={(e) => setColAnchor(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={colAnchor} open={!!colAnchor} onClose={() => setColAnchor(null)}>
          {COLUMNS.filter((c) => c.key !== 'title').map((c) => (
            <MenuItem
              key={c.key}
              dense
              onClick={() => updateSettings({ outlinerColumns: visible.includes(c.key) ? visible.filter((k) => k !== c.key) : [...visible, c.key] })}
            >
              <Checkbox size="small" checked={visible.includes(c.key)} sx={{ p: 0.5, mr: 1 }} />
              <ListItemText>{c.label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </Stack>
      <Box ref={scrollRef} sx={{ flex: 1, minHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
        <Table stickyHeader size="small" aria-label="Scene outline" sx={{ minWidth: cols.reduce((n, c) => n + (c.width ?? 120), 48) }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              {cols.map((c) => (
                <TableCell key={c.key} sx={{ width: c.width, fontWeight: 600 }} sortDirection={sort?.key === c.key ? sort.dir : false}>
                  <TableSortLabel
                    active={sort?.key === c.key}
                    direction={sort?.key === c.key ? sort.dir : 'asc'}
                    onClick={() =>
                      setSort((s) => (s?.key !== c.key ? { key: c.key, dir: 'asc' } : s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null))
                    }
                  >
                    {c.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {padTop > 0 && (
              <TableRow sx={{ height: padTop }}>
                <TableCell colSpan={cols.length + 1} sx={{ p: 0, border: 0 }} />
              </TableRow>
            )}
            {items.map((vi) => {
              const d = rows[vi.index];
              return (
                <TableRow key={d.id} hover sx={{ height: ROW_H }}>
                  <TableCell sx={{ px: 0.5 }}>
                    <Tooltip title="Open in editor">
                      <IconButton size="small" aria-label={`Open ${d.title}`} onClick={() => useStore.getState().openDoc(d.id)}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  {cols.map((c) => (
                    <TableCell key={c.key} sx={{ verticalAlign: 'middle' }}>
                      <Cell col={c.key} doc={d} />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {padBottom > 0 && (
              <TableRow sx={{ height: padBottom }}>
                <TableCell colSpan={cols.length + 1} sx={{ p: 0, border: 0 }} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

/** Inline-editable outliner cell. */
function Cell({ col, doc }: { col: string; doc: InkDocument }) {
  const project = useStore((s) => s.project);
  const bible = useStore((s) => s.bible);
  const docs = useStore((s) => s.docs);
  const s = useStore.getState;

  switch (col) {
    case 'title':
      return <TextCell value={doc.title} label="Title" onCommit={(v) => v.trim() && s().updateDoc(doc.id, { title: v.trim() })} bold />;
    case 'chapter':
      return (
        <Typography variant="body2" color="text.secondary" noWrap>
          {nearestAncestorOfType(docs, doc.id, 'chapter')?.title ?? '—'}
        </Typography>
      );
    case 'synopsis':
      return <TextCell value={doc.synopsis} label="Synopsis" multiline placeholder="Add synopsis…" onCommit={(v) => s().updateDoc(doc.id, { synopsis: v })} />;
    case 'status':
      return (
        <Select
          variant="standard"
          disableUnderline
          value={doc.status || ''}
          displayEmpty
          onChange={(e) => void s().updateDoc(doc.id, { status: e.target.value })}
          inputProps={{ 'aria-label': `Status of ${doc.title}` }}
          sx={{ fontSize: 13 }}
          renderValue={(v) =>
            v ? (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusColor(v) }} />
                <span>{v}</span>
              </Stack>
            ) : (
              <em>—</em>
            )
          }
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {project?.statuses.map((st) => (
            <MenuItem key={st} value={st}>
              {st}
            </MenuItem>
          ))}
        </Select>
      );
    case 'pov':
    case 'location': {
      const kind = col === 'pov' ? 'character' : 'location';
      const key = col === 'pov' ? 'pov' : 'locationId';
      const value = (col === 'pov' ? doc.metadata.pov : doc.metadata.locationId) ?? '';
      return (
        <Select
          variant="standard"
          disableUnderline
          displayEmpty
          value={bible.some((b) => b.id === value) ? value : ''}
          onChange={(e) => void s().updateDocMeta(doc.id, { [key]: e.target.value || null })}
          inputProps={{ 'aria-label': `${col} of ${doc.title}` }}
          sx={{ fontSize: 13, maxWidth: 140 }}
        >
          <MenuItem value="">
            <em>—</em>
          </MenuItem>
          {bible
            .filter((b) => b.kind === kind)
            .map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.name}
              </MenuItem>
            ))}
        </Select>
      );
    }
    case 'words':
      return <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{doc.wordCount.toLocaleString()}</Typography>;
    case 'target': {
      const pct = doc.targetWordCount ? Math.min(100, (doc.wordCount / doc.targetWordCount) * 100) : null;
      return (
        <Box>
          <TextCell
            value={doc.targetWordCount ? String(doc.targetWordCount) : ''}
            label="Target"
            placeholder="—"
            numeric
            onCommit={(v) => {
              const n = parseInt(v, 10);
              void s().updateDoc(doc.id, { targetWordCount: n > 0 ? n : null });
            }}
          />
          {pct !== null && <LinearProgress variant="determinate" value={pct} color={pct >= 100 ? 'success' : 'secondary'} sx={{ height: 3 }} />}
        </Box>
      );
    }
    case 'label':
      return (
        <Select
          variant="standard"
          disableUnderline
          displayEmpty
          value={doc.label ?? ''}
          onChange={(e) => void s().updateDoc(doc.id, { label: e.target.value || null })}
          inputProps={{ 'aria-label': `Label of ${doc.title}` }}
          sx={{ fontSize: 13 }}
        >
          <MenuItem value="">
            <em>—</em>
          </MenuItem>
          {project?.labels.map((l) => (
            <MenuItem key={l.id} value={l.id}>
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: l.color, display: 'inline-block', mr: 1 }} />
              {l.name}
            </MenuItem>
          ))}
        </Select>
      );
    case 'date':
      return (
        <InputBase
          type="date"
          value={doc.metadata.timelineDate}
          onChange={(e) => void s().updateDocMeta(doc.id, { timelineDate: e.target.value })}
          inputProps={{ 'aria-label': `Story date of ${doc.title}` }}
          sx={{ fontSize: 13 }}
        />
      );
    default:
      return null;
  }
}

function TextCell({
  value,
  label,
  onCommit,
  multiline,
  placeholder,
  bold,
  numeric,
}: {
  value: string;
  label: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  bold?: boolean;
  numeric?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <InputBase
      value={v}
      fullWidth
      multiline={multiline}
      maxRows={2}
      placeholder={placeholder}
      onChange={(e) => setV(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        if (e.key === 'Escape') setV(value);
      }}
      inputProps={{ 'aria-label': label }}
      sx={{ fontSize: 13, fontWeight: bold ? 500 : 400 }}
    />
  );
}
