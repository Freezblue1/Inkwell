import { memo, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Chip, InputBase, LinearProgress, Tooltip, Typography } from '@mui/material';
import { specialLabel } from '@/lib/specialChapters';
import { alpha } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { FlatNode } from '@/lib/tree';
import type { Label } from '@/types/models';
import { StatusChip } from '@/components/StatusChip';
import { docIcon } from './docIcons';
import { INDENT } from './binderDnd';

export interface BinderRowProps {
  node: FlatNode;
  top: number;
  height: number;
  selected: boolean;
  focused: boolean;
  collapsed: boolean;
  renaming: boolean;
  total: number;
  label: Label | undefined;
  projectedDepth: number | null;
  showStatus: boolean;
  draggable: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onContextMenu: (id: string, e: MouseEvent) => void;
  onRename: (id: string, title: string | null) => void;
}

/** One binder tree row (sortable, virtualized via absolute `top`). */
export const BinderRow = memo(function BinderRow(p: BinderRowProps) {
  const { node, selected, focused, collapsed, renaming, total, label } = p;
  const doc = node.doc;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id, disabled: !p.draggable || renaming });
  const depth = p.projectedDepth ?? node.depth;
  const target = doc.targetWordCount;
  const pct = target ? Math.min(100, (total / target) * 100) : null;

  const style: CSSProperties = {
    position: 'absolute',
    top: p.top,
    left: 0,
    right: 0,
    height: p.height,
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 5 : undefined,
  };

  // dnd-kit's attributes include role="button"; we keep treeitem semantics instead.
  const { role: _role, tabIndex: _tab, ...dndAttrs } = attributes;
  void _role;
  void _tab;

  return (
    <div ref={setNodeRef} style={style}>
      <Box
        id={`binder-row-${node.id}`}
        role="treeitem"
        aria-level={node.depth + 1}
        aria-selected={selected}
        aria-expanded={node.hasChildren ? !collapsed : undefined}
        aria-label={`${doc.title}, ${doc.type}${total ? `, ${total} words` : ''}${doc.status ? `, ${doc.status}` : ''}`}
        {...dndAttrs}
        {...listeners}
        onClick={() => p.onOpen(node.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          p.onContextMenu(node.id, e);
        }}
        sx={(t) => ({
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pl: `${8 + depth * INDENT}px`,
          pr: 1,
          mx: 0.5,
          borderRadius: 1,
          cursor: 'pointer',
          position: 'relative',
          userSelect: 'none',
          opacity: isDragging ? 0.5 : 1,
          bgcolor: selected ? alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.24 : 0.12) : 'transparent',
          outline: focused ? `2px solid ${t.palette.primary.main}` : 'none',
          outlineOffset: -2,
          '&:hover': { bgcolor: selected ? undefined : 'action.hover' },
        })}
      >
        <Box
          component="span"
          onClick={(e) => {
            e.stopPropagation();
            if (node.hasChildren) p.onToggle(node.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-hidden
          sx={{ width: 20, height: 20, display: 'grid', placeItems: 'center', color: 'text.secondary', visibility: node.hasChildren ? 'visible' : 'hidden', borderRadius: 1, '&:hover': { bgcolor: 'action.selected' } }}
        >
          <ChevronRightIcon fontSize="small" sx={{ transform: collapsed ? 'none' : 'rotate(90deg)', transition: 'transform 120ms' }} />
        </Box>
        <Box component="span" sx={{ fontSize: 18, display: 'flex', color: doc.metadata.color || (doc.type === 'part' ? 'secondary.main' : 'text.secondary') }} aria-hidden>
          {docIcon(doc, node.hasChildren)}
        </Box>
        {renaming ? (
          <RenameField initial={doc.title} onDone={(v) => p.onRename(node.id, v)} />
        ) : (
          <Typography
            variant="body2"
            noWrap
            sx={{ flex: 1, minWidth: 0, fontWeight: doc.type === 'part' || doc.type === 'chapter' ? 500 : 400 }}
          >
            {doc.title || 'Untitled'}
          </Typography>
        )}
        {label && (
          <Tooltip title={label.name}>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: label.color, flex: '0 0 8px' }} aria-label={`Label: ${label.name}`} />
          </Tooltip>
        )}
        {doc.metadata.special ? (
          <Chip
            size="small"
            label={specialLabel(doc)}
            sx={{ height: 18, fontSize: 10, fontWeight: 600, maxWidth: 84, bgcolor: 'secondary.main', color: 'secondary.contrastText', '& .MuiChip-label': { px: 0.75 } }}
          />
        ) : (
          p.showStatus && doc.status && (doc.type === 'scene' || doc.type === 'chapter') && <StatusChip status={doc.status} sx={{ maxWidth: 72 }} />
        )}
        {total > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {total >= 10000 ? `${(total / 1000).toFixed(1)}k` : total.toLocaleString()}
          </Typography>
        )}
        {pct !== null && (
          <LinearProgress
            variant="determinate"
            value={pct}
            color={pct >= 100 ? 'success' : 'secondary'}
            aria-label={`${Math.round(pct)}% of target`}
            sx={{ position: 'absolute', left: `${32 + depth * INDENT}px`, right: 8, bottom: 2, height: 2 }}
          />
        )}
      </Box>
    </div>
  );
});

function RenameField({ initial, onDone }: { initial: string; onDone: (v: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.select();
  }, []);
  return (
    <InputBase
      inputRef={ref}
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') onDone(value);
        if (e.key === 'Escape') onDone(null);
      }}
      onBlur={() => onDone(value)}
      inputProps={{ 'aria-label': 'Rename' }}
      sx={{ flex: 1, fontSize: 14, px: 0.5, bgcolor: 'background.paper', borderRadius: 0.5, border: 1, borderColor: 'primary.main' }}
    />
  );
}
