const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('../accessibility-ui');
const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '../styles.css'), 'utf8');
const palette = rule => Object.fromEntries([...rule.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/gi)].map(m => [m[1], m[2]]));
test('horizontal and vertical tabs wrap without stranding the only tab stop', () => {
  assert.equal(A.tabIndex(0, 4, 'ArrowLeft'), 3); assert.equal(A.tabIndex(3, 4, 'ArrowRight'), 0);
  assert.equal(A.tabIndex(2, 4, 'Home'), 0); assert.equal(A.tabIndex(1, 4, 'End'), 3);
  assert.equal(A.tabIndex(0, 4, 'ArrowUp'), 3); assert.equal(A.tabIndex(0, 0, 'Home'), -1);
});
test('native interactive activation stays native; map regions retain map navigation', () => {
  const button = { closest: () => ({}) }, map = { closest: () => null };
  assert(A.nativeKey(button, 'Enter')); assert(A.nativeKey(button, ' ')); assert(A.nativeKey(button, 'Home'));
  assert(!A.nativeKey(map, 'Enter')); assert(!A.nativeKey(button, 'x'));
});
test('shared normal text, muted text, control boundaries and focus colors meet the frozen contrast thresholds', () => {
  const normal = palette(css.match(/:root\s*\{([^}]+)/)[1]);
  const high = palette(css.match(/html\[data-map-contrast="high"\]\s*\{([^}]+)/)[1]);
  const buttonBackground = css.match(/button,\s*\.file-button\s*\{[^}]*background:\s*(#[\da-f]{6})/i)[1];
  for (const panel of [normal['--bg'], normal['--panel'], normal['--panel-2'], buttonBackground]) {
    assert(A.contrast(normal['--text'], panel) >= 4.5); assert(A.contrast(normal['--muted'], panel) >= 4.5);
    assert(A.contrast(normal['--line'], panel) >= 3); assert(A.contrast(normal['--cyan'], panel) >= 3);
  }
  assert(A.contrast(high['--muted'], high['--panel-2']) >= 4.5); assert(A.contrast(high['--line'], high['--panel-2']) >= 3);
  assert.equal(A.contrast('#ffffff', '#000000'), 21);
});
