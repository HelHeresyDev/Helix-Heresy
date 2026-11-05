// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inflateSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');
const frozen = require('../assets/sprites/production/inventory.json');
const { manifest } = require('../sprite-asset-manifest.js');
const root = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(root, 'index.html')).href;

// Small RGBA8 PNG decoder for artifact checks; no ImageMagick dependency in CI.
function rgbaPixels(bytes) {
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scan = inflateSync(Buffer.concat(chunks)), stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = scan[y * (stride + 1)];
    expect(filter).toBeLessThanOrEqual(4);
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x, left = x >= 4 ? pixels[at - 4] : 0;
      const up = y ? pixels[at - stride] : 0, upperLeft = y && x >= 4 ? pixels[at - stride - 4] : 0;
      const prediction = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)][filter];
      pixels[at] = (scan[y * (stride + 1) + x + 1] + prediction) & 255;
    }
  }
  return pixels;
}

test('production inventory preserves all frozen geometry, aliases and fallbacks', () => {
  expect(frozen.assets).toHaveLength(125);
  expect(manifest.assets.map(a => ({ key: a.key, category: a.category, logicalSize: a.logicalSize,
    placement: a.placement, variants: a.variants }))).toEqual(frozen.assets.map(a => ({
    key: a.key, category: a.category, logicalSize: a.logicalSize, placement: a.placement, variants: a.variants
  })));
  expect(manifest.aliases).toEqual(frozen.aliases);
  expect(manifest.categoryFallbacks).toEqual(frozen.categoryFallbacks);
  const cells = new Map();
  for (const entry of manifest.assets) {
    expect(entry).toMatchObject({ production: true, placeholder: false, development: false, generated: true });
    expect(entry.sourceRect.width / entry.sourceRect.height).toBe(entry.logicalSize.width / entry.logicalSize.height);
    expect(entry.sourceRect.width / entry.logicalSize.width).toBe(64);
    const cell = JSON.stringify([entry.source.path, entry.sourceRect]);
    const previous = cells.get(cell);
    if (previous) expect(entry.logicalSize).toEqual(previous.logicalSize);
    cells.set(cell, entry);
  }
  const freight = manifest.assets.find(a => a.key === 'item.surface.freight');
  const lawful = manifest.assets.find(a => a.key === 'item.surface.freight.lawful');
  expect(lawful.source).toEqual(freight.source);
  expect(lawful.sourceRect).toEqual(freight.sourceRect); // no hidden legality signal
});

test('production files match recorded hashes, RGBA dimensions and bounded decoded memory', () => {
  const record = require('../assets/sprites/production/build-record.json');
  expect(record.records).toHaveLength(9);
  let pixels = 0;
  for (const atlas of frozen.atlases) {
    const file = path.join(root, 'assets/sprites/production', `${atlas.id}.png`);
    const bytes = fs.readFileSync(file);
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(bytes.readUInt32BE(16)).toBe(atlas.columns * 192);
    expect(bytes.readUInt32BE(20)).toBe(atlas.rows * 192);
    expect(bytes[25]).toBe(6); // full RGBA, generated transparency retained
    expect(bytes[24]).toBe(8);
    expect(bytes[28]).toBe(0); // non-interlaced rows
    const rgba = rgbaPixels(bytes), width = atlas.columns * 192;
    for (const entry of manifest.assets.filter(a => a.source.path.endsWith(`/${atlas.id}.png`))) {
      let visible = 0, clear = 0;
      const r = entry.sourceRect;
      for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) {
        const alpha = rgba[(y * width + x) * 4 + 3];
        if (alpha > 25) visible++;
        if (alpha === 0) clear++;
      }
      expect(visible, entry.key).toBeGreaterThan(24); // no blank/mispacked cell
      if (entry.category !== 'terrain' && !entry.key.startsWith('fixture.surfaceServiceTrunk.')) {
        expect(clear, entry.key).toBeGreaterThan(0); // no baked opaque backdrop
      }
    }
    pixels += bytes.readUInt32BE(16) * bytes.readUInt32BE(20);
  }
  expect(pixels * 4).toBeLessThan(20 * 1024 * 1024);
  for (const entry of record.records) {
    for (const [fileKey, hashKey] of [['file', 'sha256'], ['source', 'sourceSha256']]) {
      const data = fs.readFileSync(path.join(root, 'assets/sprites/production', entry[fileKey]));
      expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(entry[hashKey]);
    }
  }
});

test('title art loads without replacing native menu, focus or contrast preferences', async ({ page }, info) => {
  await page.goto(appUrl);
  const art = page.locator('.title-key-art');
  await expect.poll(() => art.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(art).toHaveAttribute('alt', '');
  await expect(page.locator('#titleScreenHeading')).toHaveText('Helix Heresy');
  await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
  await page.locator('#titleSettingsBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#titleSettingsPanel')).toBeVisible();
  await page.selectOption('[data-title-preference="mapContrast"]', 'high');
  await expect(art).toBeHidden();
  await page.selectOption('[data-title-preference="mapContrast"]', 'standard');
  await page.locator('#titleSettingsBackBtn').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#titleSettingsBtn')).toBeFocused();
  await page.screenshot({ path: info.outputPath('production-title.png') });
  await page.setViewportSize({ width: 640, height: 450 });
  await expect(page.locator('#titleScreen')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(art).toBeHidden();
  await expect(page.locator('#titleNewRunBtn')).toBeVisible();
});

test('missing decorative title image leaves the native menu usable', async ({ page }) => {
  await page.goto(appUrl);
  await page.locator('.title-key-art').evaluate(img => { img.src = 'assets/art/intentionally-missing.webp'; });
  await expect.poll(() => page.locator('.title-key-art').evaluate(img => img.complete && img.naturalWidth === 0)).toBe(true);
  await page.locator('#titleNewRunBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#setupForm')).toBeVisible();
});

test('all frozen atlas rectangles decode and produce an inspection contact sheet', async ({ page }, info) => {
  await page.goto(appUrl);
  const summary = await page.evaluate(async entries => {
    const images = new Map();
    for (const entry of entries) {
      if (images.has(entry.source.path)) continue;
      const image = new Image();
      image.src = entry.source.path;
      await image.decode();
      images.set(entry.source.path, image);
    }
    const gallery = document.createElement('div');
    gallery.style.cssText = 'display:grid;grid-template-columns:repeat(8,150px);gap:8px;padding:12px;background:#272b30;color:white;font:10px monospace;';
    const sizes = [];
    for (const entry of entries) {
      const card = document.createElement('div');
      card.style.cssText = 'height:126px;background:#151a20;padding:4px;overflow-wrap:anywhere;';
      const canvas = document.createElement('canvas');
      canvas.width = 140; canvas.height = 88;
      const context = canvas.getContext('2d');
      const r = entry.sourceRect;
      const scale = Math.min(1, 132 / r.width, 80 / r.height);
      context.drawImage(images.get(entry.source.path), r.x, r.y, r.width, r.height,
        (140 - r.width * scale) / 2, (88 - r.height * scale) / 2, r.width * scale, r.height * scale);
      card.append(canvas, document.createTextNode(entry.key));
      gallery.append(card);
      sizes.push([entry.key, images.get(entry.source.path).naturalWidth]);
    }
    document.body.replaceChildren(gallery);
    return sizes;
  }, manifest.assets);
  expect(summary).toHaveLength(125);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: info.outputPath('production-inventory.png'), fullPage: true });
});
