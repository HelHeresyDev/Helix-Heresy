const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../creature-formation'), S = F.Sporecaps;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const specimen = (souled = true) => ({ ...S.body(), id: 'original-cap', family: 'sporecap', status: 'alive', health: 100, maxHealth: 100,
  injuries: [], formationSoul: { present: souled, id: souled ? 'original-soul' : null }, planterId: 'original-planter' });
const environment = x => ({ temperature: 20, humidity: 60, light: 0, ...x });
const hooks = (outputs = []) => ({ hasWill: F.hasWill, damage: F.damage, emitSpores: (a, kg) => { outputs.push(kg); return true; } });
function conserved(a) {
  near(S.dryMass(a) + a.respiredKg + a.discardedSpentKg + a.emittedSporeKg + a.washedSporeKg, a.materialReceivedKg);
  near(a.waterL + a.evaporatedL, a.waterReceivedL);
}
test('natural Research 0 / Production 0 fungus requires both performed controls, not Rootling discovery', () => {
  const s = F.create(); assert.equal(F.FAMILIES.sporecap.natural, true); assert.equal(F.FAMILIES.sporecap.researchTier, 0); assert.equal(F.FAMILIES.sporecap.synthesisTier, 0);
  assert.equal(F.research(s, 'fungusDocument', {}, 0), false);
  for (const m of ['notes', 'fungusCharacterize', 'fungusWetTrial']) assert.equal(F.research(s, m, { taskId: m }, 0), true);
  assert.equal(F.research(s, 'fungusDocument', {}, 0), false);
  F.research(s, 'fungusDryTrial', { taskId: 'real-dry-control' }, 1); F.research(s, 'fungusDocument', { taskId: 'real-document' }, 2);
  assert.equal(s.rootPattern, null); assert.ok(s.fungalPattern.evidenceIds.includes('real-dry-control'));
});
for (const souled of [true, false]) test(`four-hour supplied fungal development preserves ${souled ? 'new gathered soul' : 'unassisted soul absence'}`, () => {
  const s = F.create(); s.fungalPattern = { family: 'sporecap' }; const spent = {};
  const r = F.begin(s, 'original-tube', [], F.soulWindow(souled, 'original-device'), { bodyCell: { x: 1, y: 1, z: 0 } }, 0, 'sporecap');
  const h = { support: (r, seconds) => ({ ok: true, manaEnergy: 2 * seconds / r.required, soulEnergy: souled ? 2 * seconds / r.required : 0 }),
    consume: (r, amounts) => { for (const [k, n] of Object.entries(amounts)) spent[k] = (spent[k] || 0) + n; return true; },
    release: () => {}, environment: () => environment(), leakPresent: () => false };
  F.advance(s, 7200, h); assert.equal(r.status, 'forming'); const saved = F.normalize(s); F.advance(saved, 14400, h);
  const a = saved.creatures[0]; assert.equal(a.family, 'sporecap'); assert.equal(a.formationSoul.present, souled); near(saved.runs[0].manaReceived, 2);
  assert.deepEqual(spent, { fungalStarter: 1, plantCompost: 1, drinkingWater: 1 }); conserved(a);
});
test('finite formation buffer is not restored by recovery and does not substitute a soulless creature', () => {
  const s = F.create(); s.fungalPattern = {};
  const r = F.begin(s, 'tube', [], F.soulWindow(true, 'device'), { bodyCell: {} }, 0, 'sporecap');
  let available = false; const h = { support: (r, seconds) => ({ ok: available, soulEnergy: available ? 2 * seconds / r.required : 0, manaEnergy: available ? 2 * seconds / r.required : 0 }), consume: () => true, release: () => {} };
  F.advance(s, 900, h); available = true; F.advance(s, 960, h); assert.equal(r.buffer, 900);
  available = false; F.advance(s, 1860, h); assert.equal(r.status, 'failed'); assert.equal(s.creatures.length, 0);
});
test('decomposition consumes real contacting plant material into finite reserves, spent substrate and respiratory losses without sunlight', () => {
  const a = specimen(); S.step(a, environment(), 3600, 3600, hooks());
  near(a.digestedKg, .05); near(a.feedKg, .95); near(a.spentKg, .0125); near(a.respiredKg, .035); conserved(a);
  assert.equal(S.feed(a, { kg: .25, substances: {}, sourceIds: ['original-waste'] }), true); conserved(a);
  assert.equal(S.feed(a, { kg: 2, sourceIds: [] }), false);
});
test('pollutants move into tissue and spent substrate, never into magically clean output', () => {
  const a = specimen(); S.feed(a, { kg: .25, substances: { toxin: 1 }, sourceIds: ['original-cuttings'] });
  for (let n = 0; n < 6; n++) S.step(a, environment(), 3600, n * 3600, hooks());
  near(S.total(a.feedLoads) + S.total(a.tissueLoads) + S.total(a.spentLoads), 1);
  const out = S.collectSpent(a); assert.ok(out.substances.toxin > 0); assert.ok(out.sourceIds.includes('original-cuttings')); conserved(a);
  near(S.total(a.feedLoads) + S.total(a.tissueLoads) + S.total(a.spentLoads) + S.total(out.substances), 1);
});
test('exposed spores spend finite body reserves and never add independent individuals', () => {
  const a = specimen(), outputs = []; S.step(a, environment(), 7200, 7200, hooks(outputs));
  near(a.emittedSporeKg, .01); near(outputs.reduce((n, kg) => n + kg, 0), .01); conserved(a);
});
test('sub-gram spent substrate and its pollutant remainder stay in the original mat during collection', () => {
  const a = specimen(); S.step(a, environment(), 3600, 3600, hooks());
  a.spentLoads = { retained: .5 }; const old = a.spentKg, out = S.collectSpent(a);
  near(out.kg, .012); near(a.spentKg, old - out.kg); near(a.spentLoads.retained + out.substances.retained, .5); conserved(a);
});
test('unavailable physical spore output retains pending body matter instead of deleting or inventing it', () => {
  const a = specimen(); S.step(a, environment(), 3600, 3600, { ...hooks(), emitSpores: () => false });
  near(a.pendingSporeKg, .005); assert.equal(a.emittedSporeKg, 0); conserved(a);
});
test('Rootling and Sporecap procedures cannot occupy the same uncleared original tube', () => {
  const s = F.create(); s.rootPattern = {}; s.fungalPattern = {};
  assert.ok(F.begin(s, 'original-tube', [], F.soulWindow(false), { bodyCell: {} }, 0, 'rootling'));
  assert.equal(F.begin(s, 'original-tube', [], F.soulWindow(false), { bodyCell: {} }, 0, 'sporecap'), null);
});
test('a fitted cover retains spores to finite saturation and washing transfers them into real wastewater', () => {
  const a = specimen(), outputs = []; a.coverFitted = true; a.covered = true;
  for (let n = 0; n < 6; n++) S.step(a, environment(), 3600, n * 3600, hooks(outputs));
  near(a.coverSporeKg, .02); assert.equal(outputs.length, 0); conserved(a);
  const out = S.wash(a); near(out.waterL, 1); near(out.substances[S.SPORES], 20); assert.equal(a.coverSporeKg, 0); conserved(a);
});
test('only a souled individual deliberately closes its gills against sensed disturbance', () => {
  for (const souled of [true, false]) {
    const a = specimen(souled); S.step(a, environment({ disturbed: true }), 3600, 3600, hooks());
    assert.equal(a.gillsClosed, souled); assert.equal(Boolean(a.independentIntent), souled); assert.equal(a.emittedSporeKg > 0, !souled); conserved(a);
  }
});
test('unordered soulless fungi metabolize contacting substrate but never acquire external feed, move or level', () => {
  const a = specimen(false), cell = { x: 1, y: 1, z: 0 }; a.mapCell = { ...cell };
  S.step(a, environment({ externalFoodKg: 100 }), 3600, 3600, hooks()); assert.equal(a.independentIntent, ''); assert.deepEqual(a.mapCell, cell); near(a.materialReceivedKg, 2); conserved(a);
});
test('dehydration, waterlogging, temperature and retained toxins cause real injury and irreversible death', () => {
  for (const kind of ['dry', 'wet', 'cold', 'toxin']) {
    const a = specimen(); if (kind === 'dry') a.waterL = 0; if (kind === 'wet') a.waterL = 2; if (kind === 'toxin') a.tissueLoads = { toxin: 1 };
    for (let n = 0; n < 100; n++) S.step(a, environment({ temperature: kind === 'cold' ? -20 : 20 }), 3600, n * 3600, hooks());
    assert.equal(a.status, 'dead'); const saved = JSON.stringify(a); S.step(a, environment(), 3600, 999999, hooks()); assert.equal(JSON.stringify(a), saved);
    assert.equal(S.water(a), false); assert.equal(S.feed(a, { kg: 1 }), false);
  }
});
test('supplied water has finite capacity and does not erase existing injury', () => {
  const a = specimen(); a.waterL = .5; a.evaporatedL = .5; a.health = 50;
  assert.equal(S.water(a), true); near(a.waterL, 1.5); assert.equal(a.health, 50); conserved(a);
  assert.equal(S.water(a), false); conserved(a);
});
test('scientist death freezes original formation and fungal material instead of advancing a postmortem result', () => {
  const s = F.create(); s.fungalPattern = {}; F.begin(s, 'tube', [], F.soulWindow(false), { bodyCell: {} }, 0, 'sporecap'); s.creatures.push(specimen());
  const before = JSON.stringify(s); F.advance(s, 999999, { dead: true }); assert.equal(JSON.stringify(s), before);
});
