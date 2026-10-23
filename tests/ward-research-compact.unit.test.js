const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('../ward-research-compact');
const D = require('../city-defense');
const O = require('../outer-approach');
const Research = require('../research-system');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const source = { cityId: 'b', charterId: 'charter:b', institutionId: 'defense:b', populationSourceId: 'population:b',
    installationId: 'original-ward:b', population: 100, condition: 80, baselineEnergy: 69120 };
  const b = { source: { cityId: 'b', charterId: source.charterId, defenseId: source.institutionId, populationSourceId: source.populationSourceId,
    authority: { id: 'ruler:b', kind: 'collective' } }, representative: { id: 'original-representative', status: 'alive', health: 100, workSeconds: 3600 },
    defender: { id: 'original-defender', status: 'alive', health: 100, stamina: 100, wardMana: 120, workSeconds: 3600,
      exceptionalCapabilities: ['city-scale ward defense'], mapCell: { x: 11, y: 12, z: 1 } } };
  const front = O.create(source, b, { roomId: 'frontage', post: copy(b.defender.mapCell), service: { x: 10, y: 13, z: 1 },
    receiving: { x: 10, y: 14, z: 1 }, structure: { x: 10, y: 12, z: 1 } }, { worldId: 'w', runId: 'r' }, 0);
  b.defender.assignment = front.station.duty.id;
  const g = { cityId: 'b', clerk: { id: 'original-clerk', status: 'alive', health: 100 }, foreignCivic: { bargain: b },
    outerApproach: front, receptionWorkSeconds: 3600, powerSeconds: 3600 };
  const s = front.scientificCompact = W.create(front, b, g.clerk.id, { worldId: 'w', runId: 'r' }, 0);
  const c = { source, worldId: 'w', runId: 'r', authorityCurrent: true, bodyEpoch: 0, cell: { x: 10, y: 7, z: 1 },
    alive: true, capable: true, free: true, local: true, atDesk: true, clerkPresent: true, lineOfSight: true,
    representativePresent: true, defenderPresent: true, atStation: false, operatorContact: true,
    structurePresent: true, structureVisible: true, condition: 80, workAccessible: true, visitorPermit: true, researched: true, restrictions: [] };
  const stacks = Object.entries({ metalParts: 8, glass: 1, rubber: 4, preparedManaCrystals: 1, arcaneFeedstock: 2 }).map(([key, quantity]) =>
    ({ id: key, key, quantity, knownQuantity: quantity, section: 'resources', carriedBy: 'scientist' }));
  const tool = { id: 'original-hammer', current: 30, carriedBy: 'scientist' }, tools = [{ key: 'masonryHammer', tool,
    stack: { id: 'hammer-stack', key: 'masonryHammer', section: 'inventory', toolInstanceId: tool.id, quantity: 1, carriedBy: 'scientist' } }];
  const market = { id: 'b', treasury: 10000 }, wallet = { money: 900 }, f = { source, front, g, b, s, c, stacks, tools, market, wallet, at: 0 };
  return f;
}
const action = (f, a, expected = null) => W.action(f.s, f.front, f.g, f.market, f.c, a, expected, f.at, f.stacks, f.tools, f.wallet);
function tick(f, seconds) {
  for (let n = 0; n < seconds; n++) {
    f.at++;
    D.standby(f.front.station, f.b.defender, { installationPresent: f.c.structurePresent, condition: f.c.condition,
      incapacitated: f.c.operatorIncapacitated, suppressed: f.c.suppressed, obligation: f.c.otherDuty }, 1);
    if (f.b.defender.status === 'alive' && f.b.defender.workSeconds > 0) f.b.defender.workSeconds--;
    W.advance(f.s, f.front, f.g, f.market, f.c, f.at, f.stacks, f.tools);
  }
}
function place(f, station) { f.c.atStation = station; f.c.atDesk = !station; f.c.cell = station ? copy(f.front.layout.service) : { x: 10, y: 7, z: 1 }; }
function prove(f) {
  assert.equal(action(f, 'authorize'), true); tick(f, W.SECONDS.authorize); place(f, true);
  assert.equal(action(f, 'baseline'), true); tick(f, W.SECONDS.baseline);
  assert.equal(action(f, 'install'), true); tick(f, W.SECONDS.install);
  assert.equal(action(f, 'improved'), true); tick(f, W.SECONDS.improved); place(f, false);
}
function sign(f) {
  prove(f); assert.equal(action(f, 'negotiate'), true); tick(f, W.SECONDS.negotiate);
  assert.equal(action(f, 'sign', copy(f.s.offer)), true); tick(f, W.SECONDS.sign);
}
test('research is evidence/material/work gated and unlocks a trial hypothesis, not authority', () => {
  const p = Research.PROJECT_BY_ID.wardEfficiencyCoupling, state = Research.defaultState();
  assert.equal(p.workSeconds, 3600); assert.deepEqual(p.minimumSkills, { materialsScience: 101, animancy: 101, fabrication: 101 });
  assert.deepEqual(p.inputs.resources, { metalParts: 2, glass: 2, arcaneFeedstock: 2 });
  assert.equal(Research.projectEvaluation(p, state).evidenceMet, false);
  state.evidence = ['a', 'b'].map(specimenId => ({ methodId: 'element', sourceKey: specimenId, specimenId }));
  assert.equal(Research.projectEvaluation(p, state).evidenceMet, true);
  assert.equal(Research.projectEvaluation(p, state).prerequisitesMet, false);
  assert.equal(Research.isUnlocked(state, 'procedure:wardEfficiencyTrial'), false);
});
test('civilian authorization uses the original authority, shared clerk/power and explicit god opposition; no payment or sovereignty', () => {
  const f = fixture(), treasury = f.market.treasury, personalMana = f.b.defender.wardMana;
  assert.equal(action(f, 'authorize'), true); tick(f, 60);
  assert.equal(f.s.authorization, null); assert.equal(f.g.receptionWorkSeconds, 3540); assert.equal(f.b.representative.workSeconds, 3540);
  f.s = f.front.scientificCompact = W.normalize(f.s); tick(f, 60);
  assert.match(f.s.authorization.scope, /openly opposes the gods/); assert.equal(f.market.treasury, treasury);
  assert.equal(f.b.defender.wardMana, personalMana); assert.equal(f.s.terms, null); assert.equal(f.g.receptionAssignment, null);
});
test('actual restrictions, independent alternatives, source mismatch, custody, capacity and witnessed hostility refuse without rerolls or resources', () => {
  for (const change of [f => f.c.researched = false, f => f.c.authorityCurrent = false, f => f.c.source = { ...f.source, institutionId: 'other' },
    f => f.c.visitorPermit = false, f => f.c.free = false, f => f.c.representativePresent = false, f => f.g.receptionAssignment = 'other',
    f => f.c.restrictions = [{ id: 'actual-oath', text: 'Our published oath refuses technical service by declared opponents of the gods.', refusesDeclaredOpposition: true }],
    f => f.front.station.efficiency = { id: 'existing-city-fitting' },
    f => f.front.reports.push({ actorId: 'scientist', kind: 'outerApproachAttack', witnessId: f.s.defenderId })]) {
    const f = fixture(); change(f); const old = copy(f.stacks); assert.equal(action(f, 'authorize'), false);
    assert.equal(action(f, 'authorize'), false); assert.equal(f.s.authorization, null); assert.deepEqual(f.stacks, old); assert.equal(f.market.treasury, 10000);
  }
});
test('original parts, local work, tool and paired energy measurements demonstrate a real saving without new capacity', () => {
  const f = fixture(), mana = f.b.defender.wardMana; prove(f);
  assert.equal(f.s.baseline.energySpent, 120); assert.equal(f.s.demonstration.energySpent, 90); assert.equal(f.s.demonstration.saving, .25);
  assert.equal(f.front.station.efficiency.cityOwnerId, 'b'); assert.equal(f.stacks.find(i => i.key === 'metalParts').quantity, 6);
  assert.equal(f.stacks.find(i => i.key === 'glass').quantity, 0); assert.equal(f.tools[0].tool.current, 29);
  assert.equal(f.front.station.energy + f.front.station.standbySpent, f.front.station.initialEnergy);
  assert.equal(f.b.defender.wardMana, mana); assert.equal(f.s.terms, null); assert.equal(f.wallet.money, 900);
});
test('partial installation survives interruption/reload with exact work, owned inputs and original tool claims', () => {
  const f = fixture(); action(f, 'authorize'); tick(f, 120); place(f, true); action(f, 'baseline'); tick(f, 120);
  assert.equal(action(f, 'install'), true); tick(f, 75); f.c.atStation = false; tick(f, 1);
  assert.equal(f.s.job, null); assert.equal(f.s.partialInstall.progress, 75); assert.equal(f.front.station.efficiency, undefined);
  assert.equal(f.stacks[0].quantity, 8); assert.equal(f.stacks[0].reservedTaskId, ''); assert.equal(f.tools[0].tool.reservedTaskId, '');
  f.s = f.front.scientificCompact = W.normalize(f.s); place(f, true); assert.equal(action(f, 'install'), true); tick(f, 105);
  assert.ok(f.front.station.efficiency); assert.equal(f.s.partialInstall, null); assert.equal(f.stacks[0].quantity, 6);
});
test('save cleanup recognizes only the exact original ward job, hammer, body, owned material quantities and site binding', () => {
  const f = fixture(); sign(f); place(f, true); tick(f, f.s.cycles[0].dueAt - f.at); action(f, 'maintain'); tick(f, 60);
  const all = () => [...f.stacks, f.tools[0].stack];
  assert.deepEqual(W.savedToolClaim(f.front, f.g, all()), { jobId: f.s.job.id, toolId: f.tools[0].tool.id });
  for (const change of [() => f.s.job.bodyEpoch++, () => f.s.job.cell.x++, () => f.stacks[0].quantity++,
    () => f.stacks[0].cityOwnerId = 'b', () => f.s.runId = 'other-run', () => f.s.job.inputs[0].quantity++,
    () => f.tools[0].stack.toolInstanceId = 'replacement-hammer', () => f.s.job.kind = 'unknown']) {
    const state = copy({ s: f.s, stacks: f.stacks, stack: f.tools[0].stack }); change();
    assert.equal(W.savedToolClaim(f.front, f.g, all()), null);
    f.s = f.front.scientificCompact = state.s; f.stacks = state.stacks; f.tools[0].stack = state.stack;
  }
});
test('changed, public, stolen, remote or reserved materials/tools cannot become a free prototype', () => {
  for (const change of [f => f.stacks[0].cityOwnerId = 'b', f => f.stacks[0].quantity = 1,
    f => f.stacks[0].tags = ['stolen'], f => f.stacks[0].carriedBy = 'other', f => f.stacks[0].reservedTaskId = 'other',
    f => f.tools[0].tool.current = 0, f => f.tools[0].stack.carriedBy = 'other']) {
    const f = fixture(); action(f, 'authorize'); tick(f, 120); place(f, true); action(f, 'baseline'); tick(f, 120); change(f);
    assert.equal(action(f, 'install'), false); assert.equal(f.front.station.efficiency, undefined);
  }
  const f = fixture(); action(f, 'authorize'); tick(f, 120); place(f, true); action(f, 'baseline'); tick(f, 120); action(f, 'install'); tick(f, 10);
  f.stacks[0].quantity++; tick(f, 1); assert.equal(f.s.job, null); assert.equal(f.front.station.efficiency, undefined);
});
test('combat, structure change, absent operator, suppression, changed body and elapsed gaps cannot certify an unattended trial', () => {
  for (const change of [f => f.front.station.combatSpent++, f => f.c.condition--, f => f.c.operatorIncapacitated = true,
    f => f.c.suppressed = true, f => f.b.defender.status = 'dead', f => f.b.defender.workSeconds = 0,
    f => f.c.bodyEpoch++, f => f.c.atStation = false]) {
    const f = fixture(); action(f, 'authorize'); tick(f, 120); place(f, true); action(f, 'baseline'); tick(f, 120); action(f, 'install'); tick(f, 180);
    assert.equal(action(f, 'improved'), true); tick(f, 20); change(f); tick(f, 1);
    assert.equal(f.s.demonstration, null); assert.equal(f.s.job, null); assert.equal(f.front.station.efficiency.enabled, false);
  }
  const f = fixture(); action(f, 'authorize'); f.at += 100;
  W.advance(f.s, f.front, f.g, f.market, f.c, f.at, f.stacks, f.tools);
  assert.equal(f.s.authorization, null); assert.equal(f.s.job, null);
});
test('negotiation needs demonstrated benefit and actual spare city funds; exact separately signed terms escrow finite pay', () => {
  const f = fixture(); assert.equal(action(f, 'negotiate'), false); prove(f);
  const duty = f.b.defender.workSeconds; f.b.defender.workSeconds = 1000;
  assert.equal(action(f, 'negotiate'), false); f.b.defender.workSeconds = duty;
  f.market.treasury = 1100; assert.equal(action(f, 'negotiate'), false); f.market.treasury = 10000;
  assert.equal(action(f, 'negotiate'), true); tick(f, 120);
  assert.equal(action(f, 'sign', { ...f.s.offer, fee: 1000 }), false);
  assert.equal(f.market.treasury, 10000); assert.equal(action(f, 'sign', f.s.offer), true); tick(f, 30);
  assert.equal(f.s.terms, null); f.s = f.front.scientificCompact = W.normalize(f.s); tick(f, 30);
  assert.equal(f.s.status, 'active'); assert.equal(f.market.treasury, 9880); assert.equal(f.s.escrow, 120); assert.equal(f.wallet.money, 900);
  assert.equal(f.s.cycles[0].dueAt, f.s.terms.signedAt + W.INTERVAL);
});
test('technical rights change actual local draw, not original guard allegiance, interception strength or coverage', () => {
  const f = fixture(); sign(f); place(f, true); const mana = f.b.defender.wardMana;
  assert.equal(action(f, 'conservative'), true); const e = f.front.station.energy; tick(f, 10); assert.equal(e - f.front.station.energy, 10);
  assert.equal(action(f, 'economical'), true); const e2 = f.front.station.energy; tick(f, 10); assert.equal(e2 - f.front.station.energy, 7.5);
  const c = { alive: true, installationPresent: true, condition: 80 };
  const hit = { cell: f.front.layout.service, hostile: true, lineOfEffect: true, amount: 25, damageTypes: ['physical'] };
  const energy = f.front.station.energy; assert.equal(D.absorb(f.front.station, f.b.defender, c, hit, f.at).absorbed, 20);
  assert.equal(energy - f.front.station.energy, 900); assert.equal(f.b.defender.wardMana, mana);
  assert.equal(D.absorb(f.front.station, f.b.defender, c, { ...hit, cell: { x: 100, y: 100, z: 1 } }, f.at).absorbed, 0);
  place(f, false); assert.equal(action(f, 'conservative'), false);
  assert.equal(f.b.defender.assignment, f.front.station.duty.id); assert.equal(f.b.source.authority.id, 'ruler:b');
});
test('upkeep uses the same finite installment/remedy consumer and original materials; local pay is earned and collected only once', () => {
  const f = fixture(); sign(f); place(f, true); assert.equal(action(f, 'maintain'), false);
  tick(f, f.s.cycles[0].dueAt - f.at); assert.equal(f.s.status, 'cure');
  assert.equal(action(f, 'maintain'), true); tick(f, 60); assert.equal(f.s.earned, 0);
  f.s = f.front.scientificCompact = W.normalize(f.s); tick(f, 60);
  assert.equal(f.s.status, 'active');
  assert.equal(f.s.earned, 60); assert.equal(f.s.escrow, 60); assert.equal(f.wallet.money, 900); assert.equal(f.stacks[0].quantity, 5);
  const report = copy(f.s.report); tick(f, 10); assert.deepEqual(f.s.report, report);
  assert.equal(action(f, 'collect'), false); place(f, false); assert.equal(action(f, 'collect'), true); assert.equal(action(f, 'collect'), false);
  assert.equal(f.wallet.money, 960); place(f, true); tick(f, f.s.cycles[1].dueAt - f.at);
  assert.equal(action(f, 'maintain'), true); tick(f, 120); assert.equal(f.s.status, 'completed'); assert.equal(f.s.earned, 60);
  assert.equal(f.s.escrow, 0); assert.equal(action(f, 'economical'), false); assert.equal(action(f, 'maintain'), false);
  place(f, false); action(f, 'collect'); assert.equal(f.wallet.money, 1020); assert.equal(f.market.treasury + f.wallet.money, 10900);
});
test('safe termination and missed obligations preserve original defense/property, spent costs and earned pay; refund is once only', () => {
  const f = fixture(); sign(f); const id = f.front.station.efficiency.id;
  assert.equal(action(f, 'terminate'), true); assert.equal(f.market.treasury, 10000); assert.equal(f.s.refunded, 120);
  assert.equal(action(f, 'terminate'), false); assert.equal(f.front.station.efficiency.id, id); assert.equal(f.front.station.efficiency.enabled, true);
  place(f, true); assert.equal(action(f, 'conservative'), false);
  const e = f.front.station.energy; tick(f, 10); assert.equal(e - f.front.station.energy, 7.5);
  const g = fixture(); sign(g); tick(g, g.s.cycles[0].dueAt + W.CURE - g.at);
  assert.equal(g.s.status, 'breached'); assert.equal(g.s.refunded, 120); assert.equal(g.front.station.efficiency.certified, true);
  tick(g, 100); assert.equal(g.s.refunded, 120); assert.equal(g.market.treasury, 10000);
});
test('operator loss and damage suspend technical rights with conservative fallback, not replacement/healing or live remote knowledge', () => {
  const f = fixture(); sign(f); action(f, 'report'); const report = copy(f.s.report); f.c.local = false; f.c.atDesk = false;
  f.b.defender.status = 'dead'; const personalMana = f.b.defender.wardMana; tick(f, 10);
  assert.equal(f.s.status, 'suspended'); assert.deepEqual(f.s.report, report); assert.equal(action(f, 'report'), false);
  assert.equal(f.b.defender.status, 'dead'); assert.equal(f.b.defender.wardMana, personalMana);
  const e = f.front.station.energy; tick(f, 10); assert.equal(e - f.front.station.energy, 10);
  tick(f, f.s.cycles[0].dueAt + W.CURE - f.at); assert.equal(f.s.status, 'breached');
  const g = fixture(); sign(g); g.c.condition = 40; tick(g, 1); assert.equal(g.s.status, 'suspended');
  const e2 = g.front.station.energy; tick(g, 10); assert.equal(e2 - g.front.station.energy, 10);
});
test('service life exhaustion falls back safely; exact recharge conserves reserve and survives original normalization', () => {
  const f = fixture(); prove(f); place(f, true); f.front.station.efficiency.remainingSeconds = 2;
  const e = f.front.station.energy; tick(f, 5); assert.equal(e - f.front.station.energy, 4.5);
  assert.equal(f.front.station.efficiency.remainingSeconds, 0);
  f.front.station.energy = 30000; assert.equal(action(f, 'charge'), true); tick(f, 60);
  assert.equal(f.front.station.energy, 30000 - 60 + 21600); assert.equal(f.front.station.charged, 21600);
  assert.equal(f.stacks.find(i => i.key === 'arcaneFeedstock').quantity, 1); assert.ok(O.normalize(f.front));
});
test('death freezes partial work; rebind keeps original identities and dated reports, while fresh same-world runs inherit nothing', () => {
  const f = fixture(); sign(f); action(f, 'report'); const before = copy(f.s); f.c.alive = false; tick(f, 10);
  assert.deepEqual(f.s, before);
  assert.equal(W.rebind(f.s, { worldId: 'w', runId: 'other' }, { worldId: 'w', runId: 'continued' }), null);
  const continued = W.rebind(f.s, { worldId: 'w', runId: 'r' }, { worldId: 'w', runId: 'continued' });
  assert.equal(continued.runId, 'continued'); assert.equal(continued.defenderId, f.s.defenderId); assert.deepEqual(continued.report, before.report);
  const fresh = fixture(); assert.equal(fresh.s.terms, null); assert.equal(fresh.s.report, null); assert.equal(fresh.s.escrow, 0);
});
test('coarse unseen expiry retains the real deadline and dated knowledge, and cannot refund through another city account', () => {
  const f = fixture(); sign(f); action(f, 'report'); const old = copy(f.s.report), due = f.s.cycles[0].dueAt + W.CURE;
  f.c.local = false; f.c.atDesk = false; f.at = due + 400;
  W.advance(f.s, f.front, f.g, f.market, f.c, f.at, f.stacks, f.tools);
  assert.equal(f.s.endedAt, due); assert.deepEqual(f.s.report, old); assert.equal(f.s.refunded, 120);
  const g = fixture(); sign(g); g.market.id = 'other-city'; const before = copy(g.s);
  assert.equal(action(g, 'terminate'), false); g.at++;
  assert.equal(W.advance(g.s, g.front, g.g, g.market, g.c, g.at, g.stacks, g.tools), false);
  assert.deepEqual(g.s, before); assert.equal(g.market.treasury, 9880);
});
test('published opposition restrictions can end cooperation without erasing ownership or imposing a divine patron', () => {
  const f = fixture(); sign(f); const fittingId = f.front.station.efficiency.id;
  f.c.restrictions = [{ id: 'new-original-client-rule', text: 'Original institution now refuses declared opponents of the gods.', refusesDeclaredOpposition: true }];
  tick(f, 1); assert.equal(f.s.status, 'terminated'); assert.equal(f.front.station.efficiency.id, fittingId);
  assert.equal(f.b.defender.wardMana, 120); assert.equal(f.market.treasury, 10000);
  assert.equal(W.access(f.s, 0, f.at), false); assert.equal(action(f, 'conservative'), false);
});
test('an ended unwitnessed claim or unreceived third-party observation is not omniscient civic hostility', () => {
  const f = fixture(); f.front.claim = { id: 'unseen-ended-claim', endedAt: -1 }; f.front.phase = 'lost';
  f.front.reports.push({ actorId: 'scientist', kind: 'outerApproachAttack', witnessId: 'unreceived-third-party' });
  assert.equal(action(f, 'authorize'), true); tick(f, 120); assert.ok(f.s.authorization);
  const g = fixture(); sign(g); g.front.reports.push({ actorId: 'scientist', kind: 'outerApproachAttack', witnessId: g.s.representativeId });
  tick(g, 1); assert.equal(g.s.status, 'terminated'); assert.equal(g.s.refunded, 120); assert.equal(g.b.defender.status, 'alive');
});
test('expired/completed rights allow only the original one-way exit path, not reentry, another room, body or binding', () => {
  const f = fixture(); sign(f); action(f, 'terminate'); f.g.checkpointRoomId = 'checkpoint'; f.g.z = 1;
  const a = { x: 3, y: 9, z: 1 }, b = { x: 5, y: 9, z: 1 }, end = { x: 10, y: 7, z: 1 };
  const task = { type: 'scientistMove', createdAt: f.at, data: { fromRoomId: 'frontage', toRoomId: 'checkpoint', fromCell: a,
    toCell: end, mapPath: [a, b, end], wardResearchExit: { compactId: f.s.id, authorizationId: f.s.authorization.id, bodyEpoch: 0 } } };
  const room = cell => cell.x < 5 ? 'frontage' : 'checkpoint';
  assert.equal(W.access(f.s, 0, f.at), false); assert.equal(W.egress(f.s, f.front, f.g, task, 0, room), true);
  for (const change of [t => t.data.toRoomId = 'inner-city', t => t.data.fromRoomId = 'checkpoint',
    t => t.data.mapPath = [a, b, a, end], t => t.data.wardResearchExit.bodyEpoch++,
    t => t.data.wardResearchExit.authorizationId = 'other', t => t.data.toCell.x++, t => t.createdAt = -1]) {
    const bad = copy(task); change(bad); assert.equal(W.egress(f.s, f.front, f.g, bad, 0, room), false);
  }
  assert.equal(W.egress(f.s, { ...f.front, runId: 'other' }, f.g, task, 0, room), false);
  const saved = W.rebind(f.s, { worldId: 'w', runId: 'r' }, { worldId: 'w', runId: 'continued' });
  assert.equal(W.egress(saved, { ...f.front, runId: 'continued' }, f.g, task, 0, room), true);
});
