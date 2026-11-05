#!/usr/bin/env node
// Mechanical atlas packing only. Artwork is produced by built-in image_gen;
// this script never draws, invents, recolors, or chroma-keys sprite content.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const inventory = require('../assets/sprites/production/inventory.json');
const manifest = require('../sprite-asset-manifest.js').manifest;
const outputRoot = path.join(root, 'assets/sprites/production');
const sourceRoot = path.join(outputRoot, 'source');

function magick(args) {
  const result = spawnSync('magick', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
  return result.stdout.trim();
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function build() {
  // Resolve every source before producing anything. Originals remain in place.
  const inputs = inventory.atlases.map(atlas => {
    const source = path.join(sourceRoot, `${atlas.id}.png`);
    if (!fs.statSync(source).isFile()) throw new Error(`Missing source: ${source}`);
    const [width, height] = magick(['identify', '-format', '%w %h', source]).split(' ').map(Number);
    if (!(width > 0 && height > 0)) throw new Error(`Invalid source: ${source}`);
    return { ...atlas, source, width, height };
  });
  const titleSource = path.join(sourceRoot, 'title-key-art.png');
  if (!fs.statSync(titleSource).isFile()) throw new Error('Missing title illustration');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'helix-art-pack-'));
  const records = [];
  for (const atlas of inputs) {
    const target = path.join(outputRoot, `${atlas.id}.png`);
    const unique = [...new Map(inventory.assets.filter(a => a.atlas === atlas.id).map(a => [a.slot, a])).values()];
    const packed = [];
    for (const asset of unique) {
      const entry = manifest.assets.find(a => a.key === asset.key);
      // Reuse the reviewed overhead door forms rather than accepting the first
      // underground sheet's front-elevation doors. No creative redraw in code.
      const sharedDoorSlots = { 'door.closed': 2, 'door.open': 3, 'door.locked': 6,
        'door.sealed': 5, 'door.breached': 7 };
      const sharedSlot = sharedDoorSlots[asset.key];
      const input = sharedSlot === undefined ? atlas : inputs.find(a => a.id === 'surface-access');
      const slot = sharedSlot === undefined ? asset.slot : sharedSlot;
      const column = slot % input.columns;
      const row = Math.floor(slot / input.columns);
      const x = Math.round(column * input.width / input.columns);
      const y = input.sourceRowBounds?.[row]?.[0] ?? Math.round(row * input.height / input.rows);
      const width = Math.round((column + 1) * input.width / input.columns) - x;
      const bottom = input.sourceRowBounds?.[row]?.[1] ?? Math.round((row + 1) * input.height / input.rows);
      const height = bottom - y;
      if (!(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= input.width && bottom <= input.height)) {
        throw new Error(`Source crop outside image: ${asset.key}`);
      }
      const cell = path.join(temp, `${atlas.id}-${asset.slot}.png`);
      magick([input.source, '-crop', `${width}x${height}+${x}+${y}`, '+repage', cell]);
      // Bound detection ignores barely-visible fringe, but alpha inside the crop
      // is retained. Never manufacture a solid background for isolated objects.
      const bounds = magick([cell, '-alpha', 'extract', '-threshold', '10%', '-format', '%@', 'info:']);
      if (!/^\d+x\d+\+\d+\+\d+$/.test(bounds) || bounds.startsWith('0x0')) {
        throw new Error(`Empty atlas cell: ${asset.key}`);
      }
      const rect = entry.sourceRect;
      const opaque = atlas.opaqueSlots.includes(asset.slot);
      const edgeConnected = asset.key.startsWith('fixture.surfaceServiceTrunk.');
      const fitWidth = opaque || edgeConnected ? rect.width : Math.max(1, rect.width - 6);
      const fitHeight = opaque || edgeConnected ? rect.height : Math.max(1, rect.height - 6);
      const fit = opaque ? `${fitWidth}x${fitHeight}^` : `${fitWidth}x${fitHeight}`;
      magick([cell, '-crop', bounds, '+repage', '-filter', 'Lanczos', '-resize', fit,
        '-background', 'none', '-gravity', 'center', '-extent', `${rect.width}x${rect.height}`, `PNG32:${cell}`]);
      packed.push({ cell, rect });
    }
    magick(['-size', `${atlas.columns * 192}x${atlas.rows * 192}`, 'xc:none',
      ...packed.flatMap(({ cell, rect }) => [cell, '-geometry', `+${rect.x}+${rect.y}`, '-composite']),
      '-strip', '-define', 'png:exclude-chunk=date,time', `PNG32:${target}`]);
    records.push({ id: atlas.id, source: `source/${atlas.id}.png`, sourceSha256: sha256(atlas.source),
      file: `${atlas.id}.png`, sha256: sha256(target) });
  }
  const titleTarget = path.join(root, 'assets/art/title-key-art.webp');
  fs.mkdirSync(path.dirname(titleTarget), { recursive: true });
  magick([titleSource, '-resize', '1920x1080>', '-strip', '-quality', '88', titleTarget]);
  records.push({ id: 'title-key-art', source: 'source/title-key-art.png', sourceSha256: sha256(titleSource),
    file: '../../art/title-key-art.webp', sha256: sha256(titleTarget) });
  fs.writeFileSync(path.join(outputRoot, 'build-record.json'), JSON.stringify({
    generator: 'built-in image_gen', processing: 'ImageMagick crop, alpha-preserving resample and atlas packing; title WebP encoding',
    records
  }, null, 2) + '\n');
  console.log(`Packed ${inventory.assets.length} mappings into ${inputs.length} atlases plus title art.`);
  console.log(`Intermediate crops retained for review: ${temp}`);
}
if (require.main === module) build();
module.exports = { build };
