/** Full-text search across document contents (uses the `*words` index when possible). */
import type { DocumentContent, ID } from '@/types/models';
import { db } from '../db';
import { buildFindRegex, findAll, type FindOptions } from '@/lib/findRegex';
import { tokenize } from '@/lib/wordCount';

export interface Snippet {
  before: string;
  match: string;
  after: string;
}

export interface ContentHit {
  docId: ID;
  count: number;
  snippets: Snippet[];
}

export function makeSnippet(text: string, index: number, length: number, radius = 48): Snippet {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, index).replace(/\s+/g, ' '),
    match: text.slice(index, index + length),
    after: text.slice(index + length, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : ''),
  };
}

/** Narrows candidate rows with the multi-entry word index for simple queries. */
async function candidateContents(projectId: ID, query: string, opts: FindOptions): Promise<DocumentContent[]> {
  const tokens = tokenize(query.toLowerCase());
  if (!opts.regex && tokens.length >= 1 && tokens[0].length >= 3) {
    const longest = tokens.reduce((a, b) => (b.length > a.length ? b : a));
    const rows = await db.contents.where('words').startsWith(longest).distinct().toArray();
    return rows.filter((r) => r.projectId === projectId);
  }
  return db.contents.where('projectId').equals(projectId).toArray();
}

export async function searchContents(projectId: ID, query: string, opts: FindOptions, maxSnippets = 3): Promise<ContentHit[]> {
  const re = buildFindRegex(query, opts);
  if (!re) return [];
  const rows = await candidateContents(projectId, query, opts);
  const hits: ContentHit[] = [];
  for (const row of rows) {
    const matches = findAll(row.text, re);
    if (!matches.length) continue;
    hits.push({
      docId: row.docId,
      count: matches.length,
      snippets: matches.slice(0, maxSnippets).map((m) => makeSnippet(row.text, m.index, m.length)),
    });
  }
  return hits;
}
