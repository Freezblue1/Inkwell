import type { Node as PMNode } from '@tiptap/pm/model';

/** Placeholder character used for inline atoms so string offsets map 1:1 to positions. */
export const LEAF = '￼';

/**
 * Calls `fn` for every textblock with its text and the document position of
 * its first character. Offsets in `text` map directly to positions:
 * pos = start + offset.
 */
export function forEachTextblock(doc: PMNode, fn: (text: string, start: number, node: PMNode) => void): void {
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    node.forEach((child) => {
      text += child.isText ? child.text ?? '' : LEAF.repeat(child.nodeSize);
    });
    fn(text, pos + 1, node);
    return false;
  });
}

/** Text of a single textblock with the same 1:1 offset mapping. */
export function textblockText(node: PMNode): string {
  let text = '';
  node.forEach((child) => {
    text += child.isText ? child.text ?? '' : LEAF.repeat(child.nodeSize);
  });
  return text;
}

/** Plain text used for word counting (mentions count, footnotes don't). Mirrors lib/text docToCountableText. */
export function pmCountableText(doc: PMNode): string {
  const blocks: string[] = [];
  doc.descendants((node) => {
    if (!node.isTextblock) return true;
    let t = '';
    node.forEach((child) => {
      if (child.isText) t += child.text ?? '';
      else if (child.type.name === 'mention') t += String(child.attrs.label ?? '');
      else if (child.type.name === 'hardBreak') t += '\n';
    });
    blocks.push(t);
    return false;
  });
  return blocks.join('\n\n');
}
