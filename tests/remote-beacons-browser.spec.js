const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const Workshop = require('../hidden-workshop');
const Remote = require('../unsupported-excursions');
test.setTimeout(900000);
const destination = { id: 'remote-beacon-test', strategicCellId: 'planet-cell:00003', originCellId: 'planet-cell:00001',
  label: 'Visited Receiving Woodland', distanceKm: 42, temperatureC: 18, slopePercent: 5, precipitationMm: 500,
  jurisdiction: 'Wilderness', description: 'No overland return route.' };
const layout = Workshop.plan({ x: 27, y: 10, z: Remote.Z }), alcove = Workshop.alcovePlans(layout)[0];
const remoteReceiver = 'hidden-workshop:receiver:0', remoteBeacon = 'hidden-workshop:beacon:0';
const snap = p => p.evaluate(() => window.helixHeresyDebug.soulBeaconSnapshot());
const workshop = p => p.evaluate(() => window.helixHeresyDebug.hiddenWorkshopSnapshot());
const travel = p => p.evaluate(() => window.helixHeresyDebug.unsupportedSnapshot());
const action = (p, action, options = {}) => p.evaluate(({ action, options }) => window.helixHeresyDebug.hiddenWorkshopAction(action, options), { action, options });
const advance = (p, seconds) => p.evaluate(n => window.helixHeresyDebug.advanceReceivingWorkshopForTest(n), seconds);
async function edit(p, fn, args) { await p.evaluate(({ source, args }) => {
  const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
  // Test fixture callbacks only, never production evaluation of player input.
  Function('s', 'args', source)(s, args); d.importSurveyExpeditionTestState(s);
}, { source: fn.toString().replace(/^.*?\{/, '').replace(/\}$/, ''), args }); }
async function finish(p, construction = false) {
  for (let n = 0; n < 8; n++) {
    const s = await workshop(p), t = s.tasks[0]; if (!t) return;
    expect(t.reason, JSON.stringify({ t, events: (await snap(p)).events.slice(-3) })).toBe('');
    const seconds = Math.max(2, Math.ceil(t.dueAt - s.clock + 61));
    if (construction) await p.evaluate(n => window.helixHeresyDebug.advanceHiddenWorkshopForTest(n), seconds);
    else await advance(p, seconds);
  }
  expect((await workshop(p)).tasks).toEqual([]);
}
async function supplies(p, values, cell = layout.stagingCell) {
  return p.evaluate(({ values, cell }) => window.helixHeresyDebug.configureHiddenWorkshopTest({ supplies: values, cell }), { values, cell });
}
async function setup(p, built = false) {
  p.on('dialog', d => d.accept()); await startLifecycleRun(p, 'remote-beacon-choice');
  const ids = await p.evaluate(() => window.helixHeresyDebug.configureSoulBeaconTestLaboratory());
  await p.evaluate(destination => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'remote-beacons', publicProspects: {}, truth: {} } });
    d.configureWildernessTest({ destination: { ...destination, id: 'boundary', strategicCellId: 'planet-cell:00002' }, autoCare: false });
    d.configureUnsupportedTest({ destination, municipal: true });
    d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer', 'handSaw'] });
  }, destination);
  expect(await p.evaluate(() => window.helixHeresyDebug.bookUnsupportedExcursion())).toBe(true);
  await finish(p, true); let r = await travel(p);
  await p.evaluate(n => window.helixHeresyDebug.advanceBoundaryTravelForTest(n), r.trip.fieldAt - r.clock);
  await p.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ beasts: [] }));
  const saved = Workshop.create(); Workshop.establish(saved, destination, layout, r.clock, {
    alive: true, local: true, visited: true, wilderness: true, observed: true, clear: true, roomId: Remote.ROOM });
  // Explicit pre-existing, visited workshop fixture. New alcove construction is
  // earned in the first case; ready receivers in later cases isolate handoff.
  await edit(p, function (s, args) {
    const { saved, layout, alcove, built } = args, site = saved.site;
    s.hiddenWorkshop = saved; site.shellBuiltAt = s.clock;
    s.scientist.roomId = 'remoteSurveyLanding'; s.scientist.mapCell = layout.workCell;
    s.labMap.terrain.excavated.push(...layout.ground, ...alcove.ground);
    const shell = built ? { floors: [...layout.floors, ...alcove.floors], roofs: [...layout.roofs, ...alcove.roofs],
      walls: layout.walls.filter(c => JSON.stringify(c) !== JSON.stringify(alcove.opening)).concat(alcove.walls) } : layout;
    for (const [purpose, cells] of [['floor', shell.floors], ['roof', shell.roofs]])
      s.labMap.terrain.constructedFloors.push(...cells.map(cell => ({ cell, materialId: 'wood', purpose, condition: 100, builtAt: s.clock, supportSpanM: 8 })));
    s.labMap.terrain.constructedWalls.push(...shell.walls.map(cell => ({ cell, materialId: 'wood', condition: 100, builtAt: s.clock })));
    if (built) {
      site.receivingAlcove = { layout: alcove, plannedAt: s.clock, builtAt: s.clock };
      site.layout = { ...layout, ...shell, equipment: { ...layout.equipment, ...alcove.equipment },
        rotations: { ...layout.rotations, ...alcove.rotations }, ground: [...layout.ground, ...alcove.ground] };
      for (const c of alcove.ground) s.mapCellObservations[`${c.x},${c.y},${c.z}`] = { at: s.clock };
    }
    for (const [role, cells] of Object.entries(site.layout.equipment)) {
      if (!['bench', 'generator', 'mana', 'water', 'sump', 'services', 'receiver', 'beacon', 'receiverServices'].includes(role)) continue;
      site.fixtureIds[role] = [];
      for (const [i, origin] of cells.entries()) {
        const id = `hidden-workshop:${role}:${i}`; site.fixtureIds[role].push(id);
        s.fixtures.push({ id, typeId: args.types[role], name: `Prepared workshop ${role}`, origin, rotation: site.layout.rotations?.[role] || 0,
          condition: 100, operationalState: 'operational', materialPolicy: role === 'bench' ? 'wood' : 'steel',
          utility: { enabled: !['receiver', 'beacon'].includes(role), mode: role === 'mana' ? 'feedstock' : undefined,
            powerMode: 'electric', fuel: role === 'generator' ? 48 : 0, feedstock: role === 'mana' ? 24 : 0,
            storedMana: role === 'mana' ? 100 : 0, contents: role === 'water' ? { cleanWater: 120 } : {}, maintenanceIntervalHours: 0 } });
      }
    }
    for (const id of ['soulBeaconReconstruction', 'receivingBodyDevelopment', 'soulTransferIntegration']) s.research.projects[id].status = 'completed';
    s.research.unlocks.push('fixtureBlueprint:soulReceiver', 'fixtureBlueprint:soulBeacon');
  }, { saved, layout, alcove, built, types: Workshop.EQUIPMENT });
  expect((await workshop(p)).shellIntact).toBe(true); return ids;
}
async function priorPairs(p, ids) {
  await edit(p, function (s, args) {
    const pairs = [[args.chamber, args.beacon, 'main-ready', 'main-laboratory', 'mainLab'],
      ['hidden-workshop:receiver:0', 'hidden-workshop:beacon:0', 'remote-ready', s.hiddenWorkshop.site.id, 'remoteSurveyLanding']];
    for (const [chamberId, fixtureId, id, siteId, roomId] of pairs) {
      const chamber = s.fixtures.find(f => f.id === chamberId), beacon = s.fixtures.find(f => f.id === fixtureId);
      chamber.utility.enabled = true; beacon.utility.enabled = true;
      const cell = chamber.rotation === 180 ? { ...chamber.origin, x: chamber.origin.x + 1, y: chamber.origin.y - 1 }
        : { ...chamber.origin, y: chamber.origin.y + 2 };
      s.soulBeacons.receivers.push({ id, chamberId, donorSoulId: s.soulBeacons.soul.id, status: 'ready', soulId: null,
        soulFormationPrevented: true, health: 100, cleared: false, stocks: [], supportStocks: [], consumed: {},
        progressSeconds: 604800, buffer: 1200, supportSeconds: 86400, supportConsumed: 1,
        startedAt: s.clock, readyAt: s.clock, careAt: s.clock, location: { roomId, cell } });
      s.soulBeacons.beacons.push({ id: `soul-beacon:${fixtureId}`, fixtureId, chamberId, status: 'charged', charge: 24,
        armed: true, receiverId: id, progressSeconds: 21600, startedAt: s.clock, label: beacon.name, siteId, location: { roomId, cell: beacon.origin } });
    }
  }, ids);
  expect((await snap(p)).readiness.map(r => r.reason)).toEqual(['', '']);
}
async function die(p) {
  await p.evaluate(() => window.helixHeresyDebug.setHomunculusTestSupport({ killScientist: true }));
  const s = await snap(p); expect(s.saved.handoff.status).toBe('pending'); return s.saved.handoff.deathId;
}
async function choose(p, id) { await p.locator(`[data-soul-beacon-destination="${id}"]`).check(); }

test('paid attended receiving alcove, independent equipment and actual local growth use the workshop network', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page);
  expect(await action(page, 'install', { role: 'receiver' })).toBe(false);
  expect(await action(page, 'planAlcove')).toBe(false); // Outside ground has not been personally inspected.
  await edit(page, function (s, args) { for (const c of args.ground) s.mapCellObservations[`${c.x},${c.y},${c.z}`] = { at: s.clock }; }, alcove);
  expect(await action(page, 'planAlcove')).toBe(true); expect(await action(page, 'alcove')).toBe(false);
  await supplies(page, Workshop.ALCOVE_COSTS); expect(await action(page, 'alcove')).toBe(true);
  await advance(page, 120); const partial = (await workshop(page)).tasks[0].data.work.progress;
  expect(partial).toBeGreaterThan(0); expect(partial).toBeLessThan(7200);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await workshop(page)).tasks[0].data.work.progress).toBe(partial);
  await finish(page, true); expect((await workshop(page)).saved.site.receivingAlcove.builtAt).not.toBeNull();
  expect(await action(page, 'alcove')).toBe(false);
  for (const [role, costs] of [['receiver', { steelPanels: 16, metalParts: 12, glass: 12, rubber: 8, arcaneFeedstock: 8 }],
    ['beacon', { metalParts: 20, glass: 12, rubber: 4, arcaneFeedstock: 12 }],
    ['receiverServices', { metalParts: alcove.equipment.receiverServices.length * 2, rubber: alcove.equipment.receiverServices.length }]]) {
    if (role === 'receiver') {
      await edit(page, function (s) { s.research.projects.receivingBodyDevelopment.status = 'available';
        s.research.unlocks = s.research.unlocks.filter(id => id !== 'fixtureBlueprint:soulReceiver'); });
      await supplies(page, costs); expect(await action(page, 'install', { role })).toBe(false);
      await edit(page, function (s) { s.research.projects.receivingBodyDevelopment.status = 'completed'; s.research.unlocks.push('fixtureBlueprint:soulReceiver'); });
    } else await supplies(page, costs);
    const installed = await action(page, 'install', { role });
    expect(installed, `${role}: ${JSON.stringify((await snap(page)).events.slice(-4))}`).toBe(true); await finish(page, true);
    expect(await action(page, 'install', { role })).toBe(false);
  }
  let s = await snap(page); const receiver = s.fixtures.find(f => f.id === remoteReceiver);
  expect(receiver.utility.enabled).toBe(false); expect(s.fixtures.find(f => f.id === remoteBeacon).utility.enabled).toBe(false);
  const preview = await page.evaluate(id => window.helixHeresyDebug.soulBeaconWorkPreview('inspect', id), remoteReceiver);
  expect(preview.context.local).toBe(true); expect(preview.cell).toEqual({ x: 24, y: 15, z: 8 });
  expect(await page.evaluate(id => window.helixHeresyDebug.soulBeaconAction('inspect', id), remoteReceiver)).toBe(true); await finish(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.soulBeaconAction('grow', id), remoteReceiver)).toBe(false);
  await supplies(page, { biomass: 80, geneticMaterial: 10, growthMedium: 24, humanTissueTemplate: 1 }, { x: 23, y: 15, z: 8 });
  await edit(page, function (s) {
    for (const i of s.physicalItemStacks) {
      if (i.key === 'growthMedium') i.biology = { quality: 90 };
      if (i.key === 'humanTissueTemplate') i.biology = { family: 'human', donorId: 'scientist', examined: true, quality: 90 };
    }
    s.wildernessSurvival.hunger = 0; s.wildernessSurvival.thirst = 0; s.wildernessSurvival.exertion = 0;
    const mana = s.fixtures.find(f => f.id === 'hidden-workshop:mana:0'); mana.utility.feedstock = 24; mana.utility.storedMana = 100;
  });
  expect(await page.evaluate(id => window.helixHeresyDebug.soulBeaconAction('grow', id), remoteReceiver)).toBe(true); await finish(page);
  s = await snap(page); expect(s.saved.receivers).toHaveLength(1); expect(s.saved.receivers[0].location.roomId).toBe(Remote.ROOM);
  const before = s.fixtures.find(f => f.id === 'hidden-workshop:water:0').utility.contents.cleanWater;
  await advance(page, 120); s = await snap(page);
  expect(s.saved.receivers[0].progressSeconds).toBeGreaterThanOrEqual(120);
  expect(s.fixtures.find(f => f.id === 'hidden-workshop:water:0').utility.contents.cleanWater).toBeLessThan(before);
  for (const ids of (await workshop(page)).utilities.water.filter(ids => ids.includes(remoteReceiver))) expect(ids.every(id => id.startsWith('hidden-workshop:'))).toBe(true);
  expect(errors).toEqual([]);
});

test('saved fallback choice returns remotely once, preserves the old body and requires a fresh paid physical pickup', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const ids = await setup(page, true); await priorPairs(page, ids);
  const world = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world));
  const [radio] = await supplies(page, { satelliteCommunicator: 1 }, { x: 30, y: 15, z: 8 });
  expect(await action(page, 'pack', { stackId: radio })).toBe(true); await finish(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.toggleWildernessRadio(); d.configureWildernessTest({ radioCharge: 333 }); });
  const death = await die(page), atDeath = (await snap(page)).clock;
  expect((await snap(page)).saved.handoff.choices).toHaveLength(2);
  await choose(page, `soul-beacon:${ids.beacon}`);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snap(page)).saved.handoff.selectedId).toBe(`soul-beacon:${ids.beacon}`);
  await edit(page, function (s, args) { s.fixtures.find(f => f.id === args).condition = 0; }, ids.beacon);
  expect(await page.evaluate(id => window.helixHeresyDebug.confirmSoulBeaconRecoveryForTest(id), death)).toBe(false);
  let s = await snap(page); expect(s.saved.handoff.choices.map(c => c.id)).toEqual([`soul-beacon:${remoteBeacon}`]);
  expect(s.saved.beacons.map(b => b.charge)).toEqual([24, 24]); expect(s.saved.transfers).toHaveLength(0);
  await advance(page, 10000); expect((await snap(page)).clock).toBe(atDeath);
  await choose(page, `soul-beacon:${remoteBeacon}`);
  expect(await page.evaluate(id => window.helixHeresyDebug.confirmSoulBeaconRecoveryForTest(id), death)).toBe(true);
  s = await snap(page); expect(s.clock).toBe(atDeath); expect(s.scientist.roomId).toBe(Remote.ROOM);
  expect(s.saved.receivers.map(r => r.status)).toEqual(['ready', 'embodied']); expect(s.saved.beacons.map(b => b.charge)).toEqual([24, 0]);
  expect(s.saved.transfers).toHaveLength(1); expect(s.remains).toHaveLength(1);
  expect(s.stacks.find(i => i.id === radio)).toMatchObject({ carriedBy: '', roomId: Remote.ROOM });
  let r = await travel(page); expect(r.trip).toMatchObject({ residence: true, status: 'field', pickup: { status: 'unbooked', opensAt: null } });
  expect(r.survival.radios[radio]).toMatchObject({ charge: 333, powered: false });
  expect(await page.evaluate(() => window.helixHeresyDebug.requestUnsupportedPickup())).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
  // An imperfect return cannot remotely retrieve old possessions through the
  // receiving alcove's walls. Physically revisit the old body's location.
  expect(await page.evaluate(cell => window.helixHeresyDebug.startScientistMove('remoteSurveyLanding', { toCell: cell, urgent: true }), layout.workCell)).toBeTruthy();
  await finish(page);
  expect(await action(page, 'pack', { stackId: radio })).toBe(true); await finish(page); await page.evaluate(() => window.helixHeresyDebug.toggleWildernessRadio());
  r = await travel(page); expect(r.survival.radios[radio].charge).toBe(333); const money = r.money, fee = r.trip.terms.replacementFee;
  expect(await page.evaluate(() => window.helixHeresyDebug.requestUnsupportedPickup())).toBe(true);
  expect((await travel(page)).money).toBe(money - fee); expect(await page.evaluate(() => window.helixHeresyDebug.requestUnsupportedPickup())).toBe(false);
  await advance(page, 60); expect((await travel(page)).trip.request.status).toBe('refused'); expect((await travel(page)).money).toBe(money);
  r = await travel(page); await page.evaluate(n => window.helixHeresyDebug.advanceUnsupportedForTest(n), r.trip.providerReadyAt - r.clock);
  expect((await travel(page)).survival.radios[radio]).toMatchObject({ charge: 0, powered: false });
  expect(await page.evaluate(() => window.helixHeresyDebug.requestUnsupportedPickup())).toBe(false);
  // The prepared site needs an actual replacement battery, not a resurrection
  // refill. Packing and replacement use ordinary finite local supply work.
  const [battery] = await supplies(page, { relayBattery: 1 }, layout.workCell);
  expect(await action(page, 'pack', { stackId: battery })).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.replaceWildernessBattery())).toBeTruthy(); await finish(page);
  expect((await snap(page)).stacks.find(i => i.id === battery)?.quantity || 0).toBe(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.toggleWildernessRadio())).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.configureWildernessTest({ thirst: 0, hunger: 0, exertion: 0 }));
  expect(await page.evaluate(() => window.helixHeresyDebug.requestUnsupportedPickup())).toBe(true); await advance(page, 60);
  r = await travel(page); expect(r.trip.request.status).toBe('accepted'); expect(r.roomId).toBe(Remote.ROOM);
  await advance(page, r.trip.pickup.opensAt - r.clock); r = await travel(page); expect(r.trip.pickup.status).toBe('waiting');
  expect(await page.evaluate(() => window.helixHeresyDebug.boardUnsupportedPickup())).toBe(true); await finish(page);
  r = await travel(page); expect(r.trip.status).toBe('inbound'); expect(r.roomId).toBe(Remote.CABIN_ROOM);
  await advance(page, r.trip.returnAt - r.clock); r = await travel(page); expect(r.active).toBe(false); expect(r.roomId).toBe('supportedSurveyGround');
  expect(await page.evaluate(id => window.helixHeresyDebug.confirmSoulBeaconRecoveryForTest(id), death)).toBe(false);
  expect((await snap(page)).saved.transfers).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world))).toBe(world);
  expect(errors).toEqual([]);
});

test('away upkeep is finite and dated; original-lab loss permits remote return, but soul destruction permits none', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const ids = await setup(page, true); await priorPairs(page, ids);
  await edit(page, function (s) {
    const remote = s.unsupportedExcursions, w = s.wildernessSurvival;
    remote.remote = { destination: w.destination, context: w.context, materialized: w.materialized,
      shelter: w.shelter, discovery: w.discovery, beasts: s.wildernessBeasts };
    remote.active = false; remote.boundary = null;
    s.scientist.roomId = 'mainLab'; s.scientist.mapCell = { x: 47, y: 48, z: 0 };
    s.surveyExpeditions.phase = 'home'; s.wildernessSurvival.mode = 'municipal';
    s.hiddenWorkshop.observations.lastAt = s.clock;
    s.hiddenWorkshop.observations.goods = [{ id: 'dated-only', quantity: 2, key: 'metalParts', cell: { x: 30, y: 15, z: 8 }, at: s.clock }];
    s.fixtures.find(f => f.id === 'hidden-workshop:mana:0').utility.storedMana = 100;
  });
  const dated = (await workshop(page)).view.observations, before = await snap(page);
  // Exercise the ordinary global clock, not an isolated growth model or a
  // fixture that pre-fills an entire future interval's mana before consumption.
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(120));
  let s = await snap(page);
  expect(s.saved.receivers.find(r => r.id === 'remote-ready').supportSeconds).toBe(86400 - 120);
  expect(s.fixtures.find(f => f.id === 'hidden-workshop:water:0').utility.contents.cleanWater)
    .toBeLessThan(before.fixtures.find(f => f.id === 'hidden-workshop:water:0').utility.contents.cleanWater);
  expect((await workshop(page)).view.observations).toEqual(dated);
  await edit(page, function (s, args) { s.fixtures.find(f => f.id === args).condition = 0; }, ids.beacon);
  const death = await die(page); expect((await snap(page)).saved.handoff.choices.map(c => c.id)).toEqual([`soul-beacon:${remoteBeacon}`]);
  await choose(page, `soul-beacon:${remoteBeacon}`);
  expect(await page.evaluate(id => window.helixHeresyDebug.confirmSoulBeaconRecoveryForTest(id), death)).toBe(true);
  expect((await snap(page)).scientist.roomId).toBe(Remote.ROOM); expect((await travel(page)).trip.residence).toBe(true);
  // Named damage to the actual soul defeats all remaining preparations; no
  // body-health substitute, new charge or post-death construction can save it.
  await page.evaluate(() => window.helixHeresyDebug.setSoulBeaconTestSupport({ soulDamage: 100, sourceId: 'explicit-soul-destruction' }));
  await page.evaluate(() => window.helixHeresyDebug.setHomunculusTestSupport({ killScientist: true }));
  s = await snap(page); expect(s.saved.soul.integrity).toBe(0); expect(s.saved.handoff.status).toBe('unavailable');
  expect(s.saved.transfers).toHaveLength(1); expect(s.ended).toBe(true);
  expect(errors).toEqual([]);
});

test('intrusion revalidates the actual current receiving alcove after death, not a cached beast-free visit', async ({ page }) => {
  const ids = await setup(page, true); await priorPairs(page, ids); const death = await die(page);
  await choose(page, `soul-beacon:${remoteBeacon}`);
  const dated = (await workshop(page)).view.observations;
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    // Original destination choice was valid. Physical intrusion is an explicit
    // changed-state fixture, not post-death simulation or a failure roll.
    const actor = window.HelixWildernessBeasts.actor('beast:rimefang-pack', 'explicit-intruder', { x: 24, y: 15, z: 8 }, 'explicit-population', s.clock);
    actor.roomId = 'remoteSurveyLanding'; s.wildernessBeasts.actors.push(actor);
    s.unsupportedExcursions.remote = { beasts: { actors: [] } }; // deliberately stale old visit
    d.importSurveyExpeditionTestState(s);
  });
  expect(await page.evaluate(id => window.helixHeresyDebug.confirmSoulBeaconRecoveryForTest(id), death)).toBe(false);
  let s = await snap(page); expect(s.saved.handoff.choices.map(c => c.id)).toEqual([`soul-beacon:${ids.beacon}`]);
  expect(s.saved.beacons.map(b => b.charge)).toEqual([24, 24]); expect(s.saved.receivers.map(r => r.status)).toEqual(['ready', 'ready']);
  expect((await workshop(page)).view.observations).toEqual(dated);
  expect(await page.locator('#runOutcomePanel').textContent()).not.toContain('explicit-intruder');
  await choose(page, `soul-beacon:${ids.beacon}`);
  expect(await page.evaluate(id => window.helixHeresyDebug.confirmSoulBeaconRecoveryForTest(id), death)).toBe(true);
  s = await snap(page); expect(s.scientist.roomId).toBe('mainLab'); expect((await travel(page)).active).toBe(false);
  expect(s.saved.beacons.map(b => b.charge)).toEqual([0, 24]);
});

test('an old-body medical flight cannot transport a remote replacement or lend it the reserved aircraft', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const ids = await setup(page, true); await priorPairs(page, ids);
  await edit(page, function (s) {
    const w = s.wildernessSurvival, remote = s.unsupportedExcursions;
    remote.remote = { destination: w.destination, context: w.context, materialized: w.materialized,
      shelter: w.shelter, discovery: w.discovery, beasts: s.wildernessBeasts };
    remote.trip.status = 'inbound'; remote.trip.returnAt = s.clock + 120;
    remote.trip.pickup.status = 'medicalBoarded'; remote.trip.rescueReservation = 'explicit-medical-flight';
    s.scientist.roomId = 'remoteSurveyAircraft'; s.scientist.mapCell = { x: 10, y: 10, z: 9 }; s.surveyExpeditions.phase = 'inbound';
    s.medicalExtraction.coverage = { status: 'active', tripId: remote.trip.id };
    s.medicalExtraction.beacon = { armed: true, nextAt: s.clock + 60, stackId: 'old-body-radio' };
    s.medicalExtraction.mission = { id: 'explicit-medical-flight', status: 'inbound', patientLoaded: true, medicLoaded: false,
      returnAt: s.clock + 120, flightSeconds: remote.trip.terms.flightSeconds, pilot: { location: 'returning aircraft' },
      reason: 'Explicit physically loaded old patient fixture' };
  });
  const death = await die(page); await choose(page, `soul-beacon:${remoteBeacon}`);
  expect(await page.evaluate(id => window.helixHeresyDebug.confirmSoulBeaconRecoveryForTest(id), death)).toBe(true);
  let s = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(s.medicalExtraction.mission).toMatchObject({ status: 'returningEmpty', patientLoaded: false, patientBodyEndedAt: s.clock });
  expect(s.medicalExtraction.coverage.status).toBe('expired'); expect(s.medicalExtraction.beacon.armed).toBe(false);
  expect(s.unsupportedExcursions.trip.providerReadyAt).toBeGreaterThan(s.clock + 120);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(120));
  s = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(s.medicalExtraction.mission.status).toBe('failed'); expect(s.scientist.roomId).toBe(Remote.ROOM);
  expect(s.unsupportedExcursions.trip.status).toBe('field'); expect(s.soulBeacons.transfers).toHaveLength(1);
  expect(errors).toEqual([]);
});
