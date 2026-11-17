/** Word (.docx) — also what Google Docs, Reedsy Studio and Scrivener can export. */
import { htmlToBlocks } from './html';
import type { FlatSource } from './blocks';

/** Common manuscript style names mapped onto headings so chapters are found. */
const STYLE_MAP = [
  "p[style-name='Title'] => h1.title:fresh",
  "p[style-name='Book Title'] => h1.title:fresh",
  "p[style-name='Subtitle'] => p.subtitle:fresh",
  "p[style-name='Chapter Title'] => h1:fresh",
  "p[style-name='Chapter Heading'] => h1:fresh",
  "p[style-name='Chapter'] => h1:fresh",
  "p[style-name='Part Title'] => h1:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "p[style-name='Block Text'] => blockquote > p:fresh",
  "p[style-name='Scene Break'] => p.scene-break:fresh",
  "p[style-name='Separator'] => p.scene-break:fresh",
  'u => u',
  'strike => s',
  "r[style-name='Emphasis'] => em",
  "r[style-name='Strong'] => strong",
];

export async function readDocx(data: ArrayBuffer, name: string): Promise<FlatSource> {
  const mammoth = (await import('mammoth')).default;
  // The browser build reads `arrayBuffer`; under Node (tests) mammoth wants a Buffer.
  const NodeBuffer = (globalThis as { Buffer?: { from(d: ArrayBuffer): unknown } }).Buffer;
  const input = NodeBuffer ? { arrayBuffer: data, buffer: NodeBuffer.from(data) } : { arrayBuffer: data };
  const res = await mammoth.convertToHtml(
    input as { arrayBuffer: ArrayBuffer },
    {
      styleMap: STYLE_MAP,
      includeDefaultStyleMap: true,
      // Pictures aren't part of the manuscript text; drop them instead of embedding megabytes.
      convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
    },
  );
  const html = htmlToBlocks(res.value);
  const warnings: string[] = [];
  if (html.images) warnings.push(`${html.images} picture${html.images === 1 ? ' was' : 's were'} left out (Inkwell's manuscript is text only; add pictures to Research).`);
  return { kind: 'flat', format: 'docx', name, title: '', author: '', warnings, blocks: html.blocks };
}
