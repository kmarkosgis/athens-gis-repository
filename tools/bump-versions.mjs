#!/usr/bin/env node
// Rewrites the ?v= cache-busting parameter on every local <script src> / <link href>
// (.js and .css) in the site's HTML pages to a hash of that file's CURRENT contents.
//
// Why: Cloudflare keeps JS for ~31 days (CSS 4h), so the only thing that makes a
// visitor's browser and the Cloudflare edge fetch a changed file is a changed URL.
// Bumping ?v= by hand gets forgotten (layer-control.js was edited several times
// without it), and then new layers/behaviour don't show up until someone hard-refreshes
// or purges Cloudflare. A content hash changes exactly when the file changes, so it
// can't be forgotten - and an unchanged file keeps its URL and stays cached.
//
// Usage (run from anywhere, before deploying):
//   node tools/bump-versions.mjs            rewrite index.html / about.html in place
//   node tools/bump-versions.mjs --dry-run  only report what would change
//
// Safe to re-run: with no file changes it rewrites nothing.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

// Files whose copy in this repo is NOT what gets deployed, so hashing it would give a
// version that doesn't track the live file. Left exactly as written (bump by hand).
// JS/config.js: the local copy points at `wrangler dev`; the live one is maintained
// separately in the GitHub repo (see the comment at the top of JS/config.js).
const SKIP = new Set(['JS/config.js']);

const pages = readdirSync(REPO_ROOT).filter(
  (f) => f.endsWith('.html') && !/-(LAPTOP|DESKTOP)-/.test(f)
);

// src="..." / href="..." pointing at a local .js/.css file (no scheme, not protocol-relative).
const REF = /\b(src|href)="((?!https?:|\/\/|data:)[^"?#]+\.(?:js|css))(\?[^"#]*)?"/g;

function hashOf(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);
}

let totalChanged = 0;
for (const page of pages) {
  const pagePath = path.join(REPO_ROOT, page);
  const html = readFileSync(pagePath, 'utf8');
  const changes = [];

  const out = html.replace(REF, (whole, attr, ref, query) => {
    const rel = ref.replace(/^\.\//, '');
    if (SKIP.has(rel)) return whole;
    const file = path.join(REPO_ROOT, rel);
    if (!existsSync(file)) return whole; // dangling reference - not this script's job
    const next = '?v=' + hashOf(file);
    if ((query || '') === next) return whole;
    changes.push('  ' + rel + '  ' + (query || '(none)') + ' -> ' + next);
    return attr + '="' + ref + next + '"';
  });

  if (!changes.length) {
    console.log(page + ': up to date');
    continue;
  }
  console.log(page + ': ' + changes.length + ' reference(s)' + (DRY_RUN ? ' would change' : ' updated'));
  changes.forEach((c) => console.log(c));
  totalChanged += changes.length;
  if (!DRY_RUN) writeFileSync(pagePath, out);
}

console.log('\n' + (DRY_RUN ? 'Dry run - nothing written. ' : '') + totalChanged + ' reference(s) ' + (DRY_RUN ? 'to change.' : 'changed.'));
if (SKIP.size) console.log('Skipped (bump by hand if its live copy changed): ' + [...SKIP].join(', '));
