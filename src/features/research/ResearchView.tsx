import { useRef, useState } from 'react';
import { Box, Button, Collapse, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolderOutlined';
import NoteAddIcon from '@mui/icons-material/NoteAddOutlined';
import AddLinkIcon from '@mui/icons-material/AddLink';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScienceIcon from '@mui/icons-material/ScienceOutlined';
import type { ID, InkDocument, ResearchKind } from '@/types/models';
import { useStore } from '@/store';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { childrenOf, groupRoots, descendantIds } from '@/lib/tree';
import { addAsset, deleteAsset } from '@/db/repos/assets';
import { confirmDialog, promptDialog } from '@/components/DialogHost';
import { EmptyState } from '@/components/EmptyState';
import { docIcon } from '@/features/binder/docIcons';
import { ResearchViewer } from './ResearchViewer';

/** Research binder: folders, notes, web links, images and PDFs (stored locally). */
export default function ResearchView() {
  const layout = useLayoutMode();
  const docs = useStore((s) => s.docs);
  const selected = useStore((s) => s.researchDocId);
  const setSelected = useStore((s) => s.setResearchDoc);
  const [menu, setMenu] = useState<{ el: HTMLElement; id: ID } | null>(null);
  const [open, setOpen] = useState<Record<ID, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const roots = groupRoots(docs, 'research');
  const sel = selected && docs[selected] && !docs[selected].trashed ? docs[selected] : null;

  const targetParent = (): ID | null => {
    if (!sel) return null;
    if (sel.metadata.researchKind === 'folder') return sel.id;
    return sel.parentId;
  };

  const create = async (kind: ResearchKind, title?: string, extra: Partial<InkDocument['metadata']> = {}) => {
    const s = useStore.getState();
    const parentId = targetParent();
    const defaults: Record<ResearchKind, string> = { folder: 'New folder', note: 'Research note', link: 'Web link', image: 'Image', pdf: 'PDF' };
    const d = await s.createDoc({ type: 'research', parentId, title: title ?? defaults[kind], metadata: { researchKind: kind, ...extra } });
    if (parentId) setOpen((o) => ({ ...o, [parentId]: true }));
    setSelected(d.id);
    return d;
  };

  const addLink = async () => {
    const url = await promptDialog({ title: 'Add web link', label: 'URL', initial: 'https://' });
    if (!url || url === 'https://') return;
    let title = url;
    try {
      title = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      /* keep raw */
    }
    await create('link', title, { url });
  };

  const upload = async (files: FileList) => {
    const s = useStore.getState();
    for (const f of Array.from(files)) {
      const kind: ResearchKind | null = f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' ? 'pdf' : null;
      if (!kind) {
        s.notify(`“${f.name}” is not an image or PDF.`, 'warning');
        continue;
      }
      try {
        const asset = await addAsset(s.project!.id, f);
        await create(kind, f.name.replace(/\.[^.]+$/, ''), { assetId: asset.id });
      } catch (e) {
        s.notify(e instanceof Error ? e.message : 'Upload failed', 'error');
      }
    }
  };

  const remove = async (id: ID) => {
    const s = useStore.getState();
    const d = s.docs[id];
    if (!d) return;
    const ids = [id, ...descendantIds(s.docs, id)];
    if (!(await confirmDialog({ title: `Delete “${d.title}”?`, message: ids.length > 1 ? `This also deletes ${ids.length - 1} item(s) inside it, including stored files.` : 'Stored files are removed from this browser.', confirmLabel: 'Delete', danger: true }))) return;
    for (const i of ids) {
      const a = s.docs[i]?.metadata.assetId;
      if (a) await deleteAsset(a);
    }
    await s.deleteDocForever(id);
    if (selected && ids.includes(selected)) setSelected(null);
  };

  const renderItems = (items: InkDocument[], depth: number) =>
    items.map((d) => {
      const kids = childrenOf(docs, d.id);
      const isFolder = d.metadata.researchKind === 'folder';
      return (
        <Box key={d.id}>
          <ListItemButton
            selected={sel?.id === d.id}
            onClick={() => {
              setSelected(d.id);
              if (isFolder) setOpen((o) => ({ ...o, [d.id]: !o[d.id] }));
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ el: e.currentTarget, id: d.id });
            }}
            sx={{ pl: 1 + depth * 2, py: 0.25 }}
          >
            <ListItemIcon sx={{ minWidth: 30, fontSize: 18 }}>{docIcon(d, kids.length > 0)}</ListItemIcon>
            <ListItemText primary={d.title} primaryTypographyProps={{ noWrap: true, fontSize: 14 }} />
            {isFolder && <ExpandMoreIcon fontSize="small" sx={{ transform: open[d.id] ? 'none' : 'rotate(-90deg)', color: 'text.secondary' }} />}
          </ListItemButton>
          {isFolder && (
            <Collapse in={!!open[d.id]} unmountOnExit>
              {renderItems(kids, depth + 1)}
            </Collapse>
          )}
        </Box>
      );
    });

  const toolbar = (
    <Stack direction="row" spacing={0.5} sx={{ px: 1, py: 1 }}>
      <Tooltip title="New folder">
        <IconButton size="small" aria-label="New folder" onClick={() => void create('folder')}>
          <CreateNewFolderIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="New note">
        <IconButton size="small" aria-label="New research note" onClick={() => void create('note')}>
          <NoteAddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Add web link">
        <IconButton size="small" aria-label="Add web link" onClick={() => void addLink()}>
          <AddLinkIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Upload images or PDFs">
        <IconButton size="small" aria-label="Upload files" onClick={() => fileRef.current?.click()}>
          <UploadFileIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
          e.target.value = '';
        }}
      />
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: layout === 'mobile' ? 'column' : 'row', height: '100%', minHeight: 0 }}>
      <Box
        component="aside"
        aria-label="Research items"
        sx={{ width: layout === 'mobile' ? '100%' : 300, maxHeight: layout === 'mobile' ? '40%' : 'none', flexShrink: 0, borderRight: layout === 'mobile' ? 0 : 1, borderBottom: layout === 'mobile' ? 1 : 0, borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
      >
        <Box sx={{ px: 2, pt: 1.5 }}>
          <Typography variant="subtitle2" component="h2">
            Research
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Drop images or PDFs here. Stored in this browser.
          </Typography>
        </Box>
        {toolbar}
        <List dense sx={{ flex: 1, overflowY: 'auto', px: 0.5 }} aria-label="Research tree">
          {roots.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
              Nothing yet.
            </Typography>
          ) : (
            renderItems(roots, 0)
          )}
        </List>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {sel ? (
          <ResearchViewer key={sel.id} docId={sel.id} />
        ) : (
          <EmptyState
            icon={<ScienceIcon />}
            title="Your research shelf"
            description="Collect notes, web links, reference photos and PDFs. Open any of them beside your draft with the split editor."
            action={
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => void create('note')}>
                  New note
                </Button>
                <Button onClick={() => fileRef.current?.click()}>Upload files</Button>
              </Stack>
            }
          />
        )}
      </Box>
      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={async () => {
            const d = docs[menu!.id];
            setMenu(null);
            const t = await promptDialog({ title: 'Rename', initial: d.title });
            if (t?.trim()) await useStore.getState().updateDoc(d.id, { title: t.trim() });
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            const id = menu!.id;
            setMenu(null);
            useStore.getState().setView('write');
            useStore.getState().setSplitDoc(id);
          }}
        >
          Open beside draft (split)
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            const id = menu!.id;
            setMenu(null);
            void remove(id);
          }}
        >
          Delete…
        </MenuItem>
      </Menu>
    </Box>
  );
}
