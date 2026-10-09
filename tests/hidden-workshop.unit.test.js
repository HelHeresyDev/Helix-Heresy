const { test } = require('node:test');
const assert = require('node:assert/strict');
const Workshop = require('../hidden-workshop');
const layout = () => Workshop.plan({ x: 27, y: 10, z: 8 });
const destination = { id: 'known-remote', strategicCellId: 'cell:3', privateDeposit: 'do not disclose' };
const context = { alive: true, local: true, visited: true, wilderness: true, observed: true, clear: true, roomId: 'remoteSurveyLanding' };

test('receiving alcoves are separate enclosed plans with real ports and a nonduplicated connection to the old trunk', () => {
  const base = layout(), original = JSON.stringify(base), key = c => `${c.x},${c.y},${c.z}`;
  const plans = Workshop.alcovePlans(base); assert.equal(plans.length, 10);
  for (const p of plans) {
    assert.equal(p.floors.length, 25); assert.equal(p.roofs.length, 25); assert.equal(p.walls.length, 15);
    assert(!p.walls.some(c => key(c) === key(p.entrance)));
    assert(base.walls.some(c => key(c) === key(p.opening)));
    assert.deepEqual(p.workCell, base.workCell);
    const r = p.equipment.receiver[0], b = p.equipment.beacon[0];
    const ports = [{ ...r, x: r.x + 1, y: r.y - 1 }, { ...b, y: b.y - 1 }];
    assert.deepEqual(p.rotations, { receiver: 180, beacon: 180 });
    for (const port of ports) {
      assert(p.floors.some(c => key(c) === key(port))); assert(!p.walls.some(c => key(c) === key(port)));
    }
    const blocked = new Set([...p.walls, r, { ...r, x: r.x + 1 }, { ...r, y: r.y + 1 }, { ...r, x: r.x + 1, y: r.y + 1 }, b].map(key));
    const walkable = p.floors.filter(c => !blocked.has(key(c))), accessible = new Set([key(p.entrance)]);
    for (let n = 0; n < walkable.length; n++) for (const c of walkable)
      if (walkable.some(a => accessible.has(key(a)) && Math.abs(a.x - c.x) + Math.abs(a.y - c.y) === 1)) accessible.add(key(c));
    assert(ports.every(c => accessible.has(key(c))), 'Both actual operator ports must be reachable through the entrance without clipping blocking equipment.');
    const added = p.equipment.receiverServices, all = [...added, ...base.equipment.services];
    assert.equal(new Set(all.map(key)).size, all.length);
    const reached = new Set([key(added[0])]);
    for (let n = 0; n < all.length; n++) for (const c of all)
      if (all.some(a => reached.has(key(a)) && Math.abs(a.x - c.x) + Math.abs(a.y - c.y) === 1)) reached.add(key(c));
    assert(all.every(c => reached.has(key(c))));
  }
  assert.deepEqual(plans[0].origin, { x: 22, y: 14, z: 8 });
  assert(!plans[0].ground.some(c => Math.abs(c.x - RemoteLanding.x) <= 1 && Math.abs(c.y - RemoteLanding.y) <= 1));
  assert.equal(JSON.stringify(base), original); assert.equal(base.equipment.receiver, undefined);
  assert.deepEqual(Workshop.ALCOVE_COSTS, { lumber: 25, steelPanels: 8, metalParts: 4, rubber: 2 });
});
const RemoteLanding = { x: 23, y: 12 };

test('workshop is shared theme-selected content with no automatically provided site or assets', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const s = Workshop.create({ theme, seed: 'fixed' });
    assert.equal(s.definitionId, 'facility.shared.hidden-workshop'); assert.equal(s.sourceTheme, 'shared');
    assert.equal(s.site, null); assert.equal(Workshop.publicView(s), null); assert.deepEqual(s.receipts, []);
  }
});
test('establishment requires a physically visited inspected wilderness footprint, not a map or lease', () => {
  for (const field of ['alive', 'local', 'visited', 'wilderness', 'observed', 'clear']) {
    const s = Workshop.create(); assert.equal(Workshop.establish(s, destination, layout(), 10, { ...context, [field]: false }).ok, false);
    assert.equal(s.site, null);
  }
  const s = Workshop.create(); assert.equal(Workshop.establish(s, destination, layout(), 10, context).ok, true);
  assert.equal(s.site.shellBuiltAt, null); assert.deepEqual(s.site.fixtureIds, {});
  assert.equal(Workshop.establish(s, destination, layout(), 20, context).ok, false);
});
test('physical layout leaves an entrance, external generator apron and connected nonduplicated service path', () => {
  const p = layout(), key = c => `${c.x},${c.y},${c.z}`;
  assert.equal(p.floors.length, 49); assert.equal(p.walls.length, 23); assert.equal(p.roofs.length, 49);
  assert(!p.walls.some(c => key(c) === key(p.entrance)));
  assert(p.roofs.every(c => c.z === 9)); assert.equal(p.equipment.services.length, 10);
  assert.equal(new Set(p.equipment.services.map(key)).size, 10);
  assert(!p.floors.some(c => key(c) === key(p.equipment.generator[0])));
  assert(p.ground.some(c => key(c) === key({ ...p.equipment.generator[0], y: 18 })));
  assert.equal(p.rotations.sump, 180);
  const sumpPort = { ...p.equipment.sump[0], x: p.equipment.sump[0].x + 1, y: p.equipment.sump[0].y - 1 };
  assert(!p.walls.some(c => key(c) === key(sumpPort)));
  assert(!p.equipment.heater.some(c => key(c) === key(sumpPort)));
});
test('only actually attended and supplied work progresses; cancellation and waiting grant no completion', () => {
  const w = { required: 900, progress: 0 };
  Workshop.progress(w, 3600, false); Workshop.progress(w, 3600, true, false); assert.equal(w.progress, 0);
  Workshop.progress(w, 120, true); assert.equal(w.progress, 120);
  const restored = JSON.parse(JSON.stringify(w)); Workshop.progress(restored, 900, true); assert.equal(restored.progress, 900);
  assert.equal(w.progress, 120); assert.equal(Workshop.progress(restored, 600, true), 0);
});
test('personal observations refresh only visible cells, keeping other stocks and fixtures dated', () => {
  const s = Workshop.create(), a = { x: 28, y: 15, z: 8 }, b = { x: 33, y: 15, z: 8 };
  Workshop.establish(s, destination, layout(), 10, context);
  const goods = [{ id: 'one', key: 'metalParts', quantity: 2, cell: a, secret: 'hidden chemistry' }, { id: 'two', key: 'glass', quantity: 9, cell: b }];
  const fixtures = [{ id: 'f', name: 'Generator', origin: a, condition: 100, utility: { enabled: true, fuel: 2, secretFault: 'unknown', contents: { undisclosedWasteIdentity: 2 } } }];
  Workshop.observe(s, 20, [a, b], goods, fixtures, true);
  Workshop.observe(s, 30, [a], [], [{ ...fixtures[0], condition: 50 }], null);
  const v = Workshop.publicView(s); assert.deepEqual(v.observations.goods, [{ id: 'two', key: 'glass', quantity: 9, cell: b, at: 20 }]);
  assert.equal(v.observations.fixtures[0].at, 30); assert.equal(v.observations.shell.at, 20);
  assert(!JSON.stringify(v).includes('privateDeposit')); assert(!JSON.stringify(v).includes('secretFault')); assert(!JSON.stringify(v).includes('hidden chemistry'));
  assert(!JSON.stringify(v).includes('undisclosedWasteIdentity')); assert.equal(v.observations.fixtures[0].wasteUnits, 2);
});
test('away projection and save normalization never grant live inventory, reroll a site or mutate it', () => {
  const s = Workshop.create(); Workshop.establish(s, destination, layout(), 10, context);
  s.site.privateEnemies = ['unknown']; s.receipts.push({ at: 30, summary: 'Historical supplied test' });
  const saved = Workshop.normalize(s), view = Workshop.publicView(saved);
  assert.deepEqual(saved, s); assert(!JSON.stringify(view).includes('privateEnemies')); assert(!JSON.stringify(view).includes('fixtureIds'));
  view.observations.goods.push({ id: 'fake' }); assert.deepEqual(s.observations.goods, []);
  saved.site.layout.origin.x = 99; assert.equal(s.site.layout.origin.x, 27);
});
