/** Prints the paginated book through a hidden iframe (use "Save as PDF" for a high-fidelity PDF). */
import type { CompiledBook } from '@/lib/compile/compile';
import { escapeXml } from '@/lib/export/html';
import { bookCss, pageGeometry, paginate } from './paginate';

export function printBook(book: CompiledBook): void {
  const first = paginate(book);
  const { pages } = book.profile.toc ? paginate(book, Infinity, first.openings) : first;
  const g = pageGeometry(book);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(book.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Tinos:ital,wght@0,400;0,700;1,400&display=swap">
<style>@page { size: ${g.w / 96}in ${g.h / 96}in; margin: 0; } body { margin: 0; } .ink-page { page-break-after: always; break-after: page; }
${bookCss(book)}</style></head><body class="ink-book">${pages
    .map(
      (p) =>
        `<div class="ink-page ${p.number % 2 === 0 ? 'verso' : 'recto'}">${p.header ? `<div class="ink-head">${p.header}</div>` : ''}<div class="ink-body">${p.html}</div>${p.footer ? `<div class="ink-foot">${p.footer}</div>` : ''}</div>`,
    )
    .join('')}</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 60_000);
  };
  // Wait for web fonts so the printout matches the preview.
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) void fonts.ready.then(() => setTimeout(go, 100));
  else setTimeout(go, 800);
}
