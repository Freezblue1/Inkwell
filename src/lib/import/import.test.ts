// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { Document as DocxDocument, FootnoteReferenceRun, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { getSchema } from '@tiptap/core';
import { Node as PMNode } from '@tiptap/pm/model';
import { buildExtensions } from '@/features/editor/extensions';
import { blocksToDoc, type ImportNode } from './blocks';
import { htmlToBlocks } from './html';
import { markdownToBlocks, plainTextToBlocks } from './text';
import { rtfToBlocks } from './rtf';
import { readDocx } from './docx';
import { readEpub } from './epub';
import { readOdt } from './odt';
import { readScrivener } from './scrivener';
import { linesToBlocks, type PdfLine } from './pdf';
import { chapterTitle, planImport, planStats, splitNumberPrefix, DEFAULT_STRUCTURE } from './structure';
import { readImport } from './index';
import { importAsNewProject, importIntoProject } from '@/db/importManuscript';
import { db } from '@/db/db';
import type { FlatSource } from './blocks';

// jsdom's Blob lacks text()/arrayBuffer(); read through FileReader like older browsers.
const readAs = (blob: Blob, how: 'text' | 'buffer') =>
  new Promise<string | ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string | ArrayBuffer);
    r.onerror = () => reject(r.error);
    if (how === 'text') r.readAsText(blob);
    else r.readAsArrayBuffer(blob);
  });
if (!Blob.prototype.text) Blob.prototype.text = function (this: Blob) { return readAs(this, 'text') as Promise<string>; };
if (!Blob.prototype.arrayBuffer) Blob.prototype.arrayBuffer = function (this: Blob) { return readAs(this, 'buffer') as Promise<ArrayBuffer>; };

const flat = (blocks: FlatSource['blocks'], extra: Partial<FlatSource> = {}): FlatSource => ({ kind: 'flat', format: 'html', name: 'test', title: '', author: '', warnings: [], blocks, ...extra });
const titles = (nodes: ImportNode[]) => nodes.map((n) => n.title);
const toArrayBuffer = (b: Uint8Array | Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

const schema = getSchema(
  buildExtensions({ onFootnoteEdit: () => {}, onCommentClick: () => {}, onMentionClick: () => {}, onUndoEmpty: () => false, onRedoEmpty: () => false }),
);
function assertValid(nodes: ImportNode[]) {
  const walk = (list: ImportNode[]) =>
    list.forEach((n) => {
      PMNode.fromJSON(schema, blocksToDoc(n.blocks)).check();
      walk(n.children);
    });
  walk(nodes);
}

describe('numbers and titles', () => {
  it('reads chapter numbers in digits, words and roman numerals', () => {
    expect(splitNumberPrefix('12: The Storm')).toEqual({ n: 12, rest: 'The Storm' });
    expect(splitNumberPrefix('Twenty-One')).toEqual({ n: 21, rest: '' });
    expect(splitNumberPrefix('XIV — Fire')).toEqual({ n: 14, rest: 'Fire' });
    expect(splitNumberPrefix('of Shadows')).toBeNull();
  });
  it('normalises chapter titles so compile numbers them', () => {
    expect(chapterTitle('Chapter Three: The Storm')).toBe('The Storm');
    expect(chapterTitle('CHAPTER SEVEN')).toBe('Chapter 7');
    expect(chapterTitle('IV')).toBe('Chapter 4');
    expect(chapterTitle('3. Into the Dark')).toBe('Into the Dark');
    expect(chapterTitle('The Lighthouse')).toBe('The Lighthouse');
  });
});

describe('HTML and structure', () => {
  const html = `
    <html><head><title>Salt</title><style>.c1{font-weight:700}.c2{font-style:italic}.c9{text-align:center}</style></head><body>
      <b style="font-weight:normal" id="docs-internal-guid-1">
      <p class="title">The Salt Archive</p>
      <h1>Contents</h1><p>Prologue</p><p>Chapter 1</p><p>Chapter 2</p>
      <h1>Prologue</h1><p>The sea kept <span class="c2">everything</span>.</p>
      <h1>Chapter 1</h1><h1>The Archive</h1>
      <p>Mara opened the <span class="c1">door</span>.<sup><a href="#ftnt1" id="ftnt_ref1">[1]</a></sup></p>
      <p class="c9">* * *</p>
      <p>Later, the lamps went out.</p>
      <h1>Chapter Two: Low Tide</h1><p>Water everywhere.</p>
      <h1>Acknowledgements</h1><p>Thanks to everyone.</p>
      </b>
      <hr><div><p><a href="#ftnt_ref1" id="ftnt1">[1]</a> The door was older than the house.</p></div>
    </body></html>`;

  it('keeps Google Docs styling and footnotes', () => {
    const { blocks } = htmlToBlocks(html);
    const door = blocks.find((b) => b.type === 'para' && b.inl.some((i) => i.kind === 'text' && i.text === 'door'));
    expect(door && door.type === 'para' && door.inl.find((i) => i.kind === 'text' && i.text === 'door')).toMatchObject({ marks: ['bold'] });
    const note = blocks.flatMap((b) => (b.type === 'para' ? b.inl : [])).find((i) => i.kind === 'footnote');
    expect(note).toEqual({ kind: 'footnote', text: 'The door was older than the house.' });
    // The footnote body itself is not imported as text.
    expect(blocks.some((b) => b.type === 'para' && b.inl.some((i) => i.kind === 'text' && i.text.includes('older than the house')))).toBe(false);
  });

  it('finds the title, a prologue, chapters, scenes and back matter, and skips the contents', () => {
    const { blocks } = htmlToBlocks(html);
    const plan = planImport(flat(blocks));
    expect(plan.title).toBe('The Salt Archive');
    expect(titles(plan.nodes)).toEqual(['Prologue', 'The Archive', 'Low Tide', 'Acknowledgements']);
    expect(plan.nodes[0]).toMatchObject({ kind: 'chapter', special: 'prologue' });
    expect(plan.nodes[1].children.map((c) => c.title)).toEqual(['Scene 1', 'Scene 2']);
    expect(plan.nodes[3].kind).toBe('backmatter');
    expect(plan.warnings.some((w) => /table of contents/.test(w))).toBe(true);
    assertValid(plan.nodes);
  });

  it('can keep scene breaks inside one scene and turn off matter detection', () => {
    const { blocks } = htmlToBlocks(html);
    const plan = planImport(flat(blocks), { ...DEFAULT_STRUCTURE, scenes: 'keep', matter: false });
    const archive = plan.nodes.find((n) => n.title === 'The Archive')!;
    expect(archive.children).toHaveLength(1);
    expect(archive.children[0].blocks.some((b) => b.type === 'sceneBreak')).toBe(true);
    expect(plan.nodes.find((n) => n.title === 'Prologue')?.special ?? null).toBeNull();
  });

  it('joins an unstyled “Chapter 1” line with the heading under it (Google Docs paste)', () => {
    const { blocks } = htmlToBlocks(
      '<b style="font-weight:normal" id="docs-internal-guid-1"><p><span style="font-weight:700">Chapter 1</span></p><h1>The Letter</h1><p><span style="font-style:italic">Dear Ann,</span> she wrote.</p><h1>Chapter 2: Silence</h1><p>Weeks.</p></b>',
    );
    const plan = planImport(flat(blocks));
    expect(plan.title).toBe('');
    expect(titles(plan.nodes)).toEqual(['The Letter', 'Silence']);
    expect(plan.warnings.some((w) => /title page/.test(w))).toBe(false);
    expect(JSON.stringify(blocksToDoc(plan.nodes[0].children[0].blocks))).toContain('"type":"italic"');
  });

  it('groups chapters under parts', () => {
    const { blocks } = htmlToBlocks('<h1>Part One</h1><h2>Chapter 1</h2><p>A.</p><h2>Chapter 2</h2><p>B.</p><h1>Part Two: Return</h1><h2>Chapter 3</h2><p>C.</p>');
    const plan = planImport(flat(blocks));
    expect(titles(plan.nodes)).toEqual(['Part 1', 'Part 2: Return']);
    expect(titles(plan.nodes[0].children)).toEqual(['Chapter 1', 'Chapter 2']);
    expect(planStats(plan.nodes)).toMatchObject({ parts: 2, chapters: 3, scenes: 3 });
  });
});

describe('Markdown and plain text', () => {
  it('reads front matter, headings, a lone # scene break and italics', () => {
    const md = ['---', 'title: "Night Ferry"', 'author: R. Vale', '---', '', '## Chapter 1', '', 'The *ferry* left late.', '', '#', '', 'Dawn came.', '', '## Chapter 2', '', 'Fog.'].join('\n');
    const r = markdownToBlocks(md);
    const plan = planImport(flat(r.blocks, { title: r.title, author: r.author }));
    expect(plan.title).toBe('Night Ferry');
    expect(plan.author).toBe('R. Vale');
    expect(titles(plan.nodes)).toEqual(['Chapter 1', 'Chapter 2']);
    expect(plan.nodes[0].children).toHaveLength(2);
    const doc = blocksToDoc(plan.nodes[0].children[0].blocks);
    expect(JSON.stringify(doc)).toContain('"type":"italic"');
  });

  it('splits plain text at “CHAPTER ONE” lines and joins hard-wrapped lines', () => {
    const txt = 'CHAPTER ONE\n\nIt was a dark\nand stormy night.\n\nThe end of it.\n\nCHAPTER TWO\n\nMorning.';
    const plan = planImport(flat(plainTextToBlocks(txt), { format: 'text' }));
    expect(titles(plan.nodes)).toEqual(['Chapter 1', 'Chapter 2']);
    const first = plan.nodes[0].children[0].blocks[0];
    expect(first.type === 'para' && first.inl[0].kind === 'text' && first.inl[0].text).toBe('It was a dark and stormy night.');
  });
});

describe('RTF', () => {
  it('reads formatting, special characters, footnotes and strips Scrivener tags', () => {
    const rtf = String.raw`{\rtf1\ansi\ansicpg1252{\fonttbl\f0 Times;}{\colortbl;\red0\green0\blue0;}
\pard\qc Chapter One\par
\pard <$Scr_Ps::0>Caf\'e9 \b bold\b0  and \i italic\i0 \u8212\'97done{\footnote \chftn A note.}<!$Scr_Ps::0>\par
* * *\par
Last\line line.\par}`;
    const blocks = rtfToBlocks(rtf);
    const paras = blocks.filter((b) => b.type === 'para');
    expect(paras[0]).toMatchObject({ align: 'center' });
    const second = paras[1];
    expect(second.type === 'para' && second.inl.map((i) => (i.kind === 'text' ? i.text : i.kind)).join('|')).toBe('Café |bold| and |italic|—done|footnote');
    expect(second.type === 'para' && second.inl.find((i) => i.kind === 'footnote')).toEqual({ kind: 'footnote', text: 'A note.' });
    const doc = blocksToDoc(blocks);
    expect(doc.content!.some((n) => n.type === 'sceneBreak')).toBe(true);
    expect(JSON.stringify(doc)).toContain('hardBreak');
    expect(JSON.stringify(doc)).not.toContain('Scr_');
  });
});

describe('Word (.docx)', () => {
  it('imports headings, italics and footnotes through mammoth', async () => {
    const doc = new DocxDocument({
      footnotes: { 1: { children: [new Paragraph('A footnote.')] } },
      sections: [
        {
          children: [
            new Paragraph({ text: 'My Book', heading: HeadingLevel.TITLE }),
            new Paragraph({ text: 'Chapter 1', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun('It was '), new TextRun({ text: 'very', italics: true }), new TextRun(' cold.'), new FootnoteReferenceRun(1)] }),
            new Paragraph('***'),
            new Paragraph('Morning.'),
            new Paragraph({ text: 'Chapter 2', heading: HeadingLevel.HEADING_1 }),
            new Paragraph('Night.'),
          ],
        },
      ],
    });
    const buf = await Packer.toBuffer(doc);
    const src = await readDocx(toArrayBuffer(buf), 'my-book.docx');
    const plan = planImport(src);
    expect(plan.title).toBe('My Book');
    expect(titles(plan.nodes)).toEqual(['Chapter 1', 'Chapter 2']);
    expect(plan.nodes[0].children).toHaveLength(2);
    const json = JSON.stringify(blocksToDoc(plan.nodes[0].children[0].blocks));
    expect(json).toContain('"type":"italic"');
    expect(json).toContain('"text":"A footnote."');
    assertValid(plan.nodes);
  });
});

describe('EPUB (Reedsy Studio and others)', () => {
  it('uses the table of contents for parts and chapter titles', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Tide Book</dc:title><dc:creator>A. Writer</dc:creator></metadata>
      <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cr" href="text/copyright.xhtml" media-type="application/xhtml+xml"/><item id="p1" href="text/part1.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/></manifest>
      <spine><itemref idref="nav" linear="no"/><itemref idref="cr"/><itemref idref="p1"/><itemref idref="c1"/><itemref idref="c2"/></spine></package>`,
    );
    zip.file(
      'OEBPS/nav.xhtml',
      `<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="text/copyright.xhtml">Copyright</a></li><li><a href="text/part1.xhtml">Part One</a><ol><li><a href="text/ch1.xhtml">The Harbour</a></li><li><a href="text/ch2.xhtml">Storm Wall</a></li></ol></li></ol></nav></body></html>`,
    );
    zip.file('OEBPS/text/copyright.xhtml', '<html><body><p>© 2026 A. Writer</p></body></html>');
    zip.file('OEBPS/text/part1.xhtml', '<html><body><h1>Part One</h1></body></html>');
    zip.file('OEBPS/text/ch1.xhtml', '<html><body><p class="chapter-number">1</p><h1 class="chapter-title">The Harbour</h1><p>Boats.</p><p class="scene-break">#</p><p>More boats.</p></body></html>');
    zip.file('OEBPS/text/ch2.xhtml', '<html><body><h1>2</h1><h2>Storm Wall</h2><p>Waves.</p></body></html>');
    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const src = await readEpub(data, 'tide.epub');
    const plan = planImport(src);
    expect(plan.title).toBe('Tide Book');
    expect(plan.author).toBe('A. Writer');
    expect(plan.nodes.map((n) => `${n.kind}:${n.title}`)).toEqual(['frontmatter:Copyright', 'part:Part 1']);
    expect(titles(plan.nodes[1].children)).toEqual(['The Harbour', 'Storm Wall']);
    expect(plan.nodes[1].children[0].children).toHaveLength(2);
    // Chapter number and title lines at the top of each file are not repeated as text.
    const firstText = plan.nodes[1].children[1].children[0].blocks[0];
    expect(firstText.type === 'para' && firstText.inl[0].kind === 'text' && firstText.inl[0].text).toBe('Waves.');
  });
});

describe('OpenDocument (.odt)', () => {
  it('reads headings, styled spans and notes', async () => {
    const zip = new JSZip();
    zip.file(
      'content.xml',
      `<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
      <office:automatic-styles><style:style style:name="T1" style:family="text"><style:text-properties fo:font-style="italic"/></style:style></office:automatic-styles>
      <office:body><office:text>
        <text:h text:outline-level="1">Chapter 1</text:h>
        <text:p>She ran <text:span text:style-name="T1">fast</text:span>.<text:note text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body><text:p>Very fast.</text:p></text:note-body></text:note></text:p>
        <text:h text:outline-level="1">Chapter 2</text:h><text:p>Rest.</text:p>
      </office:text></office:body></office:document-content>`,
    );
    const src = await readOdt(await zip.generateAsync({ type: 'arraybuffer' }), 'book.odt');
    const plan = planImport(src);
    expect(titles(plan.nodes)).toEqual(['Chapter 1', 'Chapter 2']);
    const json = JSON.stringify(blocksToDoc(plan.nodes[0].children[0].blocks));
    expect(json).toContain('"type":"italic"');
    expect(json).toContain('"text":"Very fast."');
  });
});

describe('Scrivener', () => {
  const rtf = (text: string) => `{\\rtf1\\ansi{\\fonttbl\\f0 Cochin;}\\pard ${text}\\par}`;
  const scrivx = `<?xml version="1.0" encoding="UTF-8"?>
  <ScrivenerProject Version="2.0" Identifier="X">
    <Binder>
      <BinderItem UUID="D" Type="DraftFolder"><Title>Manuscript</Title><Children>
        <BinderItem UUID="C1" Type="Folder"><Title>Chapter One</Title><Children>
          <BinderItem UUID="S1" Type="Text"><Title>Arrival</Title><MetaData><StatusID>2</StatusID></MetaData></BinderItem>
          <BinderItem UUID="S2" Type="Text"><Title>Night</Title></BinderItem>
        </Children></BinderItem>
        <BinderItem UUID="E" Type="Folder"><Title>Epilogue</Title><Children>
          <BinderItem UUID="S3" Type="Text"><Title>After</Title></BinderItem>
        </Children></BinderItem>
      </Children></BinderItem>
      <BinderItem UUID="R" Type="ResearchFolder"><Title>Research</Title><Children>
        <BinderItem UUID="N1" Type="Text"><Title>Castle notes</Title></BinderItem>
        <BinderItem UUID="IMG" Type="Image"><Title>Map</Title></BinderItem>
      </Children></BinderItem>
      <BinderItem UUID="T" Type="TrashFolder"><Title>Trash</Title></BinderItem>
    </Binder>
    <StatusSettings><StatusItems><Status ID="1">To Do</Status><Status ID="2">First Draft</Status></StatusItems></StatusSettings>
  </ScrivenerProject>`;
  const file = (path: string, text: string) => ({ path: `Novel.scriv/${path}`, blob: new Blob([text]) });

  it('turns folders into chapters and documents into scenes, with synopses, statuses and notes', async () => {
    const files = [
      file('Novel.scrivx', scrivx),
      file('Files/Data/S1/content.rtf', rtf('They \\i arrived\\i0 .')),
      file('Files/Data/S1/synopsis.txt', 'Mara reaches the island.'),
      file('Files/Data/S2/content.rtf', rtf('Dark.')),
      file('Files/Data/S3/content.rtf', rtf('Years later.')),
      file('Files/Data/N1/content.rtf', rtf('Built 1302.')),
    ];
    const src = await readImport(files);
    expect(src.kind).toBe('tree');
    const plan = planImport(src);
    expect(plan.title).toBe('Novel');
    expect(plan.nodes.map((n) => `${n.kind}:${n.title}`)).toEqual(['chapter:Chapter 1', 'chapter:Epilogue', 'note:Research']);
    expect(plan.nodes[0].children.map((c) => c.title)).toEqual(['Arrival', 'Night']);
    expect(plan.nodes[0].children[0]).toMatchObject({ synopsis: 'Mara reaches the island.', status: 'Draft' });
    expect(plan.nodes[1]).toMatchObject({ special: 'epilogue' });
    expect(plan.nodes[2].children.map((c) => c.title)).toEqual(['Castle notes']);
    expect(plan.warnings.some((w) => /image, PDF/.test(w))).toBe(true);
    assertValid(plan.nodes);
  });

  it('asks for the folder when only the .scrivx file is chosen', async () => {
    await expect(readImport([{ path: 'Novel.scrivx', blob: new Blob([scrivx]) }])).rejects.toThrow(/\.scriv/);
  });

  it('reads Scrivener 2 projects (Files/Docs/<id>.rtf)', async () => {
    const v2 = `<?xml version="1.0"?><ScrivenerProject Version="1.5"><Binder><BinderItem ID="0" Type="DraftFolder"><Title>Draft</Title><Children><BinderItem ID="3" Type="Text"><Title>Only scene</Title></BinderItem></Children></BinderItem></Binder></ScrivenerProject>`;
    const src = await readScrivener([{ path: 'Old.scriv/Old.scrivx', blob: new Blob([v2]) }, { path: 'Old.scriv/Files/Docs/3.rtf', blob: new Blob([rtf('Hello there.')]) }], 'Old');
    const plan = planImport(src);
    expect(plan.nodes.map((n) => `${n.kind}:${n.title}`)).toEqual(['scene:Only scene']);
    expect(plan.nodes[0].blocks[0]).toMatchObject({ type: 'para' });
  });
});

describe('several files at once', () => {
  it('makes one chapter per file, in natural name order', async () => {
    const files = [
      { path: '10-ending.md', blob: new Blob(['# The End\n\nGoodbye.']) },
      { path: '2-middle.txt', blob: new Blob(['Halfway.']) },
      { path: '1-start.md', blob: new Blob(['Hello.']) },
    ];
    const plan = planImport(await readImport(files));
    expect(titles(plan.nodes)).toEqual(['start', 'middle', 'The End']);
  });
});

describe('PDF layout', () => {
  const line = (text: string, y: number, opts: Partial<PdfLine> = {}): PdfLine => ({ text, x: 72, xEnd: 72 + text.length * 5.5, y, size: 11, ...opts });
  it('rebuilds headings and paragraphs and drops page numbers and running heads', () => {
    const full = 'x'.repeat(80);
    const pages: PdfLine[][] = [];
    for (let p = 1; p <= 4; p++) {
      pages.push([
        line('THE SALT ARCHIVE', 40, { x: 250 }),
        ...(p === 1 ? [line('Chapter One', 120, { size: 20, x: 220 })] : []),
        line(`Para ${p} starts here and ${full}`, 160, { x: 90 }),
        line(`continues with a hyphen- ${full}`, 174),
        line('ation and ends.', 188, { xEnd: 160 }),
        line(`Another para ${full}`, 202, { x: 90 }),
        line('that ends.', 216, { xEnd: 150 }),
        line(String(p), 760, { x: 300 }),
      ]);
    }
    const blocks = linesToBlocks(pages);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
    const texts = blocks.filter((b) => b.type === 'para').map((b) => (b.type === 'para' && b.inl[0].kind === 'text' ? b.inl[0].text : ''));
    expect(texts).toHaveLength(8);
    expect(texts[0].endsWith('hyphenation and ends.')).toBe(false);
    expect(texts[0]).toContain('hyphen- ');
    expect(texts.join(' ')).not.toContain('THE SALT ARCHIVE');
    expect(texts.some((t) => /^\d$/.test(t))).toBe(false);
    const plan = planImport(flat(blocks, { format: 'pdf' }));
    expect(titles(plan.nodes)).toEqual(['Chapter 1']);
  });
  it('keeps a big title that repeats the small running head', () => {
    const full = 'z'.repeat(100);
    const pages: PdfLine[][] = [[line('The Lantern Road', 220, { size: 26, x: 120 }), line('a novel', 250, { size: 13, x: 190 })]];
    for (let p = 2; p <= 5; p++) {
      pages.push([
        line('THE LANTERN ROAD', 36, { size: 9, x: 170 }),
        line(`Text ${full}`, 100, { x: 90 }),
        line(`more ${full}`, 114),
        line('ends.', 128, { xEnd: 110 }),
        line(`Again ${full}`, 142, { x: 90 }),
        line(`more ${full}`, 156),
        line(String(p), 620, { size: 9, x: 210 }),
      ]);
    }
    const blocks = linesToBlocks(pages);
    const plan = planImport(flat(blocks, { format: 'pdf' }));
    expect(plan.title).toBe('The Lantern Road');
  });

  it('joins words hyphenated across lines', () => {
    const full = 'y'.repeat(80);
    const blocks = linesToBlocks([[line(`Start ${full} remark-`, 100, { x: 90 }), line('able finish.', 114, { xEnd: 140 }), line(`Next ${full}`, 128, { x: 90 }), line('end.', 142, { xEnd: 100 })]]);
    const first = blocks[0];
    expect(first.type === 'para' && first.inl[0].kind === 'text' && first.inl[0].text.endsWith('remarkable finish.')).toBe(true);
  });
});

describe('writing to the database', () => {
  const sample = () => planImport(flat(htmlToBlocks('<h1>Prologue</h1><p>Before.</p><h1>Chapter 1</h1><p>One two three.</p><hr><p>Four five.</p><h1>Acknowledgements</h1><p>Thanks.</p>').blocks));

  it('creates a new project with chapters, scenes, special chapters and word counts', async () => {
    const id = await importAsNewProject(sample(), { title: 'Imported', author: 'Me' });
    const project = await db.projects.get(id);
    expect(project).toMatchObject({ title: 'Imported', author: 'Me' });
    const docs = await db.documents.where('projectId').equals(id).toArray();
    const byTitle = (t: string) => docs.find((d) => d.title === t)!;
    expect(byTitle('Prologue')).toMatchObject({ type: 'chapter' });
    expect(byTitle('Prologue').metadata.special).toBe('prologue');
    expect(byTitle('Acknowledgements').type).toBe('backmatter');
    const scenes = docs.filter((d) => d.type === 'scene' && d.parentId === byTitle('Chapter 1').id);
    expect(scenes.map((s) => s.wordCount).sort()).toEqual([2, 3]);
    expect(await db.goals.get(id)).toBeTruthy();
  });

  it('appends into an existing project after its current items, skipping unticked ones', async () => {
    const id = await importAsNewProject(sample(), { title: 'Base', author: '' });
    const before = await db.documents.where('projectId').equals(id).toArray();
    const plan = sample();
    plan.nodes[0].include = false; // the prologue
    const res = await importIntoProject(id, plan);
    expect(res.created).toBe(4); // chapter + 2 scenes + acknowledgements
    const after = await db.documents.where('projectId').equals(id).toArray();
    const added = after.filter((d) => !before.some((b) => b.id === d.id));
    const maxBefore = Math.max(...before.filter((d) => d.parentId === null).map((d) => d.order));
    expect(added.filter((d) => d.parentId === null).every((d) => d.order > maxBefore)).toBe(true);
    expect(added.some((d) => d.title === 'Prologue')).toBe(false);
    expect(await db.contents.get(res.firstId!)).toBeTruthy();
  });
});
