/**
 * Manuscript import: detects the file type and reads it into an ImportSource.
 * Supported: Word (.docx), Markdown, plain text, RTF, OpenDocument (.odt),
 * HTML (incl. Google Docs "Web page" zip), EPUB (Reedsy Studio and others),
 * PDF, Scrivener projects (.scriv folder or .zip), several files at once
 * (one chapter per file) and pasted text.
 */
import JSZip from 'jszip';
import { blockText, type Block, type FlatSource, type ImportFormat, type ImportSource } from './blocks';
import { htmlToBlocks } from './html';
import { markdownToBlocks, plainTextToBlocks } from './text';
import { rtfToBlocks } from './rtf';
import type { PackageFile } from './scrivener';

export type { ImportSource, ImportNode, ImportFormat } from './blocks';
export { planImport, planStats, DEFAULT_STRUCTURE, type StructureOptions, type ImportPlan } from './structure';
export type { PackageFile } from './scrivener';

export const FORMAT_LABELS: Record<ImportFormat, string> = {
  docx: 'Word document',
  markdown: 'Markdown',
  text: 'Plain text',
  html: 'Web page (HTML)',
  rtf: 'Rich Text (RTF)',
  odt: 'OpenDocument',
  epub: 'EPUB e-book',
  pdf: 'PDF',
  scrivener: 'Scrivener project',
  paste: 'Pasted text',
  multi: 'Several files',
};

/** Accept list for file pickers. */
export const IMPORT_ACCEPT = '.docx,.md,.markdown,.mdown,.txt,.text,.rtf,.odt,.html,.htm,.xhtml,.epub,.pdf,.zip,.scrivx';

export function detectFormat(name: string): ImportFormat | 'zip' {
  const ext = (/\.([^.\\/]+)$/.exec(name)?.[1] ?? '').toLowerCase();
  switch (ext) {
    case 'docx':
    case 'docm':
    case 'dotx':
      return 'docx';
    case 'md':
    case 'markdown':
    case 'mdown':
    case 'mkd':
      return 'markdown';
    case 'txt':
    case 'text':
      return 'text';
    case 'html':
    case 'htm':
    case 'xhtml':
      return 'html';
    case 'rtf':
      return 'rtf';
    case 'odt':
      return 'odt';
    case 'epub':
      return 'epub';
    case 'pdf':
      return 'pdf';
    case 'scrivx':
      return 'scrivener';
    case 'zip':
      return 'zip';
    case 'doc':
      throw new Error('That’s the old Word format (.doc). Open it in Word or Google Docs and save it as .docx, then import that.');
    case 'pages':
      throw new Error('Pages files can’t be read directly. In Pages choose File → Export To → Word, then import the .docx.');
    case 'gdoc':
      throw new Error('That’s only a Google Drive shortcut. In Google Docs choose File → Download → Microsoft Word (.docx), then import the download.');
    case 'scriv':
      return 'scrivener';
    default:
      throw new Error(`Inkwell can’t import “${name}”. Use Word (.docx), Markdown, PDF, EPUB, RTF, ODT, HTML, plain text or a Scrivener project.`);
  }
}

export interface ReadProgress {
  (message: string): void;
}

async function readSingle(name: string, blob: Blob, onProgress?: ReadProgress): Promise<ImportSource> {
  const format = detectFormat(name);
  const base = name.replace(/\.[^.]+$/, '');
  const flat = (f: ImportFormat, blocks: Block[], extra: Partial<FlatSource> = {}): FlatSource => ({ kind: 'flat', format: f, name, title: '', author: '', warnings: [], blocks, ...extra });
  switch (format) {
    case 'docx':
      return (await import('./docx')).readDocx(await blob.arrayBuffer(), name);
    case 'markdown': {
      const r = markdownToBlocks(await blob.text());
      return flat('markdown', r.blocks, { title: r.title, author: r.author, warnings: r.images ? [`${r.images} picture link${r.images === 1 ? ' was' : 's were'} left out.`] : [] });
    }
    case 'text':
      return flat('text', plainTextToBlocks(await blob.text()));
    case 'html': {
      const r = htmlToBlocks(await blob.text());
      return flat('html', r.blocks, { title: r.title === base ? '' : r.title, warnings: r.images ? [`${r.images} picture${r.images === 1 ? ' was' : 's were'} left out.`] : [] });
    }
    case 'rtf':
      return flat('rtf', rtfToBlocks(await blob.text()));
    case 'odt':
      return (await import('./odt')).readOdt(await blob.arrayBuffer(), name);
    case 'epub':
      return (await import('./epub')).readEpub(await blob.arrayBuffer(), name);
    case 'pdf':
      return (await import('./pdf')).readPdf(await blob.arrayBuffer(), name, (done, total) => onProgress?.(`Reading page ${done} of ${total}…`));
    case 'scrivener':
      throw new Error('Choose the whole “.scriv” folder (or a .zip of it) rather than the .scrivx file inside, so Inkwell can read the text files too.');
    case 'zip':
      return readZip(name, blob, onProgress);
  }
  throw new Error(`Unsupported file: ${name}`);
}

async function readZip(name: string, blob: Blob, onProgress?: ReadProgress): Promise<ImportSource> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const entries = Object.values(zip.files).filter((f) => !f.dir && !/(^|\/)(__MACOSX|\.DS_Store)/.test(f.name));
  if (entries.some((f) => /\.scrivx$/i.test(f.name))) {
    const files: PackageFile[] = await Promise.all(entries.map(async (f) => ({ path: f.name, blob: await f.async('blob') })));
    return (await import('./scrivener')).readScrivener(files, name.replace(/\.zip$/i, ''));
  }
  // Google Docs "Web page (.html, zipped)".
  const html = entries.find((f) => /\.x?html?$/i.test(f.name));
  if (html) return readSingle(name.replace(/\.zip$/i, '.html'), await html.async('blob'), onProgress);
  const other = entries.find((f) => /\.(docx|md|markdown|txt|rtf|odt|epub|pdf)$/i.test(f.name));
  if (other) return readSingle(other.name.split('/').pop()!, await other.async('blob'), onProgress);
  throw new Error('That .zip has nothing Inkwell can import (expected a Scrivener project, a Google Docs web page, or a manuscript file).');
}

/** Natural sort so "Chapter 2" comes before "Chapter 10". */
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export interface PickedFile {
  /** Path relative to the picked folder ("Novel.scriv/Files/…"), or just the file name. */
  path: string;
  blob: Blob;
}

/** Reads what the user picked or dropped: one file, a Scrivener folder, or several files (one chapter each). */
export async function readImport(files: PickedFile[], onProgress?: ReadProgress): Promise<ImportSource> {
  if (!files.length) throw new Error('Nothing to import.');
  if (files.some((f) => /\.scrivx$/i.test(f.path)) && (files.length > 1 || files[0].path.includes('/'))) {
    onProgress?.('Reading the Scrivener project…');
    const top = files[0].path.split('/')[0];
    return (await import('./scrivener')).readScrivener(files, top);
  }
  // One file: let its reader explain any problem. Several: skip what can't be read.
  const usable =
    files.length === 1
      ? files
      : files.filter((f) => {
          try {
            return detectFormat(f.path) !== 'scrivener';
          } catch {
            return false;
          }
        });
  if (usable.length === 0) throw new Error('None of those files can be imported.');
  if (usable.length === 1) {
    onProgress?.('Reading…');
    return readSingle(usable[0].path.split('/').pop()!, usable[0].blob, onProgress);
  }
  // Several files: each becomes a chapter, in name order.
  const sorted = [...usable].sort((a, b) => natural.compare(a.path, b.path));
  const blocks: Block[] = [];
  const warnings: string[] = [];
  let k = 0;
  for (const f of sorted) {
    k++;
    const name = f.path.split('/').pop()!;
    onProgress?.(`Reading ${name} (${k} of ${sorted.length})…`);
    const src = await readSingle(name, f.blob);
    if (src.kind !== 'flat') continue;
    warnings.push(...src.warnings.map((w) => `${name}: ${w}`));
    const body = src.blocks.filter((b) => b.type !== 'pageBreak');
    let title = name.replace(/\.[^.]+$/, '').replace(/^\s*\d+\s*[-_.)]\s*/, '').replace(/[_]+/g, ' ').trim() || name;
    const firstIdx = body.findIndex((b) => blockText(b).trim());
    const first = body[firstIdx];
    if (first?.type === 'heading' && blockText(first).trim().length <= 100) {
      title = blockText(first).trim();
      body.splice(firstIdx, 1);
    }
    blocks.push({ type: 'heading', level: 1, inl: [{ kind: 'text', text: title }], role: 'chapter' }, ...body);
  }
  return { kind: 'flat', format: 'multi', name: `${sorted.length} files`, title: '', author: '', warnings, blocks };
}

/** Rich text pasted from Google Docs, Word, a web page… (falls back to plain text). */
export function readPaste(html: string, text: string): ImportSource {
  const blocks = html.trim() ? htmlToBlocks(html).blocks : plainTextToBlocks(text);
  return { kind: 'flat', format: 'paste', name: 'Pasted text', title: '', author: '', warnings: [], blocks };
}
