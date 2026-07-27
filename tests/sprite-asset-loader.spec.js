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
  expect(Manifest.manifest.version).toBe(2);
  expect(SpriteAssets.validateManifest(Manifest.manifest)).toEqual([]);
  expect(new Set(Manifest.manifest.assets.map((entry) => entry.category))).toEqual(
    new Set(SpriteAssets.CATEGORIES)
  );
  expect(Manifest.manifest.assets.every((entry) => entry.placeholder)).toBe(true);

  const invalid = structuredClone(Manifest.manifest);
  invalid.assets[1].key = invalid.assets[0].key;
  invalid.assets[1].source.path = '../outside.png';
  invalid.assets[1].sourceSize.width = 0;
  invalid.assets[1].sourceRect = { x: 1200, y: 0, width: 100, height: 100 };
  invalid.assets[1].placement.anchorTile.x = 2;
  invalid.assets[1].placement.rotation = 'diagonal';
  delete invalid.categoryFallbacks.actor;

  const errors = SpriteAssets.validateManifest(invalid);
  expect(errors).toEqual(expect.arrayContaining([
    expect.stringContaining('duplicates semantic key'),
    expect.stringContaining('safe relative source path'),
    expect.stringContaining('positive source dimensions'),
    expect.stringContaining('source rectangle'),
    expect.stringContaining('anchor tile'),
    expect.stringContaining('rotation mode'),
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
    total: Manifest.manifest.assets.length,
    counts: { idle: Manifest.manifest.assets.length, loading: 0, ready: 0, error: 0 },
  });
  await loader.loadAll();
  await loader.loadAll();

  expect(loader.snapshot()).toMatchObject({
    state: 'ready',
    counts: { idle: 0, loading: 0, ready: Manifest.manifest.assets.length, error: 0 },
  });
  expect(calls).toHaveLength(Manifest.manifest.assets.length);
  expect(new Set(calls).size).toBe(Manifest.manifest.assets.length);
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
  expect(loader.resolve('actor.slime.large.stale')).toMatchObject({
    resolvedKey: 'actor.slime.large',
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
    counts: { idle: 0, loading: 0, ready: Manifest.manifest.assets.length - 1, error: 1 },
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
  await expect.poll(() => page.evaluate(() =>
    window.helixHeresyDebug.mapRendererSnapshot().canvas?.multiTileSpritesDrawn || 0
  )).toBeGreaterThan(0);

  const snapshot = await page.evaluate(() => {
    const scene = window.helixHeresyDebug.mapSceneSnapshot();
    return {
      renderer: window.helixHeresyDebug.mapRendererSnapshot(),
      workbench: scene.entities.find((entity) => entity.subtype === 'basicWorkbench'),
    };
  });
  expect(snapshot.workbench).toMatchObject({
    bounds: { width: 2, height: 1, depth: 1 },
    orientation: { quarterTurns: 0, mirrored: false },
    visual: { key: 'fixture.basicWorkbench' },
  });
  expect(snapshot.renderer.assets).toMatchObject({
    state: 'ready',
    total: Manifest.manifest.assets.length,
    counts: { ready: Manifest.manifest.assets.length, error: 0 },
  });
  expect(snapshot.renderer.canvas.assets.state).toBe('ready');
  expect(snapshot.renderer.canvas.spritesDrawn).toBeGreaterThan(0);
  expect(snapshot.renderer.canvas.multiTileSpritesDrawn).toBeGreaterThan(0);

  const largeSlime = await page.evaluate(() => {
    const scientist = window.helixHeresyDebug.navigationSnapshot().actors
      .find((actor) => actor.id === 'scientist');
    const created = window.helixHeresyDebug.createSpatialTestSlime({
      size: 'wardrobe-sized',
      shape: 'spherical',
      roomId: 'mainLab',
      cell: scientist.cell,
      massPercent: 100,
    });
    const entity = window.helixHeresyDebug.mapSceneSnapshot().entities
      .find((candidate) => candidate.id === `slime:${created.id}`);
    return { created, entity };
  });
  expect(largeSlime.created.footprint).toMatchObject({
    width: 2,
    height: 2,
    heightLayers: 1,
  });
  expect(largeSlime.entity).toMatchObject({
    bounds: { width: 2, height: 2, depth: 1 },
    facing: expect.stringMatching(/^(north|east|south|west|none)$/),
    pose: expect.stringMatching(/^(idle|moving|working|feeding|attacking|guarded|fleeing|quiescent|strained|recovering|prone)$/),
    activity: {
      family: expect.stringMatching(/^(idle|movement|work|feeding|combat|containment|recovery|terminal)$/),
      source: 'simulation',
    },
    condition: { cues: expect.any(Array) },
    visual: {
      key: expect.stringMatching(/^actor\.slime\.large\.pose\./),
      fallbackKeys: expect.arrayContaining(['actor.slime.large']),
    },
  });
  await expect.poll(() => page.evaluate(() =>
    window.helixHeresyDebug.mapRendererSnapshot().canvas?.multiTileSpritesDrawn || 0
  )).toBeGreaterThan(1);
});
