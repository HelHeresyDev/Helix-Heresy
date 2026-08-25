// @ts-check
const { test, expect } = require('@playwright/test');
const ThemeContent = require('../theme-content');

test('authored content requires explicit compatibility, known tags, and unique fallbacks', () => {
  const base = {
    id: 'test.entry',
    kind: 'testContent',
    compatibility: 'shared',
    contentTags: ['neutral'],
    template: 'Safe text.',
  };

  expect(() => ThemeContent.createRegistry([{ ...base, compatibility: undefined }])).toThrow(/explicitly declare/i);
  expect(() => ThemeContent.createRegistry([{ ...base, compatibility: 'unbound' }])).toThrow(/explicitly declare/i);
  expect(() => ThemeContent.createRegistry([{ ...base, contentTags: [] }])).toThrow(/content tag/i);
  expect(() => ThemeContent.createRegistry([{ ...base, contentTags: ['unknown-tone'] }])).toThrow(/unknown content tag/i);
  expect(() => ThemeContent.createRegistry([base, base])).toThrow(/duplicate theme content id/i);
  expect(() => ThemeContent.createRegistry([
    { ...base, id: 'test.fallback-one', fallback: true },
    { ...base, id: 'test.fallback-two', fallback: true },
  ])).toThrow(/duplicate shared fallback/i);
});

test('the central selector is deterministic and never leaks incompatible content', () => {
  const madcapSources = new Set();
  const grimSources = new Set();
  const unboundSources = new Set();

  for (let index = 0; index < 300; index += 1) {
    const seed = `leakage-audit-${index}`;
    const madcap = ThemeContent.selectRenderedContent({ kind: 'runOpening', worldTheme: 'madcap', seed });
    const grim = ThemeContent.selectRenderedContent({ kind: 'runOpening', worldTheme: 'grim', seed });
    const unbound = ThemeContent.selectRenderedContent({ kind: 'runOpening', worldTheme: 'unbound', seed });
    expect(madcap.ok).toBe(true);
    expect(grim.ok).toBe(true);
    expect(unbound.ok).toBe(true);
    expect(['shared', 'madcap']).toContain(madcap.sourceTheme);
    expect(['shared', 'grim']).toContain(grim.sourceTheme);
    expect(['shared', 'madcap', 'grim']).toContain(unbound.sourceTheme);
    madcapSources.add(madcap.sourceTheme);
    grimSources.add(grim.sourceTheme);
    unboundSources.add(unbound.sourceTheme);
    expect(ThemeContent.selectRenderedContent({ kind: 'runOpening', worldTheme: 'unbound', seed })).toEqual(unbound);
  }

  expect(madcapSources).not.toContain('grim');
  expect(grimSources).not.toContain('madcap');
  expect(unboundSources).toEqual(new Set(['madcap', 'grim']));
});

test('mandatory shared fallbacks are explicit and missing optional content returns a diagnostic', () => {
  const registry = ThemeContent.createRegistry([
    {
      id: 'notice.grim-only',
      kind: 'notice',
      compatibility: 'grim',
      contentTags: ['survival'],
      template: 'Grim notice.',
    },
    {
      id: 'notice.shared-fallback',
      kind: 'notice',
      compatibility: 'shared',
      contentTags: ['neutral'],
      fallback: true,
      template: 'Safe notice.',
    },
  ]);

  const fallback = ThemeContent.selectRenderedContent({
    kind: 'notice',
    worldTheme: 'madcap',
    seed: 'fallback-seed',
  }, registry);
  expect(fallback).toMatchObject({
    ok: true,
    definitionId: 'notice.shared-fallback',
    sourceTheme: 'shared',
    usedFallback: true,
    text: 'Safe notice.',
  });

  expect(ThemeContent.selectContent(registry, {
    kind: 'optionalEncounter',
    worldTheme: 'madcap',
    seed: 'missing-seed',
  })).toEqual({
    ok: false,
    code: 'no-compatible-content',
    kind: 'optionalEncounter',
    worldTheme: 'madcap',
  });
});

test('world-name recipes render entirely from one selected theme definition', () => {
  for (const worldTheme of ['madcap', 'grim', 'unbound']) {
    const selected = ThemeContent.selectRenderedContent({
      kind: 'worldName',
      worldTheme,
      seed: `coherent-name-${worldTheme}`,
    });
    const definition = ThemeContent.DEFAULT_REGISTRY.find((entry) => entry.id === selected.definitionId);
    expect(definition.compatibility).toBe(selected.sourceTheme);
    expect(definition.recipe.openings.some((part) => selected.text.startsWith(part))).toBe(true);
    expect(definition.recipe.endings.some((part) => selected.text.includes(`${part}, `))).toBe(true);
    expect(definition.recipe.titles.some((part) => selected.text.endsWith(part))).toBe(true);
  }
});
