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
const localAssets = [...html.matchAll(/<script\b[^>]*\bsrc=["'](assets\/[^"']+\.js)["'][^>]*>/gi)].map((m) => m[1]);
const assetScripts = localAssets.map((file) => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  new vm.Script(source, { filename: file });
  return source;
});
if (!localAssets.includes('assets/audio/weapon-samples.js')) throw new Error('Missing file-safe weapon sample asset');
if (html.indexOf('assets/audio/weapon-samples.js') > html.indexOf('const SOURCES')) {
  throw new Error('Weapon sample asset must load before the classic source loader');
}
const list = /const SOURCES\s*=\s*\[([\s\S]*?)\]/.exec(html);
if (!list) throw new Error('Missing classic-script loader SOURCES');
const ordered = [...list[1].matchAll(/['"]([^'"]+\.js)['"]/g)].map((m) => m[1]);
if (ordered.length !== sources || new Set(ordered).size !== sources) {
  throw new Error('Loader must include every source script exactly once');
}
// These are load-time dependencies, not just a naming convention. Runtime
// hooks must exist before seed/settings initialization; gameplay globals must
// exist before their feature bridges. This is a static check: no code runs.
const dependencies = [
  ['04-runtime.js', '00-core.js'], ['00-core.js', '05-settings.js'],
  ['10-textures.js', '20-world.js'], ['20-world.js', '15-modes.js'],
  ['20-world.js', '22-physics.js'], ['22-physics.js', '40-characters.js'],
  ['44-dragon-rules.js', '45-dragons.js'], ['45-dragons.js', '46-riding.js'], ['50-player.js', '52-jetpack.js'],
  ['52-jetpack.js', '53-ground-marker.js'], ['53-ground-marker.js', '55-building.js'],
  ['50-player.js', '58-killcam.js'], ['60-combat.js', '62-combat-fx.js'],
  ['62-combat-fx.js', '63-player-feedback.js'],
  ['85-scoreboard.js', '86-hud.js'], ['86-hud.js', '87-minimap.js'],
  ['05-settings.js', '88-menu.js'], ['80-input.js', '88-menu.js'], ['87-minimap.js', '88-menu.js'],
  ['90-net.js', '92-sync.js'], ['90-net.js', '94-audio.js']
];
for (const [dependency, file] of dependencies) {
  if (ordered.indexOf(dependency) < 0 || ordered.indexOf(file) <= ordered.indexOf(dependency)) {
    throw new Error(`Classic loader must load ${dependency} before ${file}`);
  }
}
if (ordered.at(-1) !== '99-boot.js') throw new Error('Boot must be the final classic script');
// Catch collisions across the shared global lexical scope, without executing it.
new vm.Script([...assetScripts, ...ordered.map((file) => fs.readFileSync(path.join(root, 'src', file), 'utf8'))].join('\n'),
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
console.log(`Syntax OK: ${sources} game scripts, ${assetScripts.length} asset script, server, ${inline} inline scripts, shared scope, and ${tests} test files`);
