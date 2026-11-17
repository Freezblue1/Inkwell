/**
 * A small RTF reader: paragraphs, bold/italic/underline/strike, alignment,
 * line breaks, Unicode and code-page characters, and footnotes. Enough for
 * Scrivener documents and Word/Google Docs/TextEdit .rtf files. Pictures,
 * tables of fonts/colours/styles and other metadata are skipped.
 */
import { tidyInlines, type Align, type Block, type Inline, type Mark } from './blocks';

interface State {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  skip: boolean;
  uc: number;
  /** Collects footnote text while inside a {\footnote …} group. */
  note: string[] | null;
}

const SKIP_DESTINATIONS = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'headerl', 'headerr', 'headerf', 'footer', 'footerl', 'footerr', 'footerf',
  'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl', 'mmathpr', 'themedata', 'colorschememapping', 'latentstyles',
  'datastore', 'fldinst', 'object', 'objdata', 'bkmkstart', 'bkmkend', 'annotation', 'atnid', 'atnauthor', 'atndate', 'atnref', 'atrfstart', 'atrfend',
  'shp', 'shpinst', 'nonshppict', 'blipuid', 'pgdsctbl', 'revtbl', 'filetbl', 'userprops', 'docvar', 'expandedcolortbl', 'listtext', 'pntext', 'pntxta', 'pntxtb',
  'scrv_annot', 'ftnsep', 'ftnsepc', 'aftnsep', 'aftnsepc', 'template', 'company', 'operator', 'author', 'title', 'comment',
]);

const SPECIAL_CHARS: Record<string, string> = {
  emdash: '—', endash: '–', lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”', bullet: '•', emspace: ' ', enspace: ' ', qmspace: ' ',
};

let cp1252: TextDecoder | null = null;
function decodeByte(byte: number): string {
  if (byte < 128) return String.fromCharCode(byte);
  try {
    cp1252 ??= new TextDecoder('windows-1252');
    return cp1252.decode(new Uint8Array([byte]));
  } catch {
    return String.fromCharCode(byte);
  }
}

/** Removes Scrivener's inline style tags such as <$Scr_Ps::0> … <!$Scr_Ps::0>. */
export function stripScrivenerTags(text: string): string {
  return text.replace(/<!?\$Scr_[A-Za-z]+::\d+>/g, '').replace(/<\$[A-Za-z_]+>/g, (m) => (/^<\$(n|r|R|t|p)>$/.test(m) ? m : ''));
}

export function rtfToBlocks(rtf: string): Block[] {
  const blocks: Block[] = [];
  let inl: Inline[] = [];
  let align: Align | undefined;
  let st: State = { bold: false, italic: false, underline: false, strike: false, skip: false, uc: 1, note: null };
  const stack: State[] = [];
  let skipChars = 0;
  /** Set right after "{\*": the group is skipped unless the next word is understood. */
  let starPending = false;

  const emit = (text: string) => {
    if (skipChars > 0) {
      const drop = Math.min(skipChars, text.length);
      skipChars -= drop;
      text = text.slice(drop);
      if (!text) return;
    }
    if (st.skip) return;
    if (st.note) {
      st.note.push(text);
      return;
    }
    const marks: Mark[] = [];
    if (st.bold) marks.push('bold');
    if (st.italic) marks.push('italic');
    if (st.underline) marks.push('underline');
    if (st.strike) marks.push('strike');
    inl.push({ kind: 'text', text, marks: marks.length ? marks : undefined });
  };

  const endPara = () => {
    const cleaned = tidyInlines(inl.map((i) => (i.kind === 'text' ? { ...i, text: stripScrivenerTags(i.text) } : i)));
    blocks.push({ type: 'para', inl: cleaned, align });
    inl = [];
  };

  let i = 0;
  const n = rtf.length;
  while (i < n) {
    const c = rtf[i];
    if (c === '{') {
      stack.push(st);
      st = { ...st };
      i++;
      continue;
    }
    if (c === '}') {
      const closing = st;
      st = stack.pop() ?? st;
      // Leaving a footnote group: attach the note to the paragraph.
      if (closing.note && closing.note !== st.note) {
        const text = closing.note.join('').replace(/\s+/g, ' ').trim();
        if (text && !st.skip) inl.push({ kind: 'footnote', text: stripScrivenerTags(text) });
      }
      starPending = false;
      i++;
      continue;
    }
    if (c === '\r' || c === '\n') {
      i++;
      continue;
    }
    if (c !== '\\') {
      let j = i;
      while (j < n && rtf[j] !== '\\' && rtf[j] !== '{' && rtf[j] !== '}' && rtf[j] !== '\r' && rtf[j] !== '\n') j++;
      emit(rtf.slice(i, j));
      starPending = false;
      i = j;
      continue;
    }
    // Control sequence.
    const next = rtf[i + 1];
    if (next === undefined) break;
    if (next === '\\' || next === '{' || next === '}') {
      emit(next);
      i += 2;
      continue;
    }
    if (next === '*') {
      starPending = true;
      i += 2;
      continue;
    }
    if (next === "'") {
      const byte = parseInt(rtf.slice(i + 2, i + 4), 16);
      if (!Number.isNaN(byte)) emit(decodeByte(byte));
      i += 4;
      continue;
    }
    if (next === '~') {
      emit(' ');
      i += 2;
      continue;
    }
    if (next === '-') {
      i += 2;
      continue;
    }
    if (next === '_') {
      emit('‑');
      i += 2;
      continue;
    }
    if (next === '\r' || next === '\n') {
      // "\<newline>" is a paragraph break.
      if (!st.skip && !st.note) endPara();
      i += 2;
      continue;
    }
    const m = /^([a-zA-Z][a-zA-Z_]*)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40));
    if (!m) {
      i += 2;
      continue;
    }
    i += 1 + m[0].length;
    const word = m[1].toLowerCase();
    const arg = m[2] === undefined ? null : Number(m[2]);

    if (starPending) {
      starPending = false;
      if (word !== 'footnote' && word !== 'scrv_fn') {
        st.skip = true;
        continue;
      }
    }
    if (SKIP_DESTINATIONS.has(word)) {
      st.skip = true;
      continue;
    }
    switch (word) {
      case 'footnote':
      case 'scrv_fn':
        st.note = [];
        break;
      case 'par':
      case 'sect':
        if (!st.skip && !st.note) endPara();
        else if (st.note) st.note.push(' ');
        break;
      case 'line':
        if (!st.skip && !st.note) inl.push({ kind: 'break' });
        break;
      case 'page':
        if (!st.skip && !st.note) {
          endPara();
          blocks.push({ type: 'pageBreak' });
        }
        break;
      case 'tab':
        emit(' ');
        break;
      case 'cell':
      case 'row':
        if (!st.skip && !st.note) endPara();
        break;
      case 'pard':
        align = undefined;
        break;
      case 'qc':
        align = 'center';
        break;
      case 'qr':
        align = 'right';
        break;
      case 'qj':
        align = 'justify';
        break;
      case 'ql':
        align = undefined;
        break;
      case 'plain':
        st.bold = st.italic = st.underline = st.strike = false;
        break;
      case 'b':
        st.bold = arg !== 0;
        break;
      case 'i':
        st.italic = arg !== 0;
        break;
      case 'ul':
        st.underline = arg !== 0;
        break;
      case 'ulnone':
        st.underline = false;
        break;
      case 'strike':
      case 'striked':
        st.strike = arg !== 0;
        break;
      case 'uc':
        st.uc = arg ?? 1;
        break;
      case 'u': {
        let code = arg ?? 0;
        if (code < 0) code += 65536;
        emit(String.fromCharCode(code));
        skipChars = st.uc;
        break;
      }
      case 'chftn':
      case 'end_scrv_fn':
      case 'end_scrv_annot':
        break;
      default:
        if (SPECIAL_CHARS[word]) emit(SPECIAL_CHARS[word]);
        else if (word === 'fldrslt') {
          /* field result: keep its text */
        }
    }
  }
  if (inl.length) endPara();
  return blocks;
}
