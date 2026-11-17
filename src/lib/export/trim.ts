import type { ExportProfile, ExportTemplate, TrimSize } from '@/types/models';

/** Page sizes in inches. */
export const TRIM_SIZES: Record<TrimSize, { w: number; h: number; label: string }> = {
  '5x8': { w: 5, h: 8, label: '5 × 8 in' },
  '5.25x8': { w: 5.25, h: 8, label: '5.25 × 8 in' },
  '5.5x8.5': { w: 5.5, h: 8.5, label: '5.5 × 8.5 in' },
  '6x9': { w: 6, h: 9, label: '6 × 9 in' },
  letter: { w: 8.5, h: 11, label: 'US Letter' },
  a4: { w: 8.27, h: 11.69, label: 'A4' },
};

/** Preset values applied when switching template. */
export function templatePreset(template: ExportTemplate): Partial<ExportProfile> {
  switch (template) {
    case 'manuscript':
      return {
        template,
        trim: 'letter',
        margins: { top: 1, bottom: 1, inside: 1, outside: 1 },
        bodyFont: 'Courier Prime',
        fontSize: 12,
        lineHeight: 2,
        paragraphSpacing: 0,
        firstLineIndent: 3,
        justify: false,
        dropCaps: false,
        runningHeaders: true,
        toc: false,
        titlePage: true,
        copyrightPage: false,
        chapterHeadingStyle: 'number-title',
        sceneBreakGlyph: '#',
      };
    case 'paperback':
      return {
        template,
        trim: '5.5x8.5',
        margins: { top: 0.75, bottom: 0.75, inside: 0.875, outside: 0.625 },
        bodyFont: 'EB Garamond',
        fontSize: 11.5,
        lineHeight: 1.4,
        paragraphSpacing: 0,
        firstLineIndent: 1.5,
        justify: true,
        dropCaps: true,
        runningHeaders: true,
        toc: true,
        titlePage: true,
        copyrightPage: true,
        sceneBreakGlyph: '* * *',
      };
    case 'ebook':
      return {
        template,
        trim: '6x9',
        margins: { top: 0.5, bottom: 0.5, inside: 0.5, outside: 0.5 },
        bodyFont: 'Literata',
        fontSize: 12,
        lineHeight: 1.5,
        paragraphSpacing: 0,
        firstLineIndent: 1.5,
        justify: false,
        dropCaps: false,
        runningHeaders: false,
        toc: true,
        titlePage: true,
        copyrightPage: true,
        sceneBreakGlyph: '⁂',
      };
  }
}

/** Whether a font is monospaced (for PDF font mapping). */
export function isMonoFont(font: string): boolean {
  return /courier|mono/i.test(font);
}

export const EXPORT_FONTS = ['EB Garamond', 'Literata', 'Merriweather', 'Courier Prime', 'Tinos', 'Times New Roman', 'Georgia'];
