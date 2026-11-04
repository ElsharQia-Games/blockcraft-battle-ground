'use strict';

// This command does not start the game, a server, or a browser.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');

function check(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) count += check(file);
    else if (/\.(cjs|mjs|js)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 10_000 });
      if (result.error || result.status !== 0) throw new Error(`${file}\n${result.error || result.stderr}`);
      count++;
    }
  }
  return count;
}
const root = path.resolve(__dirname, '..');
const tests = check(__dirname);
const sources = check(path.join(root, 'src'));
new vm.Script(fs.readFileSync(path.join(root, 'server.js'), 'utf8'), { filename: 'server.js' });

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const list = /const SOURCES\s*=\s*\[([\s\S]*?)\]/.exec(html);
if (!list) throw new Error('Missing classic-script loader SOURCES');
const ordered = [...list[1].matchAll(/['"]([^'"]+\.js)['"]/g)].map((m) => m[1]);
if (ordered.length !== sources || new Set(ordered).size !== sources) {
  throw new Error('Loader must include every source script exactly once');
}
// Catch collisions across the shared global lexical scope, without executing it.
new vm.Script(ordered.map((file) => fs.readFileSync(path.join(root, 'src', file), 'utf8')).join('\n'),
  { filename: 'ordered-classic-scripts.js' });

let inline = 0;
for (const [, attrs, text] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!text.trim()) continue;
  if (/type\s*=\s*['"]importmap['"]/i.test(attrs)) { JSON.parse(text); continue; }
  if (/type\s*=\s*['"]module['"]/i.test(attrs)) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'],
      { input: text, encoding: 'utf8', timeout: 10_000 });
    if (result.error || result.status !== 0) throw new Error(`index.html module\n${result.error || result.stderr}`);
  } else new vm.Script(text, { filename: 'index.html inline script' });
  inline++;
}
console.log(`Syntax OK: ${sources} game scripts, server, ${inline} inline scripts, shared scope, and ${tests} test files`);
