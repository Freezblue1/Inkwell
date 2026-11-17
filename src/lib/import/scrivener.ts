/**
 * Scrivener projects (.scriv folders, Scrivener 1–3 on Windows and Mac).
 * Reads the binder from the .scrivx file and each document's RTF text,
 * synopsis and notes. Manuscript folders become parts and chapters, text
 * documents become scenes; research and other top-level folders become notes.
 */
import { blockText, makeNode, type Block, type ImportNode, type TreeSource } from './blocks';
import { rtfToBlocks } from './rtf';
import { classifyTitle, isPartTitle, partTitle } from './structure';

export interface PackageFile {
  /** Path relative to the folder the user picked, with forward slashes. */
  path: string;
  blob: Blob;
}

const STATUS_MAP: [RegExp, string][] = [
  [/^(to ?do|idea|not started)$/i, 'Idea'],
  [/^(outline|outlined|planned)$/i, 'Outline'],
  [/^(first draft|draft|in progress|rough draft)$/i, 'Draft'],
  [/^(revised draft|revision|revised|second draft|edited)$/i, 'Revision'],
  [/^(final draft|final|done|complete|completed)$/i, 'Final'],
];

function mapStatus(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return STATUS_MAP.find(([re]) => re.test(name.trim()))?.[1];
}

const kids = (el: Element, name: string) => [...el.children].filter((c) => c.localName === name);
const kid = (el: Element, name: string) => kids(el, name)[0];

export async function readScrivener(files: PackageFile[], fallbackName: string): Promise<TreeSource> {
  const scrivx = files.find((f) => /\.scrivx$/i.test(f.path) && f.path.split('/').length <= 3);
  if (!scrivx) {
    throw new Error('No Scrivener project found. Choose the whole “.scriv” folder (or a .zip of it), not a file inside it.');
  }
  const root = scrivx.path.includes('/') ? scrivx.path.slice(0, scrivx.path.lastIndexOf('/') + 1) : '';
  const byPath = new Map<string, Blob>();
  for (const f of files) if (f.path.startsWith(root)) byPath.set(f.path.slice(root.length).toLowerCase(), f.blob);
  const read = async (p: string) => {
    const b = byPath.get(p.toLowerCase());
    return b ? await b.text() : null;
  };

  const doc = new DOMParser().parseFromString(await scrivx.blob.text(), 'application/xml');
  const project = doc.documentElement;
  const v3 = Number(project.getAttribute('Version') ?? '1') >= 2;
  const folderName = (root.replace(/\/$/, '').split('/').pop() || scrivx.path.split('/').pop() || fallbackName).replace(/\.scriv(x)?$/i, '');
  const props = kid(project, 'ProjectProperties');
  const title = (props && kid(props, 'ProjectTitle')?.textContent?.trim()) || folderName;
  const author = (props && kid(props, 'FullName')?.textContent?.trim()) || '';

  const statuses = new Map<string, string>();
  [...doc.getElementsByTagName('Status')].forEach((s) => statuses.set(s.getAttribute('ID') ?? '', (s.textContent ?? '').trim()));

  const warnings: string[] = [];
  let skippedFiles = 0;
  let missing = 0;

  const loadItem = async (item: Element) => {
    const id = item.getAttribute('UUID') ?? item.getAttribute('ID') ?? '';
    const [rtf, synopsis, notes] = v3
      ? await Promise.all([read(`Files/Data/${id}/content.rtf`), read(`Files/Data/${id}/synopsis.txt`), read(`Files/Data/${id}/notes.rtf`)])
      : await Promise.all([read(`Files/Docs/${id}.rtf`), read(`Files/Docs/${id}_synopsis.txt`), read(`Files/Docs/${id}_notes.rtf`)]);
    const blocks: Block[] = rtf ? rtfToBlocks(rtf) : [];
    const notesText = notes
      ? rtfToBlocks(notes)
          .map(blockText)
          .filter((t) => t.trim())
          .join('\n\n')
      : '';
    const meta = kid(item, 'MetaData');
    const statusId = meta ? kid(meta, 'StatusID')?.textContent?.trim() : undefined;
    return { blocks, synopsis: (synopsis ?? '').trim(), notes: notesText, status: mapStatus(statuses.get(statusId ?? '')), hasFile: rtf !== null };
  };

  const titleOf = (item: Element) => (kid(item, 'Title')?.textContent ?? '').trim() || 'Untitled';
  const children = (item: Element) => {
    const c = kid(item, 'Children');
    return c ? kids(c, 'BinderItem') : [];
  };
  const isText = (item: Element) => item.getAttribute('Type') === 'Text';
  const isFolder = (item: Element) => ['Folder', 'DraftFolder', 'ResearchFolder'].includes(item.getAttribute('Type') ?? '');

  /** Any non-text research item (image, PDF, web page…) is counted and skipped. */
  const skippable = (item: Element) => !isText(item) && !isFolder(item);

  /** Manuscript items. depth 0 = directly inside the Draft folder. */
  const manuscript = async (item: Element, inPart: boolean): Promise<ImportNode | null> => {
    if (skippable(item)) {
      skippedFiles++;
      return null;
    }
    const sub = children(item);
    const data = await loadItem(item);
    if (isText(item) && !data.hasFile && !sub.length) missing++;
    const base = { synopsis: data.synopsis, notes: data.notes, status: data.status };
    const t = titleOf(item);
    const hasContainers = sub.some((c) => isFolder(c) || children(c).length > 0);
    // A folder holding folders is a part (unless we're already inside one).
    if (!inPart && sub.length && hasContainers && (isFolder(item) || isPartTitle(t))) {
      const part = makeNode('part', partTitle(t), data.blocks, base);
      for (const c of sub) {
        const n = await manuscript(c, true);
        if (n) part.children.push(n);
      }
      return part;
    }
    if (isFolder(item) || sub.length) {
      const info = classifyTitle(t, true);
      const chapter = makeNode('chapter', info.kind === 'chapter' ? info.title : t, data.blocks, { ...base, special: info.special, specialLabel: info.specialLabel });
      const addScenes = async (list: Element[]) => {
        for (const c of list) {
          if (skippable(c)) {
            skippedFiles++;
            continue;
          }
          const cd = await loadItem(c);
          if (isText(c)) chapter.children.push(makeNode('scene', titleOf(c), cd.blocks, { synopsis: cd.synopsis, notes: cd.notes, status: cd.status }));
          // Deeper folders inside a chapter: keep their scenes in order.
          await addScenes(children(c));
        }
      };
      await addScenes(sub);
      return chapter;
    }
    return makeNode('scene', t, data.blocks, base);
  };

  /** Everything outside the manuscript keeps its shape as notes. */
  const notesTree = async (item: Element): Promise<ImportNode | null> => {
    if (skippable(item)) {
      skippedFiles++;
      return null;
    }
    const data = await loadItem(item);
    const node = makeNode('note', titleOf(item), data.blocks, { synopsis: data.synopsis, notes: data.notes });
    for (const c of children(item)) {
      const n = await notesTree(c);
      if (n) node.children.push(n);
    }
    return node;
  };

  const binder = doc.getElementsByTagName('Binder')[0];
  if (!binder) throw new Error('This Scrivener project has no binder.');
  const nodes: ImportNode[] = [];
  for (const item of kids(binder, 'BinderItem')) {
    const type = item.getAttribute('Type');
    if (type === 'TrashFolder') continue;
    if (type === 'DraftFolder') {
      for (const c of children(item)) {
        const n = await manuscript(c, false);
        if (n) nodes.push(n);
      }
    } else {
      const n = await notesTree(item);
      if (n) nodes.push(n);
    }
  }
  if (!nodes.length) throw new Error('This Scrivener project looks empty.');
  if (missing) warnings.push(`${missing} document${missing === 1 ? ' had' : 's had'} no text file in the folder (empty in Scrivener, or the folder was copied incompletely).`);
  if (skippedFiles) warnings.push(`${skippedFiles} image, PDF or web page item${skippedFiles === 1 ? ' was' : 's were'} left out (add them to Research by hand).`);
  warnings.push('Scrivener comments, annotations and labels aren’t imported; synopses, notes and statuses are.');
  return { kind: 'tree', format: 'scrivener', name: `${folderName}.scriv`, title, author, warnings, nodes };
}
