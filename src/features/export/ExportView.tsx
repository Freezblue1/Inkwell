import { useEffect, useState } from 'react';
import { Box, Button, ButtonGroup, Drawer, IconButton, Menu, MenuItem, Slider, Stack, Tooltip, Typography } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import PrintIcon from '@mui/icons-material/PrintOutlined';
import IosShareIcon from '@mui/icons-material/IosShare';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import { useStore } from '@/store';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { useDebouncedValue } from '@/hooks/useDebounced';
import type { CompiledBook } from '@/lib/compile/compile';
import { buildBook, exportBook, EXPORT_FORMATS, type ExportFormat } from '@/lib/export';
import { flushAll } from '@/features/editor/autosave';
import { EmptyState } from '@/components/EmptyState';
import { ViewSkeleton } from '@/components/ViewSkeleton';
import { useExportProfile } from './profileStore';
import { ProfileControls } from './ProfileControls';
import { BookPreview } from './BookPreview';
import { BackupCard } from './BackupCard';
import { printBook } from './printBook';

/** Format & Export: template controls, live paginated preview, compile and backup. */
export default function ExportView() {
  const layout = useLayoutMode();
  const project = useStore((s) => s.project);
  const docs = useStore((s) => s.docs);
  const notify = useStore((s) => s.notify);
  const profile = useExportProfile((s) => s.profile);
  const loadProfile = useExportProfile((s) => s.load);
  const [book, setBook] = useState<CompiledBook | null>(null);
  const [zoom, setZoom] = useState(0.6);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const debouncedProfile = useDebouncedValue(profile, 350);
  const debouncedDocs = useDebouncedValue(docs, 800);

  useEffect(() => {
    if (project) void loadProfile(project.id, project.author);
  }, [project, loadProfile]);

  useEffect(() => {
    if (!project || !debouncedProfile) return;
    let alive = true;
    void flushAll()
      .then(() => buildBook(project, debouncedDocs, debouncedProfile))
      .then((b) => alive && setBook(b));
    return () => {
      alive = false;
    };
  }, [project, debouncedDocs, debouncedProfile]);

  const quickExport = async (format: ExportFormat) => {
    if (!project || !profile) return;
    setExporting(true);
    try {
      await flushAll();
      const b = await buildBook(project, useStore.getState().docs, profile);
      await exportBook(b, format);
      notify(`Exported ${EXPORT_FORMATS.find((f) => f.value === format)?.label}`);
    } catch (e) {
      console.error(e);
      notify(e instanceof Error ? `Export failed: ${e.message}` : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!profile) return <ViewSkeleton />;
  const desktop = layout === 'desktop';
  const controls = <ProfileControls />;

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {desktop ? (
        <Box component="aside" aria-label="Format settings" sx={{ width: 340, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', overflowY: 'auto' }}>
          {controls}
          <Box sx={{ p: 2 }}>
            <BackupCard />
          </Box>
        </Box>
      ) : (
        <Drawer open={controlsOpen} onClose={() => setControlsOpen(false)} PaperProps={{ sx: { width: { xs: '90vw', sm: 360 } } }}>
          {controls}
          <Box sx={{ p: 2 }}>
            <BackupCard />
          </Box>
        </Drawer>
      )}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap', gap: 1 }}>
          {!desktop && (
            <IconButton aria-label="Format settings" onClick={() => setControlsOpen(true)}>
              <TuneIcon />
            </IconButton>
          )}
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 500 }}>
              Format &amp; Export
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {book ? `${book.sections.filter((s) => s.kind === 'chapter').length} chapters · ${book.wordCount.toLocaleString()} words compiled` : 'Compiling…'}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 160, display: { xs: 'none', sm: 'flex' } }}>
            <Typography variant="caption" color="text.secondary">
              Zoom
            </Typography>
            <Slider size="small" min={0.3} max={1.2} step={0.05} value={zoom} onChange={(_, v) => setZoom(v as number)} aria-label="Preview zoom" />
          </Stack>
          <Tooltip title="Print, or save as PDF from the print dialog (exact preview typography)">
            <span>
              <Button startIcon={<PrintIcon />} disabled={!book} onClick={() => book && printBook(book)}>
                Print
              </Button>
            </span>
          </Tooltip>
          <ButtonGroup variant="contained" disabled={exporting}>
            <Button startIcon={<IosShareIcon />} onClick={() => useStore.getState().openDialog('compile')}>
              Compile…
            </Button>
            <Button size="small" aria-label="Quick export" onClick={(e) => setMenu(e.currentTarget)}>
              <ArrowDropDownIcon />
            </Button>
          </ButtonGroup>
          <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
            {EXPORT_FORMATS.map((f) => (
              <MenuItem
                key={f.value}
                onClick={() => {
                  setMenu(null);
                  void quickExport(f.value);
                }}
              >
                Export {f.label}
              </MenuItem>
            ))}
          </Menu>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', bgcolor: (t) => t.inkwell.paper.deskBg }}>
          {!book ? (
            <ViewSkeleton />
          ) : book.sections.length === 0 ? (
            <EmptyState icon={<MenuBookIcon />} title="Nothing to compile" description="Write some scenes — or loosen the status/label filters in the Compile dialog." />
          ) : (
            <BookPreview book={book} zoom={zoom} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
