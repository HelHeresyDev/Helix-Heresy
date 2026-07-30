# Renderer Promotion Checklist

Canvas remains an optional Debug renderer and the DOM glyph map remains the default fallback. Passing this checklist makes Canvas eligible for a separate default-renderer decision; it does not automatically switch the default or authorize removal of the DOM renderer.

## Automated Gates

- [x] One renderer-neutral `MapScene` feeds both renderers.
- [x] Deterministic fixtures cover terrain and doors, knowledge and lighting, effects and overlays, crowded targets, multi-tile/tall z-layer subjects, sprites, high contrast, marker scaling, zoom sizes, and compact-desktop layout.
- [x] DOM cell models and Canvas draw plans expose the same visible cells, entities, effects, selection, cursor, primary targets, crowded target sets, tooltips, and accessibility summary.
- [x] Stable render-pass and interaction ordering is asserted.
- [x] Chromium-on-Ubuntu screenshot baselines are committed and checked without automatic updates.
- [x] Existing Canvas pointer, camera, designation, contextual-command, accessibility, and persistence tests remain active.
- [x] The large-population benchmark retains strict offscreen-count and idle-frame invariants and reports its advisory frame budgets.
- [x] The Chromium correctness suite remains 185 tests.

## Human and Release Gates

- [ ] The developer has reviewed and approved the current Linux screenshots.
- [ ] Canvas has been used as the default renderer for a dedicated manual soak pass covering ordinary play, not only synthetic fixtures.
- [ ] Any intentional screenshot change has an explanation in the commit that updates its baseline.
- [ ] Known visual differences are documented as intentional, accessible, and information-equivalent.
- [ ] A separate decision explicitly approves changing the default renderer.

## Baseline Policy

Ubuntu Chromium is the authoritative screenshot platform. Fixtures freeze the map clock, disable movement, use a fixed device scale and viewport, wait for fonts and sprite assets, and compare no more than 0.5 percent differing pixels with a small antialiasing threshold.

Run the gate without changing baselines:

```bash
npm run test:visual
```

After deliberately reviewing a visual change, regenerate baselines with:

```bash
npm run test:visual:update
```

Never update screenshots merely to make a failing test green. First inspect whether the difference is intended and whether semantic parity still passes.
