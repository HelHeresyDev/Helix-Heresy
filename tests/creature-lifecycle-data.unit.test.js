// Focused reference-data/calculation/source preservation tests, not live population tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../scripts/creature-lifecycle-data');
const E = require('../scripts/creature-ecology-design');
const { buildCatalog } = require('../scripts/creature-catalog-data');
const F = require('../creature-formation');
const H = require('../homunculi');
const approx = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const actor = body => ({ ...body, health: 100, maxHealth: 100, injuries: [], status: 'alive', chamberId: 'c', mapCell: { x: 0, y: 0, z: 0 } });
const p = id => L.byId.get(id);

test('exact current roster has complete typed lifecycle fields and explicit applicability', () => {
  assert.equal(L.profiles.length, 36);
  assert.equal(L.byId.size, 36);
  assert.deepEqual(new Set(L.byId.keys()), new Set(E.rows.map(row => row.id)));
  assert.equal(L.rows().length, 36);
  assert.equal(L.headers.length, L.widths.length);
  for (const profile of L.profiles) {
    for (const [key] of L.fields) {
      const v = profile[key];
      assert.notEqual(v, undefined, `${profile.id}.${key}`);
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${profile.id}.${key}`);
      else assert.ok(v === null || typeof v === 'string', `${profile.id}.${key}`);
    }
    assert.ok(profile.adultKg > 0);
    assert.ok(profile.newbornKg === null || profile.newbornKg <= profile.adultKg);
    assert.ok(profile.adultDays >= 0 && profile.independentDays >= 0);
    assert.ok(profile.fertileDays === null || profile.fertileDays >= profile.adultDays);
    assert.ok(profile.ageingDays === null || profile.ageingDays >= profile.adultDays);
    assert.equal(profile.ageingDays === null, profile.doublingDays === null);
    assert.ok(profile.doublingDays === null || profile.doublingDays > 0);
    assert.match(profile.status, /Initial|initial/);
    assert.ok(profile.breeder.length > 20 && profile.notes.length > 30 && profile.source);
    assert.ok(profile.newbornKg !== null || profile.offspring === 0);
  }
  for (const row of L.rows()) assert.equal(row.length, L.headers.length);
});

test('reproductive units, material investment and special nonparental forms cannot be conflated', () => {
  for (const profile of L.profiles) {
    assert.ok(profile.success >= 0 && profile.success <= 1);
    assert.ok(Number.isInteger(profile.offspring) && profile.offspring >= 0);
    assert.ok(profile.attempts365 >= 0 && profile.birthMaterialKg >= 0);
    assert.ok(profile.assimilation >= 0 && profile.assimilation <= 1);
    if (profile.cooldownDays > 0) assert.ok(profile.attempts365 <= 365 / profile.cooldownDays + 1e-8, profile.id);
    if (profile.massSource.startsWith('Partition') || !profile.offspring) assert.equal(profile.birthMaterialKg, 0);
    else approx(profile.birthMaterialKg * profile.assimilation, profile.newbornKg * profile.offspring);
  }
  assert.match(p('beast:ember-ant').breeder, /One actual fertile queen/);
  assert.equal(p('beast:ember-ant').adultMortality, 3);
  assert.equal(p('beast:ember-ant').breederMortality, 0.02);
  assert.equal(p('beast:ember-ant').breederKg, 0.05);
  assert.equal(p('beast:ember-ant').breederAgeingDays, 1825);
  assert.match(p('beast:brine-cathedral').basis, /never a polyp/);
  assert.match(p('beast:marsh-hydra').basis, /not a head/);
  for (const id of ['mudlet', 'cinderling', 'zephyrMote', 'quartzShardling', 'lanternWisp']) {
    assert.equal(p(id).fertileDays, null);
    assert.match(p(id).breeder, /One actual/);
    assert.equal(p(id).breederKg, null);
    assert.ok(p(id).birthMaterialKg > 0);
  }
  for (const id of ['hauntbound', 'homunculus']) {
    assert.equal(p(id).offspring, 0);
    assert.equal(p(id).attempts365, 0);
    assert.equal(p(id).fertileDays, null);
  }
  assert.match(p('homunculus').notes, /not a claim of biological sterility/);
});

test('implemented feline and luminous upkeep match actual model steps', () => {
  const cat = actor(F.Duskcats.body()), food = cat.foodKg, water = cat.waterL;
  F.Duskcats.step(cat, { temperature: 20, light: 50 }, 3600, 3600, { hasWill: () => false });
  approx(p('duskcat').foodKgDay, (food - cat.foodKg) * 24);
  approx(p('duskcat').waterLDay, (water - cat.waterL) * 24);
  approx(p('duskcat').adultKg, 2.5);
  const w = actor(F.Wisps.body()); w.manaReserve = 16;
  F.Wisps.step(w, { temperature: 20 }, 3600, 3600, { hasWill: () => false });
  approx(p('lanternWisp').manaDay, (16 - w.manaReserve) * 24);
  assert.equal(p('lanternWisp').manaCapacity, 16);
  const dim = actor(F.Wisps.body()); dim.manaReserve = 1;
  F.Wisps.step(dim, { temperature: 20 }, 3600, 3600, { hasWill: () => true });
  approx((1 - dim.manaReserve) * 24, 12);
  assert.match(p('lanternWisp').notes, /12\/day/);
});

test('implemented botanical and fungal consumption reflect actual nominal care conditions', () => {
  const root = actor(F.Rootlings.body()), before = { org: root.mediumOrganicKg, mineral: root.mediumMineralKg, water: root.waterL };
  F.Rootlings.step(root, { light: 30, temperature: 20 }, 3600, 3600, { hasWill: () => false, damage: () => assert.fail('healthy nominal plant') });
  approx(p('rootling').foodKgDay, (before.org - root.mediumOrganicKg) * 24);
  approx(p('rootling').mineralsKgDay, (before.mineral - root.mediumMineralKg) * 24);
  approx(p('rootling').waterLDay, (before.water - root.waterL) * 24);
  const fungus = actor(F.Sporecaps.body()), oldFood = fungus.feedKg, oldWater = fungus.waterL;
  F.Sporecaps.step(fungus, { temperature: 20, humidity: 50 }, 3600, 3600, { hasWill: () => false, damage: () => assert.fail('healthy nominal fungus'), emitSpores: () => true });
  approx(p('sporecap').foodKgDay, (oldFood - fungus.feedKg) * 24);
  approx(p('sporecap').waterLDay, (oldWater - fungus.waterL) * 24);
  approx(p('quartzShardling').mineralsKgDay, F.Shardlings.MATERIALS.quartz.biteKgPerHour * 24);
  assert.match(p('quartzShardling').notes, /maintenance can be 0.06 kg\/day/);
  assert.equal(p('rootling').travelKmDay, 0);
  assert.equal(p('sporecap').travelKmDay, 0);
});

test('implemented elemental demand, formation clocks and accelerated-body exceptions stay explicit', () => {
  const s = F.create();
  const make = family => {
    const a = actor({ family, id: family, formationSoul: { present: false }, clayKg: 2, waterL: 2, evaporatedL: 0,
      fuelUnits: 2, fuelReceived: 2, burnedUnits: 0, ashUnits: 0, emittedUnits: 0, temperatureC: 360, heatEmitted: 0,
      manaReserve: 16, manaSpent: 0, coherence: 100, aperture: 'sealed', airParcel: {}, lastMoveAt: 0 });
    s.creatures.push(a); return a;
  };
  const mud = make('mudlet'), ember = make('cinderling'), mote = make('zephyrMote');
  F.advance(s, 3600, { environment: () => ({ temperature: 20, humidity: 50, air: true }), leakPresent: () => false, move: () => false, emitFire: () => {} });
  approx(p('mudlet').waterLDay, mud.evaporatedL * 24);
  approx(p('cinderling').fuelUnitsDay, ember.burnedUnits * 24);
  approx(p('zephyrMote').manaDay, (16 - mote.manaReserve) * 24);
  assert.equal(p('homunculus').labDays, H.MODES.body.seconds / L.DAY);
  assert.equal(p('homunculus').adultKg, 48);
  assert.equal(p('duskcat').labDays, 1 / 3);
  assert.equal(p('rootling').labDays, 0.25);
  assert.equal(p('sporecap').labDays, 1 / 6);
  assert.equal(p('quartzShardling').labDays, 1 / 24);
  assert.match(p('slime').notes, /genomic life budget.*NOT replaced/);
  assert.match(read('app.js'), /360 \+ brood \* 90 \+ growth \* 4/);
});

test('age-specific hazard math is calendar-length aware and invariant under interval splitting', () => {
  const human = p('human');
  approx(L.mortalityProbability(human, human.adultDays, 30), 1 - Math.exp(-human.adultMortality * 30 / 1000));
  assert.ok(L.mortalityProbability(human, human.adultDays, 31) > L.mortalityProbability(human, human.adultDays, 28));
  for (const start of [human.adultDays - 5, human.ageingDays - 5, human.ageingDays + 3650]) {
    const whole = L.mortalityProbability(human, start, 30);
    const left = L.mortalityProbability(human, start, 12), right = L.mortalityProbability(human, start + 12, 18);
    approx(whole, 1 - (1 - left) * (1 - right));
  }
  assert.ok(L.mortalityProbability(human, human.ageingDays + human.doublingDays, 30) > L.mortalityProbability(human, human.ageingDays, 30));
  assert.equal(L.mortalityProbability(human, 0, 0), 0);
  assert.equal(L.mortalityProbability(p('hauntbound'), 1000000, 30), 0);
  assert.throws(() => L.mortalityProbability(human, -1, 1), /Invalid mortality interval/);
  assert.throws(() => L.mortalityProbability(human, 0, Infinity), /Invalid mortality interval/);
  assert.throws(() => L.mortalityProbability(human, Number.MAX_VALUE, Number.MAX_VALUE), /Invalid mortality interval/);
});

test('full lifecycle tab and compact Catalog/CSV values exactly match the source profiles', () => {
  const c = buildCatalog();
  assert.deepEqual(c.lifecycleHeaders, L.headers);
  assert.deepEqual(c.lifecycles, L.rows());
  for (const row of c.creatures) {
    const profile = p(row.at(-1));
    const at = c.headers.indexOf('Lifecycle food / organic intake (kg/day)');
    assert.equal(at, 31);
    assert.deepEqual(row.slice(at, at + 7), [profile.foodKgDay, profile.waterLDay, profile.attempts365, profile.offspring, profile.adultDays, profile.adultMortality, profile.status]);
    assert.ok(row.at(-2).includes('reference/CREATURE_LIFECYCLES.md'));
  }
  assert.ok(c.guide.some(row => row[0] === 'Lifecycle & resource use — numeric values'));
  assert.equal(c.headers.length, 40);
});

test('generated lifecycle reference is reproducible, design-only and preserves finite monthly consequences', () => {
  assert.equal(read('reference/CREATURE_LIFECYCLES.md'), L.renderReference());
  assert.match(L.renderReference(), /not a runtime population|not an implemented regional population/i);
  assert.match(L.renderReference(), /not fractional bodies/);
  assert.match(L.renderReference(), /excluded from a second background death charge/);
  assert.match(L.renderReference(), /use only individual instincts\/observations\/memory\/received information/);
  for (const file of ['app.js', 'index.html', 'strategic-beast-ecology.js']) assert.doesNotMatch(read(file), /creature-lifecycle-data/);
});
