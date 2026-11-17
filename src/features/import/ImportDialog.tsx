/**
 * Import a manuscript from Word, Google Docs, Reedsy Studio, Scrivener,
 * Markdown, PDF (and RTF, ODT, EPUB, HTML, plain text, pasted text).
 * Pick a source → preview the chapters Inkwell found → import as a new
 * project or into the open one.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type DragEvent, type ReactElement } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesOutlined';
import ArticleIcon from '@mui/icons-material/ArticleOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import CloudIcon from '@mui/icons-material/CloudOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpenOutlined';
import TagIcon from '@mui/icons-material/Tag';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BookmarkIcon from '@mui/icons-material/BookmarkBorder';
import { useStore } from '@/store';
import { flushAll } from '@/features/editor/autosave';
import { FORMAT_LABELS, IMPORT_ACCEPT, DEFAULT_STRUCTURE, planImport, planStats, readImport, readPaste, type ImportNode, type ImportSource, type PickedFile, type StructureOptions } from '@/lib/import';
import { blockText, nodeWords } from '@/lib/import/blocks';
import { importAsNewProject, importIntoProject } from '@/db/importManuscript';
import { formatCount } from '@/lib/wordCount';

type SourceApp = 'word' | 'gdocs' | 'reedsy' | 'scrivener' | 'markdown' | 'pdf';

const SOURCES: { id: SourceApp; label: string; formats: string; icon: ReactElement; accept: string; folder?: boolean; help: string }[] = [
  {
    id: 'word',
    label: 'Microsoft Word',
    formats: '.docx',
    icon: <DescriptionIcon />,
    accept: '.docx,.docm,.dotx,.rtf,.odt',
    help: 'Choose a .docx file. Headings (Heading 1, Heading 2) or “Chapter …” lines become chapters, and “***”, “#” or “⁂” lines split scenes. Italics, bold and footnotes come along.',
  },
  {
    id: 'gdocs',
    label: 'Google Docs',
    formats: 'Download, or paste',
    icon: <CloudIcon />,
    accept: '.docx,.odt,.md,.zip,.html,.htm,.epub,.txt,.rtf,.pdf',
    help: 'In Google Docs choose File → Download → Microsoft Word (.docx) and pick the download here. The Markdown, OpenDocument, Web page (.zip), EPUB, RTF and plain-text downloads work too. Or copy the whole document (Ctrl+A, Ctrl+C) and paste it in the box below.',
  },
  {
    id: 'reedsy',
    label: 'Reedsy Studio',
    formats: 'EPUB, Word or PDF export',
    icon: <AutoStoriesIcon />,
    accept: '.epub,.docx,.pdf',
    help: 'Export your book from Reedsy Studio and pick the file here. EPUB works best: Inkwell uses its table of contents for chapter titles, parts and front and back matter. Word and PDF exports work too.',
  },
  {
    id: 'scrivener',
    label: 'Scrivener',
    formats: '.scriv folder or .zip',
    icon: <FolderOpenIcon />,
    accept: '.zip',
    folder: true,
    help: 'Choose your project’s .scriv folder, or a .zip of it. Manuscript folders become parts and chapters, documents become scenes, and synopses, notes and statuses come along. Research and other top-level folders arrive as notes.',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    formats: '.md, .txt',
    icon: <TagIcon />,
    accept: '.md,.markdown,.mdown,.mkd,.txt',
    help: '# and ## headings become chapters; “***” or a lone “#” splits scenes. Front matter (title:, author:) fills in the book details. Plain .txt files with “Chapter …” lines work too.',
  },
  {
    id: 'pdf',
    label: 'PDF',
    formats: 'Text PDFs (not scans)',
    icon: <PictureAsPdfIcon />,
    accept: '.pdf',
    help: 'Inkwell rebuilds paragraphs from the page layout, removes page numbers and running heads, and finds chapters from larger heading text or “Chapter …” lines. Italics and bold aren’t kept. Scanned PDFs (pictures of pages) can’t be read.',
  },
];

const KIND_ICON: Record<ImportNode['kind'], ReactElement> = {
  part: <AutoStoriesIcon fontSize="small" />,
  chapter: <MenuBookIcon fontSize="small" />,
  scene: <DescriptionIcon fontSize="small" />,
  frontmatter: <ArticleIcon fontSize="small" />,
  backmatter: <ArticleIcon fontSize="small" />,
  note: <StickyNote2Icon fontSize="small" />,
};
const KIND_LABEL: Record<ImportNode['kind'], string> = {
  part: 'Part',
  chapter: 'Chapter',
  scene: 'Scene',
  frontmatter: 'Front matter',
  backmatter: 'Back matter',
  note: 'Note',
};

/** Files in a Scrivener package that Inkwell never needs. */
const SCRIV_NOISE = /\/(Snapshots|QuickLook|Settings|Icons)\/|search\.indexes|\.(png|jpe?g|gif|tiff?|pdf|webarchive|mov|mp3|mp4)$/i;

async function filesFromDrop(dt: DataTransfer): Promise<PickedFile[]> {
  const entries = [...dt.items]
    .filter((i) => i.kind === 'file')
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.some((e) => e.isDirectory)) return [...dt.files].map((f) => ({ path: f.name, blob: f }));
  const out: PickedFile[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    const path = prefix + entry.name;
    if (entry.isFile) {
      if (SCRIV_NOISE.test(path)) return;
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ path, blob: file });
      return;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) await walk(e, `${path}/`);
    }
  };
  for (const e of entries) await walk(e, '');
  return out;
}

function flatten(nodes: ImportNode[], collapsed: Set<string>, depth = 0, parentOff = false, out: { node: ImportNode; depth: number; off: boolean }[] = []) {
  for (const n of nodes) {
    out.push({ node: n, depth, off: parentOff });
    if (n.children.length && !collapsed.has(n.key)) flatten(n.children, collapsed, depth + 1, parentOff || !n.include, out);
  }
  return out;
}

function findNode(nodes: ImportNode[], key: string | null): ImportNode | null {
  if (!key) return null;
  for (const n of nodes) {
    if (n.key === key) return n;
    const f = findNode(n.children, key);
    if (f) return f;
  }
  return null;
}

const baseName = (name: string) => name.replace(/\.(docx|md|markdown|txt|rtf|odt|html?|epub|pdf|zip|scriv)$/i, '').replace(/[_]+/g, ' ').trim();

export default function ImportDialog() {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const project = useStore((s) => s.project);
  const close = () => useStore.getState().closeDialog('import');

  const [step, setStep] = useState<'pick' | 'reading' | 'preview' | 'importing'>('pick');
  const [app, setApp] = useState<SourceApp>('word');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [opts, setOpts] = useState<StructureOptions>(DEFAULT_STRUCTURE);
  const [dest, setDest] = useState<'new' | 'into'>('new');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement | null>(null);

  const plan = useMemo(() => (source ? planImport(source, opts) : null), [source, opts]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stats = useMemo(() => (plan ? planStats(plan.nodes) : null), [plan, version]);

  // New plan: collapse chapters when there are many, select nothing.
  useEffect(() => {
    if (!plan) return;
    const chapters: string[] = [];
    const walk = (list: ImportNode[]) => {
      for (const n of list) {
        if (n.kind === 'chapter' || n.kind === 'note') chapters.push(n.key);
        walk(n.children);
      }
    };
    walk(plan.nodes);
    setCollapsed(new Set(chapters.length > 8 ? chapters : []));
    setSelected(null);
  }, [plan]);

  // A callback ref: the dialog's content mounts after this component's effects run (portal), so set the folder-picker attributes on mount.
  const setFolderInput = useCallback((el: HTMLInputElement | null) => {
    folderRef.current = el;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, []);

  const load = async (files: PickedFile[] | null, paste?: { html: string; text: string }) => {
    setError(null);
    setStep('reading');
    setProgress('Reading…');
    try {
      const src = paste ? readPaste(paste.html, paste.text) : await readImport(files ?? [], setProgress);
      const first = planImport(src, opts);
      if (!first.nodes.length) throw new Error('Inkwell couldn’t find any text in that.');
      setSource(src);
      setTitle(first.title || (src.format === 'paste' ? '' : baseName(src.name)));
      setAuthor(first.author || project?.author || '');
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
      setStep('pick');
    }
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    try {
      const files = await filesFromDrop(e.dataTransfer);
      if (files.length) void load(files);
    } catch {
      setError('Could not read what was dropped. Try the Choose button instead.');
    }
  };

  const doImport = async () => {
    if (!plan || !source) return;
    const s = useStore.getState();
    setStep('importing');
    setError(null);
    try {
      const st = planStats(plan.nodes);
      const summary = [st.parts && `${st.parts} part${st.parts === 1 ? '' : 's'}`, st.chapters && `${st.chapters} chapter${st.chapters === 1 ? '' : 's'}`, st.scenes && `${st.scenes} scene${st.scenes === 1 ? '' : 's'}`]
        .filter(Boolean)
        .join(', ');
      if (dest === 'into' && project) {
        await flushAll();
        const res = await importIntoProject(project.id, plan);
        await s.reloadDocs();
        s.setView('write');
        if (res.firstId) s.openDoc(res.firstId);
        s.notify(`Added ${summary || `${res.created} items`} (${formatCount(st.words)} words) to “${project.title}”`, 'success');
      } else {
        const id = await importAsNewProject(plan, { title, author });
        await s.loadProjects();
        await s.openProject(id);
        s.closeDialog('projects');
        s.setView('write');
        s.notify(`Imported “${title || 'Imported manuscript'}”: ${summary || 'done'} · ${formatCount(st.words)} words`, 'success');
      }
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The import failed.');
      setStep('preview');
    }
  };

  const toggleInclude = (n: ImportNode) => {
    const value = !n.include;
    const set = (x: ImportNode) => {
      x.include = value;
      x.children.forEach(set);
    };
    set(n);
    bump();
  };

  const rows = plan ? flatten(plan.nodes, collapsed) : [];
  const sel = plan ? findNode(plan.nodes, selected) : null;
  const srcInfo = SOURCES.find((x) => x.id === app)!;

  return (
    <Dialog open onClose={step === 'importing' ? undefined : close} maxWidth="md" fullWidth fullScreen={fullScreen} aria-labelledby="import-title">
      <DialogTitle id="import-title">
        {step === 'preview' && source ? (
          <>
            Import “{source.name}”
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {FORMAT_LABELS[source.format]}
            </Typography>
          </>
        ) : (
          'Import a manuscript'
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 420 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {step === 'pick' && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Where is your manuscript now? Inkwell finds the chapters and scenes, shows you what it found, and imports it as a new project or into this one.
            </Typography>
            <Box role="radiogroup" aria-label="Import from" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
              {SOURCES.map((src) => (
                <ButtonBase
                  key={src.id}
                  role="radio"
                  aria-checked={app === src.id}
                  onClick={() => setApp(src.id)}
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    gap: 1.5,
                    p: 1.5,
                    textAlign: 'left',
                    borderRadius: 2,
                    border: 2,
                    borderColor: app === src.id ? 'primary.main' : 'divider',
                    bgcolor: app === src.id ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  <Box sx={{ color: app === src.id ? 'primary.main' : 'text.secondary', display: 'flex' }}>{src.icon}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                      {src.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                      {src.formats}
                    </Typography>
                  </Box>
                </ButtonBase>
              ))}
            </Box>

            <Box
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => void onDrop(e)}
              sx={{
                border: 2,
                borderStyle: 'dashed',
                borderColor: dragging ? 'primary.main' : 'divider',
                bgcolor: dragging ? 'action.hover' : 'transparent',
                borderRadius: 2,
                p: 2,
              }}
            >
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                {srcInfo.help}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }} alignItems="center">
                {srcInfo.folder && (
                  <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={() => folderRef.current?.click()}>
                    Choose .scriv folder…
                  </Button>
                )}
                <Button variant={srcInfo.folder ? 'outlined' : 'contained'} startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()}>
                  {srcInfo.folder ? 'Choose a .zip…' : 'Choose file…'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  or drop {srcInfo.folder ? 'the folder' : 'a file'} here
                </Typography>
              </Stack>
              <input
                ref={fileRef}
                type="file"
                hidden
                multiple
                accept={`${srcInfo.accept},${IMPORT_ACCEPT}`}
                onChange={(e) => {
                  const list = [...(e.target.files ?? [])];
                  e.target.value = '';
                  if (list.length) void load(list.map((f) => ({ path: f.name, blob: f })));
                }}
              />
              <input
                ref={setFolderInput}
                type="file"
                hidden
                onChange={(e) => {
                  const list = [...(e.target.files ?? [])].filter((f) => !SCRIV_NOISE.test(f.webkitRelativePath || f.name));
                  e.target.value = '';
                  if (list.length) void load(list.map((f) => ({ path: f.webkitRelativePath || f.name, blob: f })));
                }}
              />
            </Box>

            {app === 'gdocs' && (
              <TextField
                label="…or paste your document here"
                placeholder="Click here and press Ctrl+V"
                multiline
                minRows={3}
                value=""
                onChange={() => {}}
                onPaste={(e) => {
                  const html = e.clipboardData.getData('text/html');
                  const text = e.clipboardData.getData('text/plain');
                  if (!html && !text) return;
                  e.preventDefault();
                  void load(null, { html, text });
                }}
                helperText="Formatting (italics, bold, headings) is kept when you copy from Google Docs, Word or a web page."
              />
            )}
            <Typography variant="caption" color="text.secondary">
              Also works with RTF, OpenDocument (.odt), EPUB, HTML and plain text. Choose several files at once to make one chapter per file.
            </Typography>
          </Stack>
        )}

        {(step === 'reading' || step === 'importing') && (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 10 }} role="status" aria-live="polite">
            <CircularProgress />
            <Typography color="text.secondary">{step === 'importing' ? 'Creating chapters and scenes…' : progress}</Typography>
          </Stack>
        )}

        {step === 'preview' && plan && stats && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px 1fr' }, gap: 2.5 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Found
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                  {stats.parts > 0 && <Chip size="small" label={`${stats.parts} part${stats.parts === 1 ? '' : 's'}`} />}
                  <Chip size="small" label={`${stats.chapters} chapter${stats.chapters === 1 ? '' : 's'}`} />
                  <Chip size="small" label={`${stats.scenes} scene${stats.scenes === 1 ? '' : 's'}`} />
                  {stats.other > 0 && <Chip size="small" label={`${stats.other} other`} />}
                  <Chip size="small" color="primary" variant="outlined" label={`${formatCount(stats.words)} words`} />
                </Stack>
              </Box>

              <FormControl>
                <Typography variant="overline" color="text.secondary" component="label" id="import-dest">
                  Import into
                </Typography>
                <RadioGroup aria-labelledby="import-dest" value={dest} onChange={(e) => setDest(e.target.value as 'new' | 'into')}>
                  <FormControlLabel value="new" control={<Radio size="small" />} label="A new project" />
                  {project && <FormControlLabel value="into" control={<Radio size="small" />} label={`“${project.title}” (added at the end)`} />}
                </RadioGroup>
              </FormControl>
              {dest === 'new' && (
                <Stack spacing={1.5}>
                  <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <TextField size="small" label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
                </Stack>
              )}

              {source?.kind === 'flat' && (
                <Stack spacing={1.5}>
                  <Typography variant="overline" color="text.secondary" sx={{ mb: -1 }}>
                    How to split it
                  </Typography>
                  <FormControl size="small">
                    <InputLabel id="imp-ch">Chapters</InputLabel>
                    <Select labelId="imp-ch" label="Chapters" value={opts.chapters} onChange={(e) => setOpts({ ...opts, chapters: e.target.value as StructureOptions['chapters'] })}>
                      <MenuItem value="auto">Find automatically</MenuItem>
                      <MenuItem value="headings">At headings</MenuItem>
                      <MenuItem value="lines">At “Chapter …” lines</MenuItem>
                      <MenuItem value="none">Don’t split into chapters</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small">
                    <InputLabel id="imp-sc">Scenes</InputLabel>
                    <Select labelId="imp-sc" label="Scenes" value={opts.scenes} onChange={(e) => setOpts({ ...opts, scenes: e.target.value as StructureOptions['scenes'] })}>
                      <MenuItem value="split">New scene at each scene break</MenuItem>
                      <MenuItem value="keep">One scene per chapter</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={<Switch size="small" checked={opts.matter} onChange={(e) => setOpts({ ...opts, matter: e.target.checked })} />}
                    label={<Typography variant="body2">Spot prologues, epilogues, front & back matter</Typography>}
                  />
                </Stack>
              )}

              {plan.warnings.length > 0 && (
                <Alert severity="info" sx={{ '& ul': { m: 0, pl: 2 } }}>
                  <ul>
                    {plan.warnings.map((w) => (
                      <li key={w}>
                        <Typography variant="body2">{w}</Typography>
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
            </Stack>

            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" sx={{ mb: -1 }}>
                Binder preview — untick anything you don’t want
              </Typography>
              <Box role="tree" aria-label="Items to import" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: { xs: 320, md: 380 }, overflow: 'auto', py: 0.5 }}>
                {rows.map(({ node, depth, off }) => {
                  const words = nodeWords(node);
                  return (
                    <Box
                      key={node.key}
                      role="treeitem"
                      aria-selected={selected === node.key}
                      aria-expanded={node.children.length ? !collapsed.has(node.key) : undefined}
                      onClick={() => setSelected(node.key)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        pl: 0.5 + depth * 2.5,
                        pr: 1,
                        minHeight: 34,
                        cursor: 'pointer',
                        opacity: off || !node.include ? 0.45 : 1,
                        bgcolor: selected === node.key ? 'action.selected' : 'transparent',
                        '&:hover': { bgcolor: selected === node.key ? 'action.selected' : 'action.hover' },
                      }}
                    >
                      {node.children.length ? (
                        <IconButton
                          size="small"
                          aria-label={collapsed.has(node.key) ? `Expand ${node.title}` : `Collapse ${node.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsed((c) => {
                              const n = new Set(c);
                              if (n.has(node.key)) n.delete(node.key);
                              else n.add(node.key);
                              return n;
                            });
                          }}
                          sx={{ p: 0.25 }}
                        >
                          {collapsed.has(node.key) ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      ) : (
                        <Box sx={{ width: 26 }} />
                      )}
                      <Checkbox
                        size="small"
                        checked={node.include}
                        disabled={off}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleInclude(node)}
                        inputProps={{ 'aria-label': `Import ${node.title}` }}
                        sx={{ p: 0.25 }}
                      />
                      <Box sx={{ color: 'text.secondary', display: 'flex' }} title={KIND_LABEL[node.kind]}>
                        {KIND_ICON[node.kind]}
                      </Box>
                      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                        {node.title}
                      </Typography>
                      {node.special && (
                        <Chip size="small" icon={<BookmarkIcon />} label={node.specialLabel || node.special[0].toUpperCase() + node.special.slice(1)} variant="outlined" sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }} />
                      )}
                      {(node.kind === 'frontmatter' || node.kind === 'backmatter') && <Chip size="small" label={KIND_LABEL[node.kind]} variant="outlined" sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }} />}
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                        {formatCount(words, true)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, minHeight: 120 }}>
                {sel ? (
                  <Stack spacing={1}>
                    <TextField
                      size="small"
                      label={`${KIND_LABEL[sel.kind]} title`}
                      value={sel.title}
                      onChange={(e) => {
                        sel.title = e.target.value;
                        bump();
                      }}
                    />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ whiteSpace: 'pre-wrap', maxHeight: 140, overflow: 'auto', fontFamily: 'Georgia, serif' }}
                    >
                      {previewText(sel)}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Select an item to check its text or rename it. You can also move, merge and split everything after importing.
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {step === 'preview' && (
          <Button
            onClick={() => {
              setSource(null);
              setStep('pick');
            }}
            sx={{ mr: 'auto' }}
          >
            Choose a different file
          </Button>
        )}
        <Button onClick={close} disabled={step === 'importing'}>
          Cancel
        </Button>
        {step === 'preview' && stats && (
          <Button variant="contained" onClick={() => void doImport()} disabled={stats.words === 0 && stats.chapters === 0 && stats.scenes === 0 && stats.other === 0}>
            {dest === 'into' ? 'Add to project' : 'Import'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function previewText(n: ImportNode): string {
  const own = n.blocks
    .map((b) => (b.type === 'sceneBreak' ? '* * *' : blockText(b)))
    .filter((t) => t.trim())
    .join('\n\n');
  if (own.trim()) return own.length > 1500 ? `${own.slice(0, 1500)}…` : own;
  if (n.children.length) {
    const first = n.children.find((c) => c.blocks.length);
    const lead = first ? previewText(first) : '';
    return `${n.children.length} item${n.children.length === 1 ? '' : 's'} inside.${lead ? `\n\n${lead}` : ''}`;
  }
  return '(empty)';
}
