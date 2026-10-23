const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../regional-change'), S = require('../regional-suppression'), R = require('../regional-encounters');
const { fixture } = require('./helpers/regional-suppression-source');
const copy = x => JSON.parse(JSON.stringify(x)), b = { worldId: 'world', runId: 'run' };
function setup() {
  const f = fixture();
  for (let n = 0; n < 100; n++) {
    const s = S.create(b), r = R.create(b), j = C.create(b);
    const p = S.register(s, f.source, r, [], `seed-${n}`, 0), actors = r.beasts.actors;
    if (!actors.some(a => a.campaignTravelRemainingKm > 0) || !actors.some(a => !a.campaignTravelRemainingKm)) continue;
    const run = (at, alive = true, speed = () => 1, move = () => true) => S.advance(s, r, actors, at, alive, speed, j, move);
    run(0); return { ...f, s, r, j, p, actors, run };
  }
  throw new Error('No original near/far groups');
}
test('journal records supported facts once without applying any damage, casualties or resources', () => {
  const s = C.create(b), source = { id: 'original-road', condition: 100, people: ['original-keeper'], stock: 12 }, before = copy(source);
  const e = { id: 'original-road:repair', sourceId: source.id, siteId: 'corridor', causeId: 'original-work-receipt',
    kind: 'routeCondition', at: 120, from: 'unusable', to: 'restored', actorIds: source.people };
  assert.equal(C.record(s, b, e, 119), false); assert(C.record(s, b, e, 120));
  assert.equal(C.record(s, b, e, 200), false); assert.deepEqual(source, before);
  assert.equal(C.record(s, { ...b, runId: 'fresh' }, { ...e, id: 'other' }, 200), false);
  assert.deepEqual(C.publicView(s).reports, []);
});
test('supported snapshots record baseline then real changes, never a new event every heartbeat or fabricated history', () => {
  const s = C.create(b), f = { sourceId: 'original-service', siteId: 'city:a', kind: 'installation', causeId: 'physical-repair', state: 'maintained' };
  assert(C.capture(s, b, f, 100)); assert.equal(s.events[0].from, null); assert.equal(s.events[0].at, 100);
  assert.equal(C.capture(s, b, f, 200), false);
  assert.equal(C.capture(s, b, { ...f, state: 'offline' }, 150), false);
  assert(C.capture(s, b, { ...f, state: 'offline', causeId: 'actual-grace-expired' }, 300));
  assert.equal(C.capture(s, b, f, 250), false); assert.equal(s.events.length, 2);
  assert.equal(s.events[1].from, 'maintained'); assert.equal(s.events[1].causeId, 'actual-grace-expired');
});
test('original service expiry and physical restoration receipts retain their own dates, never becoming settlement destruction', () => {
  const Conditions = require('../run-strategic-conditions'), j = C.create(b);
  const site = { ...b, cityId: 'a', officeId: 'office', installationId: 'original-terminal', maintenanceId: 'original-upkeep' };
  const upkeep = { id: site.maintenanceId, cityId: 'a', officeId: 'office', installation: { id: site.installationId },
    handoverId: 'original-handover', lastAt: 10, dueAt: 100, graceUntil: 150, receipts: [] };
  let conditions = Conditions.advance(null, site, upkeep, 10);
  conditions = Conditions.advance(conditions, site, upkeep, 180);
  const r = { id: 'actual-repair', installationId: site.installationId, at: 200, dueAt: 300, graceUntil: 350, quantity: 3, workSeconds: 120 };
  upkeep.receipts.push(r); Object.assign(upkeep, { dueAt: 300, graceUntil: 350 });
  conditions = Conditions.advance(conditions, site, upkeep, 210);
  const original = copy(conditions); assert(C.collect(j, b, { conditions }, 210));
  assert.deepEqual(j.events.map(e => [e.at, e.to]), [[10, 'maintained'], [150, 'maintenanceOffline'], [200, 'maintained']]);
  assert.equal(C.collect(j, b, { conditions }, 300), false); assert.deepEqual(conditions, original);
  assert.deepEqual(C.publicView(j).reports, []); assert(j.events.every(e => e.kind === 'installation'));
});
test('a real roadbed projection changes route connectivity; collecting it cannot damage another route or change original sponsors', () => {
  const Works = require('../corridor-works'), Joint = require('../joint-transit');
  const f = require('./helpers/corridor-works-source').fixture(), j = C.create(b), original = copy(f.map);
  const point = (x, y) => ({ x, y, z: 25 });
  const station = Joint.create(f.source.joint, b, { roomId: 'original-ground', entry: point(10, 10), post: point(14, 9),
    homes: [point(13, 8), point(16, 8)], bins: [point(12, 9), point(17, 9)] }, 0);
  const w = Works.create(f.source, b, station, 0), works = { ...b, sites: [w] };
  // Existing completed stone courses are the input. The changed outcome is
  // produced by the real projection consuming an actual course's damage.
  w.startedAt = 10; w.site.layout.parts.forEach(p => { w.site.parts[p.id] = { completeAt: 10 }; });
  let condition = 100; Works.project(works, f.network, () => condition, () => true, 10);
  assert.equal(f.route.supportCapable, true); assert(C.collect(j, b, { corridorWorks: works }, 10));
  condition = 20; Works.project(works, f.network, () => condition, () => true, 20);
  assert.equal(f.route.supportCapable, false); assert.equal(f.route.continuity, 'closed');
  assert(C.collect(j, b, { corridorWorks: works }, 20));
  assert.match(j.events[1].from, /roadbedRestored/); assert.match(j.events[1].to, /roadbedUnusable:closed/);
  assert.equal(f.network.routes[1].continuity, 'closed'); assert.deepEqual(f.map, original);
  assert.deepEqual(w.source.joint.sponsors.map(s => s.upkeepPercent), [35, 65]); assert.deepEqual(C.publicView(j).reports, []);
});
test('supported authority, operational loss, avatar loss and founding withdrawal stay distinct rather than creating sovereign targets or divine deaths', () => {
  const j = C.create(b), inputs = {
    cityRule: { id: 'original-operation', source: { cityId: 'a' }, handoverId: 'actual-handover', status: 'established' },
    succession: { source: { cityId: 'a' }, handover: { id: 'actual-handover' }, control: { recognizedAuthorityId: 'scientist' } },
    divineIntervention: { id: 'original-manifestation', cityId: 'a', avatars: [{ id: 'original-avatar', status: 'alive', manifested: true }] },
    foundingWorks: { id: 'original-unfinished-works', phase: 'returning' }
  };
  C.collect(j, b, inputs, 10);
  inputs.cityRule.status = 'contested'; inputs.divineIntervention.avatars[0].status = 'dead'; inputs.foundingWorks.phase = 'abandoned';
  const original = copy(inputs); C.collect(j, b, inputs, 20); assert.deepEqual(inputs, original);
  assert.equal(j.events.filter(e => e.kind === 'authority').length, 1); // No automatic ruler replacement.
  assert.equal(j.events.filter(e => e.kind === 'cityRule').at(-1).to, 'contested');
  assert.equal(j.events.filter(e => e.kind === 'divinePresence').at(-1).sourceId, 'original-avatar');
  assert.equal(j.events.filter(e => e.kind === 'founding').at(-1).to, 'abandoned');
  assert.deepEqual(C.publicView(j).reports, []);
});
test('an original distant group renews private pressure at the exact six-hour reach boundary while received knowledge stays stale', () => {
  const f = setup(), near = f.actors.filter(a => !a.campaignTravelRemainingKm);
  near.forEach(a => { a.health = 10; }); f.run(1);
  assert.equal(f.p.lastAssessment.status, 'suppressed');
  const receipt = { siteId: 'original-stop', at: 1, observedAt: 1,
    observations: near.map(a => ({ id: a.id, capable: false, condition: 'Severely wounded' })) };
  assert(C.receivePressure(f.j, b, 'received-dossier', receipt)); const known = C.publicView(f.j);
  f.run(3600);
  assert.equal(S.assess(f.p, f.actors, 3600).status, 'capable');
  const renewal = f.j.events.find(e => e.kind === 'pressure' && e.from === 'suppressed' && e.to === 'capable');
  assert(renewal); assert(Math.abs(renewal.at - 24000) > 1000); // This is not physical arrival or an arbitrary timer.
  assert(Math.abs(renewal.at - (16 * 1500 - S.WINDOW)) < 1e-6);
  assert.deepEqual(C.publicView(f.j), known); assert.equal(f.actors.length, 10);
  assert(f.actors.filter(S.capable).every(a => !a.roomId && a.campaignTravelRemainingKm > 0));
});
test('small ticks, coarse catch-up and real JSON reload produce the same original movement and exact arrival/change history', () => {
  const fine = setup(), coarse = setup();
  for (const f of [fine, coarse]) { f.actors.filter(a => !a.campaignTravelRemainingKm).forEach(a => { a.health = 10; }); f.run(1); }
  for (let t = 101; t < 25000; t += 100) fine.run(t); fine.run(25000); coarse.run(25000);
  assert.deepEqual(coarse.j.events, fine.j.events); assert.deepEqual(coarse.p.displacements, fine.p.displacements);
  for (let i = 0; i < fine.actors.length; i++) assert(Math.abs(coarse.actors[i].campaignTravelRemainingKm - fine.actors[i].campaignTravelRemainingKm) < 1e-9);
  const s = S.normalize(copy(coarse.s)), r = R.normalize(copy(coarse.r)), j = C.normalize(copy(coarse.j));
  S.advance(s, r, r.beasts.actors, 26000, true, () => 1, j);
  assert.deepEqual(j.events, coarse.j.events); assert.deepEqual(r.beasts.actors.map(a => a.id), coarse.actors.map(a => a.id));
});
test('wounded off-ground survivors withdraw along only their travelled path, retain wounds and cannot occupy both grounds', () => {
  const f = setup(), a = f.actors.find(a => a.campaignTravelRemainingKm > 0);
  f.run(3600); assert.equal(a.campaignTravelRemainingKm, 13.6);
  a.health = 10; f.run(3601); assert.equal(a.campaignLeg, 'withdrawing'); assert.equal(a.campaignTravelRemainingKm, 13.6);
  f.run(5401); assert(Math.abs(a.campaignTravelRemainingKm - 14.8) < 1e-9); assert.equal(a.health, 10);
  assert(!R.positions(f.r, a.routeId).includes(a.positionKm));
  f.run(10000); assert.equal(a.campaignLeg, 'sheltered'); assert.equal(a.campaignTravelRemainingKm, 16);
  assert.equal(a.roomId, ''); assert.equal(a.mapCell, null); assert.equal(a.health, 10);
  assert(f.j.events.some(e => e.kind === 'beastWithdrawal' && e.actorIds.includes(a.id)));
  assert(f.j.events.some(e => e.kind === 'beastSheltered' && e.actorIds.includes(a.id)));
  assert.equal(f.actors.length, 10); f.run(20000); assert.equal(a.health, 10); assert.equal(a.campaignLeg, 'sheltered');
});
test('occupied local bodies, incapacitation, deaths and unknown mobility never acquire off-ground movement or healing', () => {
  for (const mode of ['local', 'incapacitated', 'dead', 'badSpeed']) {
    const f = setup(), a = f.actors.find(a => a.campaignTravelRemainingKm > 0), before = a.campaignTravelRemainingKm;
    a.health = 10;
    if (mode === 'local') { a.regionalPhase = 'local'; a.roomId = 'original-patch'; a.mapCell = { x: 1, y: 1, z: 4 }; }
    if (mode === 'dead') { a.status = 'dead'; a.health = 0; }
    const speed = () => mode === 'badSpeed' ? NaN : 1, move = x => mode !== 'incapacitated' || x.id !== a.id;
    f.run(100, true, speed, move); f.run(10000, true, speed, move);
    assert.equal(a.campaignTravelRemainingKm, before, mode); assert.equal(a.health, mode === 'dead' ? 0 : 10);
  }
  const f = setup(); assert.equal(S.assess(f.p, f.actors, 0, () => NaN).status, 'unverified');
});
test('an arrived animal cannot use its old habitat leg to disappear after a local pursuit or claim an untravelled withdrawal', () => {
  const f = setup(); f.run(25000); const a = f.actors.find(a => f.p.source.homes[f.p.members.find(m => m.id === a.id).homeIndex].distanceKm > 0);
  assert.equal(a.campaignLeg, 'arrived'); a.health = 10; a.positionKm += .1;
  f.run(25001); f.run(30000); assert.equal(a.campaignLeg, 'arrived'); assert.equal(a.campaignTravelRemainingKm, 0);
  assert.equal(f.j.events.some(e => e.kind === 'beastWithdrawal' && e.actorIds.includes(a.id)), false);
});
test('receiving a later capable contact explains the observed change without disclosing private movement, causality or a census', () => {
  const f = setup(), receipt = (at, capable) => ({ at: at + 60, observedAt: at, siteId: 'original-stop',
    observations: [{ id: 'personally-seen-original', capable, condition: capable ? 'Capable' : 'Severely wounded', privatePath: 'SECRET' }] });
  assert(C.receivePressure(f.j, b, 'received-dossier', receipt(1, false)));
  const known = C.publicView(f.j); f.run(25000); assert.deepEqual(C.publicView(f.j), known);
  assert(C.receivePressure(f.j, b, 'received-dossier', receipt(25000, true)));
  const v = C.publicView(f.j); assert.match(v.reports[1].text, /after an earlier locally broken contact/);
  assert.doesNotMatch(JSON.stringify(v), /SECRET|populationId|campaignTravel|hunting-group|beastArrival|events|heads|serial/);
  assert.equal(C.receivePressure(f.j, b, 'received-dossier', receipt(25000, true)), false);
  assert.equal(C.receivePressure(f.j, b, 'received-dossier', receipt(24000, false)), false);
  assert.equal(C.receivePressure(f.j, b, 'received-dossier', { ...receipt(26000, true), at: 1 }), false);
});
test('continued import rebinds only the saved journal; fresh same-world runs inherit no facts, actors or knowledge', () => {
  const f = setup(); f.run(100);
  const saved = C.normalize(JSON.parse(JSON.stringify(f.j))), next = C.rebind(saved, b, { ...b, runId: 'imported' });
  assert.equal(next.runId, 'imported'); assert.deepEqual(next.events, f.j.events); assert.equal(saved.runId, 'run');
  assert.equal(C.rebind(saved, { ...b, runId: 'unrelated' }, b), null);
  assert.deepEqual(C.create({ ...b, runId: 'fresh' }).events, []); assert.deepEqual(C.publicView(C.create({ ...b, runId: 'fresh' })).reports, []);
});
test('normalization strips hidden receipt additions, ignores invalid events and recovers the generated event serial without collisions', () => {
  const s = C.create(b), fact = { sourceId: 'original-service', siteId: 'a', kind: 'installation', causeId: 'original-repair', state: 'maintained' };
  C.capture(s, b, fact, 1); s.serial = 0; s.events.push({ id: 'future-nonsense', kind: 'automaticGodDeath' });
  s.reports.push({ id: 'received', sourceId: 'dossier', siteId: 'stop', kind: 'localPressure', text: 'Personally observed.', observedAt: 1, receivedAt: 2,
    hidden: 'SECRET', observations: [{ id: 'seen', capable: true, condition: 'Capable', hidden: 'SECRET' }] });
  const restored = C.normalize(copy(s)); assert.equal(restored.serial, 1); assert.equal(restored.events.length, 1);
  assert(C.capture(restored, b, { ...fact, state: 'offline' }, 3)); assert.equal(restored.events[1].id, 'regional-change:2');
  assert.doesNotMatch(JSON.stringify(C.publicView(restored)), /SECRET|automaticGodDeath/);
});
test('a foreign run consumer cannot supply this run journal with facts', () => {
  const s = C.create(b), foreign = { ...b, runId: 'other', id: 'foreign-operation', source: { cityId: 'a' }, handoverId: 'foreign-receipt', status: 'contested' };
  assert.equal(C.collect(s, b, { cityRule: foreign }, 10), false); assert.deepEqual(s.events, []);
});
test('death freezes both journal and physical relocation and cannot create a postmortem receipt', () => {
  const f = setup(), before = copy({ j: f.j, s: f.s, r: f.r }); f.run(10000, false);
  assert.deepEqual({ j: f.j, s: f.s, r: f.r }, before);
  assert.equal(C.capture(f.j, b, { kind: 'cityRule', sourceId: 'city:a', siteId: 'city:a', causeId: 'existing', state: 'contested' }, 10000, false), false);
  assert.equal(C.receivePressure(f.j, b, 'received', { at: 1, observedAt: 1, siteId: 'site', observations: [{ id: 'a', condition: 'capable', capable: true }] }, false), false);
});
