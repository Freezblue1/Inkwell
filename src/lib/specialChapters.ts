/** Special (unnumbered) chapters: prologue, epilogue, interlude, foreword… */
import type { InkDocument, SpecialChapter } from '@/types/models';

export const SPECIAL_CHAPTERS: { value: SpecialChapter; label: string; placement: 'start' | 'end' | 'here'; hint: string }[] = [
  { value: 'prologue', label: 'Prologue', placement: 'start', hint: 'Before chapter one' },
  { value: 'foreword', label: 'Foreword', placement: 'start', hint: 'Written by someone else, before the story' },
  { value: 'introduction', label: 'Introduction', placement: 'start', hint: 'Sets up the book' },
  { value: 'interlude', label: 'Interlude', placement: 'here', hint: 'Between chapters, unnumbered' },
  { value: 'epilogue', label: 'Epilogue', placement: 'end', hint: 'After the last chapter' },
  { value: 'afterword', label: 'Afterword', placement: 'end', hint: 'Closing words after the story' },
  { value: 'custom', label: 'Custom…', placement: 'here', hint: 'Your own heading, e.g. “Coda”' },
];

/** The heading for a special chapter ("Prologue", or the custom label). */
export function specialLabel(doc: Pick<InkDocument, 'metadata'>): string {
  const s = doc.metadata.special;
  if (!s) return '';
  if (s === 'custom') return doc.metadata.specialLabel.trim() || 'Special chapter';
  return SPECIAL_CHAPTERS.find((x) => x.value === s)?.label ?? '';
}

export function isSpecial(doc: Pick<InkDocument, 'metadata'>): boolean {
  return !!doc.metadata.special;
}
