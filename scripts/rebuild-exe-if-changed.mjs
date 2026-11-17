#!/usr/bin/env node
/**
 * Rebuilds release/Inkwell.exe only if any source file is newer than it.
 * Used by `npm run exe:if-changed` and the Claude Code Stop hook, so the
 * exe is recompiled after every change without rebuilding when nothing changed.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = join(root, 'release', 'Inkwell.exe');
const watched = ['src', 'electron', 'public', 'index.html', 'package.json', 'vite.config.ts', 'tsconfig.json'];

function newest(path) {
  if (!existsSync(path)) return 0;
  const st = statSync(path);
  if (!st.isDirectory()) return st.mtimeMs;
  return readdirSync(path).reduce((m, name) => Math.max(m, newest(join(path, name))), st.mtimeMs);
}

const sourceTime = Math.max(...watched.map((p) => newest(join(root, p))));
const exeTime = existsSync(exe) ? statSync(exe).mtimeMs : 0;

if (exeTime >= sourceTime) {
  console.log('Inkwell.exe is up to date.');
  process.exit(0);
}

console.log('Sources changed — rebuilding release/Inkwell.exe …');
const log = join(root, 'release', 'build.log');
try {
  mkdirSync(join(root, 'release'), { recursive: true });
  const output = execSync('npm run exe', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(log, output);
  console.log(`Built ${exe} (log: ${log})`);
} catch (err) {
  const detail = `${err.stdout ?? ''}\n${err.stderr ?? ''}`;
  writeFileSync(log, detail);
  console.error(`Rebuilding Inkwell.exe failed — see ${log}. If Inkwell is running, close it (the exe is locked while open) and run \`npm run exe\`.`);
  console.error(detail.split('\n').filter((l) => /error|failed|EBUSY|EPERM/i.test(l)).slice(-15).join('\n'));
  // Exit code 2 lets the Claude Code hook wake the session with the error.
  process.exit(2);
}
