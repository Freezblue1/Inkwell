/** Hand-rolled EPUB 3 builder (JSZip): valid container, OPF, nav, NCX and XHTML. */
import JSZip from 'jszip';
import type { CompiledBook } from '../compile/compile';
import { blocksToHtmlList, escapeXml, notesHtml, sectionHeadingHtml } from './html';
import { newId } from '../ids';

const CSS = `
body { font-family: serif; line-height: 1.5; margin: 0 5%; }
p { margin: 0; text-indent: 1.5em; text-align: justify; }
p.first, .scene-break + p, h1 + p, h2 + p, .chapter-heading + p { text-indent: 0; }
p.scene-break { text-align: center; text-indent: 0; margin: 1em 0; letter-spacing: 0.3em; }
.chapter-heading { margin: 3em 0 2em; text-align: center; page-break-before: always; }
.chapter-heading h1 { font-size: 1.4em; font-weight: normal; letter-spacing: 0.08em; margin: 0; }
.chapter-heading h2 { font-size: 1.1em; font-style: italic; font-weight: normal; margin: 0.5em 0 0; }
.part-heading { margin-top: 30%; text-align: center; }
.part-heading h1 { font-size: 1.6em; font-weight: normal; }
.part-heading h2 { font-style: italic; font-weight: normal; }
blockquote { margin: 1em 2em; font-style: italic; }
p.dropcap::first-letter { float: left; font-size: 3.2em; line-height: 0.8; padding: 0.05em 0.08em 0 0; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { font-size: 2em; }
.dedication { text-align: center; font-style: italic; margin-top: 30%; }
.copyright { font-size: 0.8em; margin-top: 60%; text-indent: 0; }
.notes { margin-top: 2em; font-size: 0.85em; border-top: 1px solid #999; }
.notes h3 { font-size: 1em; }
a.noteref { text-decoration: none; }
nav ol { list-style: none; padding-left: 1em; }
`;

function xhtml(title: string, body: string, lang: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="UTF-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>`;
}

export async function toEpub(book: CompiledBook, lang = 'en'): Promise<Blob> {
  const p = book.profile;
  const zip = new JSZip();
  const uid = `urn:uuid:${newId()}`;
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );
  const oebps = zip.folder('OEBPS')!;
  oebps.file('style.css', CSS);

  const items: { id: string; href: string; title: string; toc: boolean; level: number }[] = [];
  const add = (id: string, title: string, body: string, toc: boolean, level = 0) => {
    const href = `${id}.xhtml`;
    oebps.file(href, xhtml(title, body, lang));
    items.push({ id, href, title, toc, level });
  };

  if (p.titlePage) {
    add('title', book.title, `<section class="title-page" epub:type="titlepage"><h1>${escapeXml(book.title)}</h1>${book.subtitle ? `<p><em>${escapeXml(book.subtitle)}</em></p>` : ''}<p>${escapeXml(book.author)}</p></section>`, false);
  }
  if (p.copyrightPage && p.copyrightText) add('copyright', 'Copyright', `<section epub:type="copyright-page"><p class="copyright">${escapeXml(p.copyrightText)}</p></section>`, false);
  if (p.dedication) add('dedication', 'Dedication', `<section class="dedication" epub:type="dedication"><p>${escapeXml(p.dedication)}</p></section>`, false);

  book.sections.forEach((s, i) => {
    const id = `section-${i + 1}`;
    const href = `${id}.xhtml`;
    const body =
      `<section epub:type="${s.kind === 'chapter' ? 'chapter' : s.kind === 'part' ? 'part' : s.kind === 'front' ? 'frontmatter' : 'backmatter'}">` +
      sectionHeadingHtml(s) +
      blocksToHtmlList(s.blocks, p.sceneBreakGlyph, { dropCaps: p.dropCaps && s.kind === 'chapter', noteHref: (n) => `${href}#note-${n}` }).join('\n') +
      notesHtml(s.notes, (n) => `${href}#ref-${n}`) +
      '</section>';
    add(id, s.tocTitle || s.heading || `Section ${i + 1}`, body, true, s.kind === 'chapter' && book.sections.some((x) => x.kind === 'part') ? 1 : 0);
  });

  const tocItems = items.filter((i) => i.toc);
  const navList = tocItems.map((i) => `<li><a href="${i.href}">${escapeXml(i.title)}</a></li>`).join('\n');
  oebps.file(
    'nav.xhtml',
    xhtml('Contents', `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${navList}</ol></nav><nav epub:type="landmarks" hidden=""><ol>${tocItems[0] ? `<li><a epub:type="bodymatter" href="${tocItems[0].href}">Start</a></li>` : ''}</ol></nav>`, lang),
  );
  oebps.file(
    'toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${uid}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
<docTitle><text>${escapeXml(book.title)}</text></docTitle>
<navMap>${tocItems.map((i, n) => `<navPoint id="np-${n + 1}" playOrder="${n + 1}"><navLabel><text>${escapeXml(i.title)}</text></navLabel><content src="${i.href}"/></navPoint>`).join('')}</navMap>
</ncx>`,
  );

  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const spineItems = [...items.slice(0, items.findIndex((i) => i.toc) < 0 ? items.length : items.findIndex((i) => i.toc))];
  const navInSpine = p.toc;
  oebps.file(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:identifier id="bookid">${uid}</dc:identifier>
  <dc:title>${escapeXml(book.title)}</dc:title>
  <dc:creator>${escapeXml(book.author || 'Unknown')}</dc:creator>
  <dc:language>${lang}</dc:language>
  <meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
  <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  <item id="css" href="style.css" media-type="text/css"/>
  ${items.map((i) => `<item id="${i.id}" href="${i.href}" media-type="application/xhtml+xml"/>`).join('\n  ')}
</manifest>
<spine toc="ncx">
  ${spineItems.map((i) => `<itemref idref="${i.id}"/>`).join('\n  ')}
  ${navInSpine ? '<itemref idref="nav"/>' : ''}
  ${items.filter((i) => !spineItems.includes(i)).map((i) => `<itemref idref="${i.id}"/>`).join('\n  ')}
</spine>
</package>`,
  );

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}
