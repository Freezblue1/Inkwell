/**
 * Revision passes (like Scrivener's revision colours) and the live "which pass
 * am I typing in" state the editor plugin reads. The store keeps this in sync.
 */
export interface RevisionPass {
  n: number;
  name: string;
  light: string;
  dark: string;
}

export const REVISION_PASSES: RevisionPass[] = [
  { n: 1, name: 'First revision', light: '#1565c0', dark: '#64b5f6' },
  { n: 2, name: 'Second revision', light: '#c62828', dark: '#ef5350' },
  { n: 3, name: 'Third revision', light: '#2e7d32', dark: '#66bb6a' },
  { n: 4, name: 'Fourth revision', light: '#7b1fa2', dark: '#ce93d8' },
  { n: 5, name: 'Fifth revision', light: '#e65100', dark: '#ffa726' },
];

export function passInfo(n: number): RevisionPass {
  return REVISION_PASSES.find((p) => p.n === n) ?? REVISION_PASSES[0];
}

let currentPass: number | null = null;

/** The pass new edits are recorded in, or null when revision mode is off. */
export function getRevisionPass(): number | null {
  return currentPass;
}

export function setRevisionPass(pass: number | null): void {
  currentPass = pass;
}
