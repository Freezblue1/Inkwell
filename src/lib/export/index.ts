/** Export entry point: compiles the open project and downloads the chosen format. */
import type { ExportProfile, ID, InkDocument, Project } from '@/types/models';
import { getContents } from '@/db/repos/documents';
import { collectCompileIds, compileBook, type CompiledBook } from '../compile/compile';
import { downloadBlob, fileSafe } from './download';

export type ExportFormat = 'docx' | 'epub' | 'pdf' | 'md' | 'txt';

export const EXPORT_FORMATS: { value: ExportFormat; label: string; description: string }[] = [
  { value: 'docx', label: 'Word (.docx)', description: 'For agents, editors and further editing' },
  { value: 'epub', label: 'EPUB', description: 'For e-readers and ebook stores' },
  { value: 'pdf', label: 'PDF', description: 'Fixed layout for print or sharing' },
  { value: 'md', label: 'Markdown', description: 'Plain text with light formatting' },
  { value: 'txt', label: 'Plain text', description: 'No formatting at all' },
];

export async function buildBook(project: Project, docs: Record<ID, InkDocument>, profile: ExportProfile): Promise<CompiledBook> {
  const rows = await getContents(collectCompileIds(docs));
  const contents = new Map([...rows].map(([id, r]) => [id, r.json]));
  return compileBook(project, docs, contents, profile);
}

export async function exportBook(book: CompiledBook, format: ExportFormat): Promise<void> {
  const name = fileSafe(book.title);
  switch (format) {
    case 'docx': {
      const { toDocx } = await import('./docx');
      downloadBlob(await toDocx(book), `${name}.docx`);
      return;
    }
    case 'epub': {
      const { toEpub } = await import('./epub');
      downloadBlob(await toEpub(book), `${name}.epub`);
      return;
    }
    case 'pdf': {
      const { toPdf } = await import('./pdf');
      downloadBlob(await toPdf(book), `${name}.pdf`);
      return;
    }
    case 'md': {
      const { toMarkdown } = await import('./markdown');
      downloadBlob(new Blob([toMarkdown(book)], { type: 'text/markdown;charset=utf-8' }), `${name}.md`);
      return;
    }
    case 'txt': {
      const { toPlainText } = await import('./markdown');
      downloadBlob(new Blob([toPlainText(book)], { type: 'text/plain;charset=utf-8' }), `${name}.txt`);
      return;
    }
  }
}
