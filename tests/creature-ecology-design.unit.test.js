// Focused design/export contracts, not tests claiming B–D runtime balance exists.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ecology = require('../strategic-beast-ecology');
const design = require('../scripts/creature-ecology-design');
const { buildCatalog } = require('../scripts/creature-catalog-data');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const byId = new Map(design.rows.map(row => [row.id, row]));

test('exact finite 36-entry coverage retains canonical 24-species biology and bounded fields', () => {
  const catalog = buildCatalog();
  assert.equal(design.rows.length, 36);
  assert.equal(byId.size, 36);
  assert.deepEqual(new Set(byId.keys()), new Set(catalog.creatures.map(row => row.at(-1))));
  const beasts = design.rows.filter(row => row.id.startsWith('beast:'));
  assert.equal(beasts.length, 24);
  assert.deepEqual(new Set(beasts.map(row => row.id)), new Set(Ecology.BEAST_SPECIES.map(row => row.id)));
  for (const row of design.rows) {
    assert.ok(['nurturing', 'destroying', 'neutral'].includes(row.role));
    for (const field of ['name', 'body', 'senses', 'budgets', 'capability', 'limits', 'impact']) {
      assert.equal(typeof row[field], 'string', `${row.id}: ${field}`);
      assert.ok(row[field].length > (field === 'name' ? 0 : 10), `${row.id}: ${field} must be concrete`);
      assert.doesNotMatch(row[field], /undefined|\bTBD\b|new prompt required/);
    }
  }
  const doc = design.renderReference();
  for (const s of Ecology.BEAST_SPECIES) {
    assert.equal(byId.get(s.id).name, s.name);
    // Read directly from runtime catalog: no duplicate size/movement/mind authority.
    assert.ok(doc.includes(`${s.sizeBand}; ${s.intelligenceBand}; ${s.socialPattern}; ${s.diet}; ${s.ecologicalRole}; ${s.realm}: ${s.biomeCodes.join(', ')}`));
    assert.ok(doc.includes(s.movementModes.join(', ')));
  }
  assert.equal(byId.get('human').role, 'neutral');
  assert.equal(byId.get('rootling').role, 'nurturing');
  assert.equal(byId.get('sporecap').role, 'nurturing');
});

test('directed antagonisms have valid roles, actual habitat possibilities and finite limits', () => {
  assert.equal(new Set(design.antagonisms.map(edge => edge.id)).size, design.antagonisms.length);
  const species = new Map(Ecology.BEAST_SPECIES.map(s => [s.id, s]));
  for (const edge of design.antagonisms) {
    assert.equal(byId.get(edge.nurturer)?.role, 'nurturing', edge.id);
    assert.equal(byId.get(edge.destroyer)?.role, 'destroying', edge.id);
    assert.ok(edge.mechanism.length > 30 && edge.limits.length > 30, edge.id);
    const n = species.get(edge.nurturer), d = species.get(edge.destroyer);
    assert.ok(d, edge.id);
    if (edge.geography === 'local') {
      assert.ok(!n, 'local core-family credit cannot allocate a strategic population');
      continue;
    }
    assert.ok(n, edge.id);
    if (edge.geography === 'shared') {
      for (const code of edge.habitat.split(',')) {
        assert.ok(n.biomeCodes.includes(code) && d.biomeCodes.includes(code), `${edge.id}: unsupported ${code}`);
      }
    } else {
      assert.equal(edge.geography, 'ecotone');
      for (const pair of edge.habitat.split(';')) {
        const [left, right] = pair.split('|');
        assert.ok(n.biomeCodes.includes(left) && d.biomeCodes.includes(right), `${edge.id}: unsupported ecotone ${pair}`);
      }
    }
  }
});

test('every strategic nurturer/destroyer has opposition; every destructive habitat has potential coverage', () => {
  for (const row of design.rows.filter(row => row.role !== 'neutral')) {
    const edges = design.antagonisms.filter(edge => edge.nurturer === row.id || edge.destroyer === row.id);
    assert.ok(edges.length, `${row.id}: no adversary`);
    if (row.role !== 'destroying') continue;
    const d = Ecology.BEAST_SPECIES.find(s => s.id === row.id);
    const possibleHabitat = new Set(edges.flatMap(edge => edge.geography === 'shared'
      ? edge.habitat.split(',') : edge.geography === 'ecotone'
        ? edge.habitat.split(';').map(pair => pair.split('|')[1]) : []));
    for (const code of d.biomeCodes) assert.ok(possibleHabitat.has(code), `${row.id}: no potential counter at ${code}`);
  }
  // This is design-level possibility only: B–D must still establish actual reach,
  // capacity, shared seasons and viable matchups for each generated population.
});

test('exported design columns match exact identities without changing costs, food-web role or status', () => {
  const catalog = buildCatalog();
  const roleAt = catalog.headers.indexOf('Ecological disposition (approved design)');
  assert.equal(roleAt, 13);
  assert.equal(catalog.headers.length, 33);
  assert.deepEqual(catalog.headers.slice(-2), ['Source', 'Stable ID']);
  for (const row of catalog.creatures) {
    const d = byId.get(row.at(-1));
    assert.equal(row.length, catalog.headers.length);
    assert.equal(row[roleAt].toLowerCase(), d.role);
    assert.equal(row[roleAt + 1], d.impact);
    assert.equal(row[roleAt + 2], design.adversaries(d.id));
    assert.ok(row.at(-2).includes('reference/CREATURE_ECOLOGY_MATRIX.md'));
  }
  for (const s of Ecology.BEAST_SPECIES) {
    const row = catalog.ecology.find(row => row[1] === s.id);
    assert.equal(row[14], s.ecologicalRole.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()));
  }
  assert.ok(catalog.guide.some(row => row[0].includes('approved design') && row[1].includes('do not claim')));
  assert.deepEqual(catalog.planned, []);
});

test('shared contract owns seasonal budgets, causal exhaustion, conditional recovery and knowledge', () => {
  const rules = new Map(design.rules);
  assert.match(rules.get('Meaning'), /not morality/);
  assert.match(rules.get('Finite local ledgers'), /seasonal minimum/);
  assert.match(rules.get('Effective capacity'), /no double-spending/);
  assert.match(rules.get('Effective capacity'), /not animal count/);
  assert.match(rules.get('Geography'), /cannot silently discard/);
  assert.match(rules.get('Generation and history'), /not by relabeling it exhausted/);
  assert.match(rules.get('Exhausted territories'), /defeated\/displaced nurturers/);
  assert.match(rules.get('Living consequences and recovery'), /No automatic respawn/);
  assert.match(rules.get('Knowledge and persistence'), /not an omniscient public census/);
  assert.match(rules.get('Agency and antagonism'), /Slimes never communicate\/cooperate/);
  assert.match(byId.get('beast:storm-kite').limits, /agitates swarms, not pacifies/);
  assert.match(byId.get('hauntbound').limits, /Not producible/);
  assert.match(rules.get('Carrion Lantern'), /cannot force player movement/);
  assert.match(rules.get('Preserved consumers'), /paid one-observation Soul Lash/);
  assert.equal(design.packages.length, 4);
  assert.match(design.packages[3][1], /Close 3.38 here/);
});

test('published matrix is reproducible and explicitly separates design from runtime', () => {
  assert.equal(read('reference/CREATURE_ECOLOGY_MATRIX.md'), design.renderReference());
  assert.match(design.STATUS, /not a runtime implementation/);
  // The exporter may import this reference; browser/game source must not.
  for (const file of ['app.js', 'index.html', 'strategic-beast-ecology.js', 'wilderness-beasts.js']) {
    assert.doesNotMatch(read(file), /creature-ecology-design/);
  }
  assert.match(read('reference/DESIGN_BIBLE.md'), /Exhausted territories/);
  assert.match(read('reference/DESIGN_BIBLE.md'), /remaining physical, behavioral and regional simulation implementation/);
});

test('monthly design contract fixes cadence, rate units and gradual finite accounting', () => {
  const m = design.monthlyEcology;
  assert.equal(m.planningCadence, 'oncePerGameMonth');
  assert.equal(m.application, 'gradualEventBoundedAccrual');
  assert.equal(m.rateUnit, 'ecologicalPointsPerIndividualPerGameDayPerLedger');
  assert.match(m.pointDefinition, /one hectare.*one percentage point.*one environmental ledger/);
  assert.deepEqual(m.ledgers, ['soilCover', 'freshwaterQuantity', 'freshwaterQuality', 'wetlandReefHabitat', 'renewableBiomass', 'arcaneStability']);
  const rules = new Map(m.rules);
  assert.match(rules.get('Rate accounting'), /actual game-calendar month duration/);
  assert.match(rules.get('Rate accounting'), /sample rates are illustrative/);
  assert.match(rules.get('Gradual effects'), /not.*upfront/i);
  assert.match(rules.get('Gradual effects'), /evaluated lazily/);
  assert.match(rules.get('Group movement'), /integer membership/);
  assert.match(rules.get('Group movement'), /transit feeding, damage and losses/);
  assert.match(rules.get('Group movement'), /carries into later months/);
  assert.equal(m.wholePopulationTeleport, false);
  assert.equal(m.localReactionsRemainResponsive, true);
  assert.match(rules.get('Persistence and evidence'), /cannot double-apply effects, reroll a bad destination or refill food/);
  assert.match(design.packages[3][1], /Plan once per game month/);
  assert.ok(buildCatalog().guide.some(row => row[0] === 'Monthly ecology — approved design' && row[1].includes('not an implemented monthly planner')));
});

test('migration design contract excludes private destination truth and permits repeated failure', () => {
  const m = design.monthlyEcology;
  assert.deepEqual(m.decisionInputs, ['innateMigrationPattern', 'personallyRetainedMemory', 'actuallyReceivedInformation', 'currentLocalPerception']);
  assert.deepEqual(m.forbiddenDecisionInputs, ['hiddenDestinationCapacity', 'unobservedIncomingGroups', 'globalHabitatRanking', 'futureResourceTruth']);
  assert.ok(m.decisionInputs.every(input => !m.forbiddenDecisionInputs.includes(input)));
  assert.equal(m.destinationCapacityReservations, false);
  assert.equal(m.guaranteesSuccessfulArrival, false);
  const modes = new Map(m.migrationModes.map(mode => [mode.id, mode]));
  assert.equal(modes.size, 3);
  assert.match(modes.get('instinctive').limits, /Do not change a traditional destination/);
  assert.match(modes.get('forcedDispersal').choice, /essentially randomly/);
  assert.match(modes.get('forcedDispersal').limits, /No global habitat search/);
  assert.match(modes.get('informed').limits, /source\/date and uncertainty/);
  assert.match(modes.get('informed').limits, /stale or wrong/);
  const rules = new Map(m.rules);
  assert.match(rules.get('No invisible traffic controller'), /may converge, overcrowd and compete/);
  assert.match(rules.get('Discovery and failure'), /Forced dispersal may fail repeatedly/);
  assert.match(rules.get('Discovery and failure'), /starvation, conflict or a second departure/);
  assert.match(rules.get('Interruptions and local reactions'), /unseen destination does not cancel an instinctive departure/);
  assert.match(read('PENDING_PROMPTS.md'), /active count remains 13/);
  assert.match(read('reference/DESIGN_BIBLE.md'), /Initial healthy ecology does not guarantee continued balance/);
  assert.ok(buildCatalog().guide.some(row => row[0] === 'Migration knowledge — approved design'));
});

test('every current entry has twelve finite numeric baseline coefficients and an explicit counting basis', () => {
  assert.equal(design.rateProfiles.length, 36);
  assert.equal(design.rateProfileById.size, 36);
  assert.deepEqual(new Set(design.rateProfiles.map(p => p.id)), new Set(byId.keys()));
  assert.deepEqual(design.rateLedgers.map(([id]) => id), design.monthlyEcology.ledgers);
  for (const p of design.rateProfiles) {
    assert.equal(p.nurturing.length, 6, p.id);
    assert.equal(p.destruction.length, 6, p.id);
    assert.equal(design.rateCells(p.id).length, 12);
    assert.ok([...p.nurturing, ...p.destruction].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0), p.id);
    assert.ok(p.basis.length > 15 && p.notes.length > 50, p.id);
    assert.match(p.status, /Initial balance values; not runtime rates/);
  }
  const p = id => design.rateProfileById.get(id);
  assert.deepEqual([p('beast:ironroot-colossus').nurturing[0], p('beast:ironroot-colossus').destruction[0]], [40, 4]);
  assert.deepEqual([p('beast:ashhorn-behemoth').nurturing[0], p('beast:ashhorn-behemoth').destruction[0]], [1, 60]);
  assert.deepEqual([p('beast:gravebloom-elk').nurturing[0], p('beast:gravebloom-elk').destruction[0]], [2, 1]);
  assert.ok(p('beast:glasswing-roc').nurturing.every(n => n === 0), 'predator control is not duplicate direct restoration');
  assert.equal(p('beast:ember-ant').destruction[4] * 100000, 40);
  assert.match(p('beast:ember-ant').basis, /worker, not a hive/);
  assert.match(p('beast:brine-cathedral').basis, /superorganism, not one polyp/);
  assert.match(p('beast:marsh-hydra').basis, /all heads combined/);
  assert.match(p('slime').notes, /not a claim all slimes weigh 1 kg/);
  assert.ok(design.rateCells('hauntbound').every(n => n === 0), 'explicit zero is not unknown');
  assert.throws(() => design.rateCells('missing'), /Missing numeric ecological rate profile/);
});

test('numeric rate columns and dedicated rate sheet share the exact authoritative coefficients', () => {
  const c = buildCatalog();
  const first = c.headers.indexOf('Soil / cover nurture (EP/individual/day)');
  assert.equal(first, 16);
  assert.equal(c.rates.length, 36);
  assert.equal(c.rateHeaders.length, 19);
  for (const row of c.creatures) {
    const id = row.at(-1), profile = design.rateProfileById.get(id);
    assert.deepEqual(row.slice(first, first + 12), design.rateCells(id));
    assert.deepEqual(row.slice(first + 12, first + 15), [profile.basis, profile.status, profile.notes]);
    const rateRow = c.rates.find(r => r.at(-1) === id);
    assert.equal(rateRow.length, c.rateHeaders.length);
    assert.deepEqual(rateRow.slice(4, 16), design.rateCells(id));
    assert.equal(rateRow[2], profile.basis);
    assert.equal(rateRow[3], profile.status);
  }
  assert.match(c.ecologyDesignReference, /Numeric ecological rates — all 36 entries/);
  assert.match(c.ecologyDesignReference, /not measured or live-game rates/);
});
