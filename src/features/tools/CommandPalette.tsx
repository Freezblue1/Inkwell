import { useMemo, useRef, useState, type ReactElement } from 'react';
import { Box, Chip, Dialog, InputAdornment, InputBase, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import PersonIcon from '@mui/icons-material/PersonOutline';
import BoltIcon from '@mui/icons-material/BoltOutlined';
import { useStore } from '@/store';
import type { View } from '@/store/uiSlice';
import { fuzzyFilter } from '@/lib/fuzzy';
import { GROUP_LABELS, groupOfDoc, ancestors } from '@/lib/tree';
import { BIBLE_KIND_LABELS } from '@/lib/bible';
import { flushAll } from '@/features/editor/autosave';
import { newSceneAfterCurrent, snapshotActiveDoc } from './useGlobalShortcuts';
import { REVISION_PASSES } from '@/features/editor/revisions/passes';
import { SCENE_LIST } from '@/theme/scenes';
import { openContinuity } from '@/features/plan/continuity/ContinuityView';
import { resolveInProject } from '@/features/editor/revisions/RevisionMenu';

interface Cmd {
  id: string;
  kind: 'doc' | 'bible' | 'action';
  title: string;
  subtitle?: string;
  hint?: string;
  run: () => void;
}

/** Ctrl/Cmd+K: jump to any document or bible entry, or run any action. */
export default function CommandPalette() {
  const close = () => useStore.getState().closeDialog('palette');
  const docs = useStore((s) => s.docs);
  const bible = useStore((s) => s.bible);
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Cmd[]>(() => {
    const s = useStore.getState;
    const view = (v: View, title: string, hint: string): Cmd => ({ id: `view-${v}`, kind: 'action', title, hint, run: () => s().setView(v) });
    const actions: Cmd[] = [
      view('write', 'Go to Write', 'Alt+1'),
      view('plan', 'Go to Plan', 'Alt+2'),
      view('research', 'Go to Research', 'Alt+3'),
      view('goals', 'Go to Goals', 'Alt+4'),
      view('export', 'Go to Format & Export', 'Alt+5'),
      view('history', 'Go to History', 'Alt+6'),
      { id: 'cork', kind: 'action', title: 'Open corkboard', run: () => s().setPlanTab('corkboard') },
      { id: 'whiteboard', kind: 'action', title: 'Open whiteboard', run: () => s().setPlanTab('whiteboard') },
      { id: 'outliner', kind: 'action', title: 'Open outliner', run: () => s().setPlanTab('outliner') },
      { id: 'prologue', kind: 'action', title: 'New prologue', run: () => void s().createSpecialChapter('prologue').then((d) => s().openDoc(d.id)) },
      { id: 'epilogue', kind: 'action', title: 'New epilogue', run: () => void s().createSpecialChapter('epilogue').then((d) => s().openDoc(d.id)) },
      { id: 'interlude', kind: 'action', title: 'New interlude', run: () => void s().createSpecialChapter('interlude').then((d) => s().openDoc(d.id)) },
      { id: 'plotgrid', kind: 'action', title: 'Open plot grid', run: () => s().setPlanTab('plotgrid') },
      { id: 'timeline', kind: 'action', title: 'Open timeline', run: () => s().setPlanTab('timeline') },
      { id: 'bible', kind: 'action', title: 'Open story bible', run: () => s().setPlanTab('bible') },
      { id: 'relmap', kind: 'action', title: 'Open relationship map', run: () => s().setPlanTab('relationships') },
      { id: 'structure', kind: 'action', title: 'Generate outline from a story structure', run: () => s().setPlanTab('structure') },
      { id: 'continuity', kind: 'action', title: 'Continuity checker (eye colour, name spellings, absences)', run: () => openContinuity('checks') },
      { id: 'appearances', kind: 'action', title: 'Character appearances by chapter', run: () => openContinuity('appearances') },
      { id: 'dialogue', kind: 'action', title: 'Dialogue view: one character’s lines', run: () => openContinuity('dialogue') },
      { id: 'new-scene', kind: 'action', title: 'New scene', hint: 'Ctrl+Alt+N', run: () => void newSceneAfterCurrent() },
      { id: 'new-char', kind: 'action', title: 'New character', run: () => void s().createBibleEntry('character').then((e) => s().openBibleEntry(e.id)) },
      { id: 'new-loc', kind: 'action', title: 'New location', run: () => void s().createBibleEntry('location').then((e) => s().openBibleEntry(e.id)) },
      { id: 'focus', kind: 'action', title: 'Enter focus mode', hint: 'Ctrl+Shift+Enter', run: () => s().activeDocId && s().setFocusMode(true) },
      { id: 'split', kind: 'action', title: 'Toggle split editor', hint: 'Ctrl+\\', run: () => (s().setView('write'), s().toggleSplit()) },
      { id: 'find', kind: 'action', title: 'Find & replace', hint: 'Ctrl+H', run: () => (s().setView('write'), s().setFind({ open: true, replace: true })) },
      { id: 'search', kind: 'action', title: 'Search the whole project', hint: 'Ctrl+Shift+F', run: () => s().openDialog('search') },
      { id: 'snapshot', kind: 'action', title: 'Snapshot current document', hint: 'Ctrl+Shift+P', run: () => void snapshotActiveDoc() },
      { id: 'revision-toggle', kind: 'action', title: 'Revision mode on/off (tracked changes)', hint: 'Ctrl+Alt+R', run: () => s().toggleRevisionMode() },
      ...REVISION_PASSES.map((p): Cmd => ({ id: `revision-${p.n}`, kind: 'action', title: `Revision mode: ${p.name}`, run: () => s().setRevisionPass(p.n) })),
      { id: 'revision-next', kind: 'action', title: 'Next tracked change', hint: 'Ctrl+Alt+.', run: () => s().activeEditor?.chain().focus().goToRevision(1).run() },
      { id: 'revision-accept-doc', kind: 'action', title: 'Accept all tracked changes in this document', run: () => s().activeEditor?.chain().focus().resolveAllRevisions('accept').run() },
      { id: 'revision-reject-doc', kind: 'action', title: 'Reject all tracked changes in this document', run: () => s().activeEditor?.chain().focus().resolveAllRevisions('reject').run() },
      { id: 'revision-accept-project', kind: 'action', title: 'Accept all tracked changes in the project…', run: () => void resolveInProject('accept', null) },
      { id: 'revision-view', kind: 'action', title: 'Show / hide tracked changes (markup ↔ final)', run: () => s().setRevisionView(s().revisionView === 'markup' ? 'final' : 'markup') },
      { id: 'proof', kind: 'action', title: 'Toggle proofreading mode', run: () => s().setProofreading(!s().proofreading) },
      { id: 'analysis', kind: 'action', title: 'Writing analysis', run: () => s().openDialog('analysis') },
      { id: 'names', kind: 'action', title: 'Name generator', run: () => s().openDialog('nameGen') },
      { id: 'scratch', kind: 'action', title: 'Scratchpad', hint: 'Ctrl+.', run: () => s().openDialog('scratchpad') },
      { id: 'ai', kind: 'action', title: 'AI assistant', run: () => s().openDialog('ai') },
      { id: 'compile', kind: 'action', title: 'Compile / export manuscript', run: () => s().openDialog('compile') },
      { id: 'import', kind: 'action', title: 'Import a manuscript (Word, Google Docs, Reedsy, Scrivener, Markdown, PDF)', run: () => s().openDialog('import') },
      { id: 'save', kind: 'action', title: 'Save now', hint: 'Ctrl+S', run: () => void flushAll().then(() => s().notify('All changes saved')) },
      { id: 'projects', kind: 'action', title: 'Switch project', run: () => s().openDialog('projects') },
      { id: 'home', kind: 'action', title: 'Home (all projects)', hint: 'Ctrl+Alt+H', run: () => void s().goHome() },
      { id: 'theme-dark', kind: 'action', title: 'Theme: dark', run: () => s().updateSettings({ themeMode: 'dark' }) },
      { id: 'theme-light', kind: 'action', title: 'Theme: light', run: () => s().updateSettings({ themeMode: 'light' }) },
      { id: 'theme-system', kind: 'action', title: 'Theme: match system', run: () => s().updateSettings({ themeMode: 'system' }) },
      ...SCENE_LIST.map((sc): Cmd => ({ id: `theme-${sc.id}`, kind: 'action', title: `Theme: ${sc.name} — ${sc.tagline}`, run: () => s().updateSettings({ themeMode: sc.id }) })),
      { id: 'sepia', kind: 'action', title: 'Toggle sepia paper', run: () => s().updateEditorSettings({ paperTheme: s().settings.editor.paperTheme === 'sepia' ? 'default' : 'sepia' }) },
      { id: 'density', kind: 'action', title: 'Toggle compact density', run: () => s().updateSettings({ density: s().settings.density === 'compact' ? 'comfortable' : 'compact' }) },
      { id: 'shortcuts', kind: 'action', title: 'Keyboard shortcuts', hint: '?', run: () => s().openDialog('shortcuts') },
      { id: 'settings', kind: 'action', title: 'Settings', run: () => s().openDialog('settings') },
    ];
    const docCmds: Cmd[] = Object.values(docs)
      .filter((d) => !d.trashed)
      .map((d) => ({
        id: d.id,
        kind: 'doc',
        title: d.title || 'Untitled',
        subtitle: [GROUP_LABELS[groupOfDoc(docs, d.id)], ...ancestors(docs, d.id).map((a) => a.title)].join(' › '),
        hint: d.wordCount ? `${d.wordCount.toLocaleString()} w` : undefined,
        run: () => s().openDoc(d.id),
      }));
    const bibleCmds: Cmd[] = bible.map((b) => ({ id: b.id, kind: 'bible', title: b.name, subtitle: BIBLE_KIND_LABELS[b.kind].singular, run: () => s().openBibleEntry(b.id) }));
    return [...docCmds, ...bibleCmds, ...actions];
  }, [docs, bible]);

  const results = useMemo(() => {
    if (!q.trim()) {
      // Recent documents first, then common actions.
      const recent = commands
        .filter((c) => c.kind === 'doc')
        .sort((a, b) => (docs[b.id]?.updatedAt ?? 0) - (docs[a.id]?.updatedAt ?? 0))
        .slice(0, 6);
      return [...recent, ...commands.filter((c) => c.kind === 'action').slice(0, 12)];
    }
    return fuzzyFilter(commands, q, (c) => `${c.title} ${c.subtitle ?? ''}`, 40);
  }, [commands, q, docs]);

  const run = (c: Cmd | undefined) => {
    if (!c) return;
    close();
    c.run();
  };

  const icons: Record<Cmd['kind'], ReactElement> = {
    doc: <DescriptionIcon fontSize="small" />,
    bible: <PersonIcon fontSize="small" />,
    action: <BoltIcon fontSize="small" />,
  };
  const groupTitle: Record<Cmd['kind'], string> = { doc: 'Documents', bible: 'Story bible', action: 'Actions' };

  return (
    <Dialog open onClose={close} fullWidth maxWidth="sm" PaperProps={{ sx: { position: 'fixed', top: '12vh', m: 0, width: 'min(640px, calc(100vw - 32px))' } }} aria-label="Command palette">
      <InputBase
        autoFocus
        fullWidth
        placeholder="Jump to a scene, character or action…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => Math.min(results.length - 1, i + 1));
            listRef.current?.querySelector(`[data-idx="${Math.min(results.length - 1, index + 1)}"]`)?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
            listRef.current?.querySelector(`[data-idx="${Math.max(0, index - 1)}"]`)?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(results[index]);
          }
        }}
        inputProps={{ 'aria-label': 'Command', role: 'combobox', 'aria-expanded': true, 'aria-controls': 'palette-list', 'aria-activedescendant': results[index] ? `cmd-${index}` : undefined }}
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon />
          </InputAdornment>
        }
        sx={{ px: 2, py: 1.5, fontSize: 17, borderBottom: 1, borderColor: 'divider' }}
      />
      <List ref={listRef} id="palette-list" role="listbox" dense sx={{ maxHeight: '55vh', overflowY: 'auto', py: 0 }}>
        {results.length === 0 && (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            Nothing matches “{q}”.
          </Typography>
        )}
        {results.map((c, i) => (
          <Box key={`${c.kind}-${c.id}`}>
            {(i === 0 || results[i - 1].kind !== c.kind) && (
              <ListSubheader sx={{ lineHeight: '28px', bgcolor: 'background.paper' }}>{!q.trim() && c.kind === 'doc' ? 'Recent' : groupTitle[c.kind]}</ListSubheader>
            )}
            <ListItemButton id={`cmd-${i}`} data-idx={i} role="option" aria-selected={i === index} selected={i === index} onMouseEnter={() => setIndex(i)} onClick={() => run(c)}>
              <ListItemIcon sx={{ minWidth: 36 }}>{icons[c.kind]}</ListItemIcon>
              <ListItemText primary={c.title} secondary={c.subtitle} primaryTypographyProps={{ noWrap: true }} secondaryTypographyProps={{ noWrap: true, fontSize: 12 }} />
              {c.hint && <Chip size="small" label={c.hint} variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
            </ListItemButton>
          </Box>
        ))}
      </List>
    </Dialog>
  );
}
