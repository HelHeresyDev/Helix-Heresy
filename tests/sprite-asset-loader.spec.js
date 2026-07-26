// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Manifest = require('../sprite-asset-manifest.js');
const SpriteAssets = require('../sprite-asset-loader.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

function fakeImageFactory(calls, errorKey = '') {
  return (entry) => {
    calls.push(entry.key);
    return {
      decoding: '',
      naturalWidth: entry.sourceSize.width,
      naturalHeight: entry.sourceSize.height,
      onload: null,
      onerror: null,
      set src(value) {
        this.currentSrc = value;
        queueMicrotask(() => {
          if (entry.key === errorKey) this.onerror?.();
          else this.onload?.();
        });
      },
    };
  };
}

test('development sprite manifest is valid and covers every asset category', () => {
  expect(SpriteAssets.validateManifest(Manifest.manifest)).toEqual([]);
  expect(new Set(Manifest.manifest.assets.map((entry) => entry.category))).toEqual(
    new Set(SpriteAssets.CATEGORIES)
  );
  expect(Manifest.manifest.assets.every((entry) => entry.placeholder)).toBe(true);

  const invalid = structuredClone(Manifest.manifest);
  invalid.assets[1].key = invalid.assets[0].key;
  invalid.assets[1].source.path = '../outside.png';
  invalid.assets[1].sourceSize.width = 0;
  delete invalid.categoryFallbacks.actor;

  const errors = SpriteAssets.validateManifest(invalid);
  expect(errors).toEqual(expect.arrayContaining([
    expect.stringContaining('duplicates semantic key'),
    expect.stringContaining('safe relative source path'),
    expect.stringContaining('positive source dimensions'),
    expect.stringContaining('category actor needs'),
  ]));
});

test('loader caches images and resolves exact, base, alias, and category fallbacks', async () => {
  const calls = [];
  const loader = SpriteAssets.createAssetLoader(Manifest.manifest, {
    baseUrl: appUrl,
    imageFactory: fakeImageFactory(calls),
  });
  const states = [];
  loader.subscribe((snapshot) => states.push(snapshot.state));

  expect(loader.snapshot()).toMatchObject({
    state: 'idle',
    total: 6,
    counts: { idle: 6, loading: 0, ready: 0, error: 0 },
  });
  await loader.loadAll();
  await loader.loadAll();

  expect(loader.snapshot()).toMatchObject({
    state: 'ready',
    counts: { idle: 0, loading: 0, ready: 6, error: 0 },
  });
  expect(calls).toHaveLength(6);
  expect(new Set(calls).size).toBe(6);
  expect(states).toContain('loading');
  expect(states.at(-1)).toBe('ready');
  expect(loader.resolve('actor.slime')).toMatchObject({
    resolvedKey: 'actor.slime',
    resolution: 'exact',
    status: 'ready',
  });
  expect(loader.resolve('actor.slime.stale')).toMatchObject({
    resolvedKey: 'actor.slime',
    resolution: 'base',
    status: 'ready',
  });
  expect(loader.resolve('effect.incident.combat.serious')).toMatchObject({
    resolvedKey: 'marker.incident',
    resolution: 'alias',
    status: 'ready',
  });
  expect(loader.resolve('fixture.unmapped')).toMatchObject({
    resolvedKey: '',
    resolution: 'fallback',
    status: 'fallback',
    fallback: { category: 'fixture', type: 'glyph', glyph: 'F' },
  });

  const failedCalls = [];
  const failedLoader = SpriteAssets.createAssetLoader(Manifest.manifest, {
    baseUrl: appUrl,
    imageFactory: fakeImageFactory(failedCalls, 'item.stack'),
  });

  await failedLoader.loadAll();

  expect(failedLoader.snapshot()).toMatchObject({
    state: 'partial',
    counts: { idle: 0, loading: 0, ready: 5, error: 1 },
  });
  expect(failedLoader.snapshot().errors).toEqual([
    expect.stringContaining('item.stack: Failed to load'),
  ]);
  expect(failedLoader.resolve('item.stack')).toMatchObject({
    status: 'error',
    image: null,
    fallback: { category: 'item', type: 'glyph', glyph: 'P' },
  });
});

test('browser loads declared images and Canvas reports authored sprites', async ({ page }) => {
  await startRun(page);

  await expect.poll(() => page.evaluate(() =>
    window.helixHeresyDebug.spriteAssetSnapshot().state
  )).toBe('ready');
  expect(await page.evaluate(() =>
    window.helixHeresyDebug.validateSpriteManifest()
  )).toEqual([]);

  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  await expect.poll(() => page.evaluate(() =>
    window.helixHeresyDebug.mapRendererSnapshot().canvas?.spritesDrawn || 0
  )).toBeGreaterThan(0);

  const snapshot = await page.evaluate(() =>
    window.helixHeresyDebug.mapRendererSnapshot()
  );
  expect(snapshot.assets).toMatchObject({
    state: 'ready',
    total: 6,
    counts: { ready: 6, error: 0 },
  });
  expect(snapshot.canvas.assets.state).toBe('ready');
  expect(snapshot.canvas.spritesDrawn).toBeGreaterThan(0);
});
