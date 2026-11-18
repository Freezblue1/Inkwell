#!/usr/bin/env node
/**
 * Publishes a new Inkwell version that installed copies update to.
 *
 *   npm run release                 → 1.0.0 → 1.0.1
 *   npm run release -- minor        → 1.0.0 → 1.1.0
 *   npm run release -- 2.0.0 --notes "Big rewrite"
 *
 * Runs the tests, bumps the version, builds a compressed Inkwell.exe, commits
 * and tags, pushes, and creates a GitHub release with the exe attached.
 * Without --notes the release notes list the commits since the last release.
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.Path = `C:\\Program Files\\Git\\cmd;C:\\Program Files\\GitHub CLI;${process.env.Path ?? process.env.PATH ?? ''}`;
process.env.PATH = process.env.Path;

const args = process.argv.slice(2);
const notesIdx = args.indexOf('--notes');
const notesArg = notesIdx >= 0 ? args[notesIdx + 1] : null;
const bump = args.find((a, i) => !a.startsWith('--') && i !== notesIdx + 1) ?? 'patch';

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const out = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8' }).trim();

function nextVersion(current, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  const [ma, mi, pa] = current.split('.').map(Number);
  if (kind === 'major') return `${ma + 1}.0.0`;
  if (kind === 'minor') return `${ma}.${mi + 1}.0`;
  if (kind === 'patch') return `${ma}.${mi}.${pa + 1}`;
  throw new Error(`Unknown version bump “${kind}” (use patch, minor, major or a version like 1.2.0).`);
}

if (out('git', ['status', '--porcelain'])) {
  console.error('Commit or stash your changes first: the release is built from the committed code.');
  process.exit(1);
}

const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = nextVersion(pkg.version, bump);
const tag = `v${version}`;
if (out('git', ['tag', '--list', tag])) {
  console.error(`${tag} already exists.`);
  process.exit(1);
}

console.log(`Releasing Inkwell ${version} (was ${pkg.version})`);
run('npm test');

pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
try {
  run('npm run exe:small');
} catch (err) {
  pkg.version = JSON.parse(out('git', ['show', 'HEAD:package.json'])).version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  throw err;
}

let notes = notesArg;
if (!notes) {
  const last = out('git', ['tag', '--list', 'v*', '--sort=-v:refname']).split('\n').filter(Boolean)[0];
  const log = out('git', ['log', '--format=- %s', ...(last ? [`${last}..HEAD`] : ['-n', '15'])]);
  notes = log || `Inkwell ${version}`;
}

run('git add package.json');
execFileSync('git', ['commit', '-m', `Release ${tag}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`], { cwd: root, stdio: 'inherit' });
execFileSync('git', ['tag', tag], { cwd: root, stdio: 'inherit' });
run('git push');
execFileSync('git', ['push', 'origin', tag], { cwd: root, stdio: 'inherit' });
execFileSync('gh', ['release', 'create', tag, join(root, 'release', 'Inkwell.exe'), '--title', `Inkwell ${version}`, '--notes', notes], { cwd: root, stdio: 'inherit' });
console.log(`\nPublished Inkwell ${version}. Running copies will pick it up within a few hours, or at their next start.`);
