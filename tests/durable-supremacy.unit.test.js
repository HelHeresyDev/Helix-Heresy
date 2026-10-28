const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../durable-supremacy'), Rule = require('../city-rule');
const Provision = require('../city-provisioning'), Defense = require('../city-defense');
const copy = x => JSON.parse(JSON.stringify(x));
const b = { worldId: 'world', runId: 'run' };
const targets = [
  { id: 'city:a', sourceId: 'population:a', kind: 'city', createdAt: 0 },
  { id: 'city:b', sourceId: 'population:b', kind: 'city', createdAt: 0 },
  { id: 'beast:original', sourceId: 'original-beasts', kind: 'beast', createdAt: 0 },
  { id: 'divine:original', sourceId: 'original-god', kind: 'divine', createdAt: 0 }
];
function fact(t, at, since = 0) {
  const f = { ...b, targetId: t.id, sourceId: t.sourceId, kind: t.kind, proofId: `original-consumer:${t.id}`,
    at, since, state: 'qualifying', basis: t.kind === 'city' ? 'directGovernment' : 'strategicIncapacity', viable: t.kind === 'city' };
  if (t.kind !== 'city') f.strategic = { scope: 'terrestrialRule', consumerId: `original-response:${t.id}`, sourceId: t.sourceId,
    at, canOverturn: false, willing: true, responseSupported: false };
  return f;
}
function setup() { return S.create(b, { complete: true, targets }, 0); }
test('indexed original-roster reconciliation still restores deleted identities and rejects source conflicts without copying current control', () => {
  const s = setup(); s.targets.splice(1, 1);
  assert.equal(S.syncBaseline(s, { complete: true, targets }), true);
  assert.equal(s.targets.filter(t => t.id === 'city:b').length, 1);
  const before = copy(s.targets); S.syncBaseline(s, { complete: true, targets }); assert.deepEqual(s.targets, before);
  S.syncBaseline(s, { complete: true, targets: [{ ...targets[0], sourceId: 'replacement-population' }] });
  assert.equal(s.conflict, true); tick(s, S.INTERVAL); assert.equal(s.phase, 'unverified');
});
function tick(s, at, change = () => {}) { const frame = { complete: true, facts: s.targets.map(t => fact(t, at)) }; change(frame); S.advance(s, b, frame, at); return frame; }
function city(cityId) {
  const institutions = Rule.ROLES.map(role => ({ role, id: `${cityId}:${role}` }));
  const farm = { cityId, cityName: cityId, charterId: `charter:${cityId}`, institutionId: `${cityId}:publicWorksAndProvisioning`,
    populationSourceId: `population:${cityId}`, cityPopulation: 3000, satelliteId: `farm:${cityId}`, satelliteName: 'Original farm',
    satellitePopulation: 600, cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002', arableLandBand: 'productive',
    storageDays: 3, distanceKm: 5, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
  const people = institutions.map(i => ({ id: `${i.id}:original-person`, institutionId: i.id, roles: [i.role], status: 'alive', health: 100,
    stamina: 80, workSeconds: 3600, exceptionalCapabilities: i.role === 'militaryDefenseCommand' ? ['city-scale ward defense'] : [] }));
  const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: `terms:${cityId}` }));
  const succession = { source: { cityId, charterId: farm.charterId }, officeId: `office:${cityId}`, leaders: people.slice(0, -1),
    handover: { id: `handover:${cityId}`, termsId: `terms:${cityId}`, bodyEpoch: 0 }, agreements,
    control: { recognizedAuthorityId: 'scientist', sourceReceiptId: `handover:${cityId}`, bodyEpoch: 0, commandRelationships: copy(agreements) } };
  const office = { id: `office:${cityId}`, cityId }, p = Provision.create(farm, succession, office, b, 0);
  const defense = Defense.create({ cityId, charterId: farm.charterId, institutionId: institutions.at(-1).id,
    populationSourceId: farm.populationSourceId, population: 3000, condition: 80, installationId: `approach:${cityId}`, baselineEnergy: 69120 },
  succession, people.at(-1), office, b, 0, 80);
  const source = { cityId, cityName: cityId, charterId: farm.charterId, populationSourceId: farm.populationSourceId,
    population: 3000, institutions, worksId: `water:${cityId}`, powerId: `power:${cityId}`, reserveDays: 4, farms: [farm] };
  const s = Rule.create(source, succession, p, defense, b, 0);
  const c = { alive: true, capable: true, local: true, free: true, atCounter: true, reportersPresent: true, sourceCurrent: true,
    bodyEpoch: 0, institutionsAvailable: true, coverageVerified: true, counterpower: 'noEstablishedChallenge',
    pilotSupplied: true, pilotDefended: true, defenseAvailable: true, routes: { [farm.satelliteId]: true } };
  assert(Rule.order(s, succession, people, c, 0));
  return { s, c, succession, people, p, defense };
}
test('baseline retains cities across independent networks, displaced cities and hidden beast/divine identities, never forts as sovereigns', () => {
  const map = { humanGeography: { cities: [{ id: 'a' }, { id: 'b' }] }, cityPolities: { polities: [{ cityId: 'a' }, { cityId: 'b' }] },
    strategicPlayableSettlementState: { cityRows: [{ cityId: 'a', assetId: 'population:a' }, { cityId: 'b', assetId: 'population:b', physicalJurisdictionExists: false }],
      strongholdRows: [{ id: 'joint-fort', sponsorCityIds: ['a', 'b'] }] }, beastEcology: { populations: [{ id: 'SECRET_BEAST' }] },
    strategicDivinity: { godOrder: ['SECRET_GOD'] }, strategicDivineHistory: { currentGodRows: [{ id: 'SECRET_GOD' }, { id: 'SECRET_ASCENDANT' }] },
    strategicNonStateNetworkHistory: { networkRows: [{ networkId: 'SECRET_ORGANIZATION' }] } };
  const original = copy(map), base = S.baseline(map); assert(base.complete); assert.equal(base.targets.length, 6);
  assert(base.targets.some(t => t.id === 'city:b')); assert(!base.targets.some(t => t.id.includes('joint-fort'))); assert.deepEqual(map, original);
  delete map.beastEcology; assert.equal(S.baseline(map).complete, false);
  assert.doesNotMatch(JSON.stringify(S.publicView(S.create(b, base))), /SECRET|targets|phase|qualifiedAt|since/);
});
test('three uninterrupted days qualify at the exact boundary without a chapter reward or extra local prerequisite', () => {
  const s = setup(); tick(s, 0); assert.equal(s.phase, 'holding'); tick(s, S.INTERVAL - 1); assert.equal(s.phase, 'holding');
  tick(s, S.INTERVAL); assert.equal(s.phase, 'qualified'); assert.equal(s.qualifiedAt, S.INTERVAL);
  assert.equal(s.accomplishment, undefined); assert.equal(s.since, 0);
  assert.equal(s.intervals.length, 1); assert.equal(s.intervals[0].qualifiedAt, S.INTERVAL);
});
test('multiple original city consumers contribute current operational facts and lose qualification through actual food exhaustion', () => {
  const accounts = [city('a'), city('b')], s = S.create(b, { complete: true, targets: targets.slice(0, 2) }, 0);
  const update = at => { const facts = accounts.map(a => { Rule.advance(a.s, a.succession, a.people, () => a.c, at);
    return S.cityAccount(b, a.s, a.succession, a.people, a.c, at); }); S.advance(s, b, { complete: true, facts }, at); return facts; };
  update(3600); assert.equal(s.phase, 'holding'); assert(accounts.every(a => a.s.status === 'limited'));
  const initial = accounts.map(a => ({ people: a.people.map(p => p.id), food: a.s.foodKg, energy: a.s.energy }));
  accounts.forEach(a => { a.c.routes[`farm:${a.s.source.cityId}`] = false; }); // Actual source roads obstructed; no convoy delivery.
  update(2 * 86400 + 3600); assert.equal(s.phase, 'failed'); assert.equal(s.since, null);
  assert(accounts.some(a => a.s.foodKg === 0));
  accounts.forEach((a, i) => { assert.deepEqual(a.people.map(p => p.id), initial[i].people); assert(a.s.energy < initial[i].energy); });
  assert.deepEqual(S.publicView(s).review, null);
});
test('actual supplied multi-city operation and global holding run concurrently rather than demanding a second three-day interval', () => {
  const accounts = [city('a'), city('b')], s = S.create(b, { complete: true, targets: targets.slice(0, 2) }, 0);
  for (const at of [3600, 3600 + S.INTERVAL]) {
    const facts = accounts.map(a => { Rule.advance(a.s, a.succession, a.people, () => a.c, at);
      return S.cityAccount(b, a.s, a.succession, a.people, a.c, at); }); S.advance(s, b, { complete: true, facts }, at);
  }
  assert(accounts.every(a => a.s.status === 'established' && a.s.foodKg > 0 && a.s.energy > 0));
  assert.equal(s.phase, 'qualified'); assert.equal(s.qualifiedAt, 3600 + S.INTERVAL);
  assert.equal(s.intervals.length, 1); assert.equal(s.intervals[0].targets.length, 2);
  assert(s.intervals[0].proofs.every(f => f.kind === 'city' && f.viable));
});
test('actual local opposition, lost authority and partial infrastructure stop global holding without silently refreshing received records', () => {
  for (const loss of ['counterpower', 'sourceCurrent', 'defenseAvailable', 'institutionsAvailable']) {
    const a = city('a'); Rule.advance(a.s, a.succession, a.people, () => a.c, 3600);
    const before = S.cityAccount(b, a.s, a.succession, a.people, a.c, 3600); assert.equal(before.state, 'qualifying');
    a.c[loss] = loss === 'counterpower' ? 'capableOpposition' : false;
    Rule.advance(a.s, a.succession, a.people, () => a.c, 3601);
    assert.notEqual(S.cityAccount(b, a.s, a.succession, a.people, a.c, 3601).state, 'qualifying');
  }
});
test('technical compacts, ordinary trade, withdrawal payments, stale facts and unexplained signatures cannot qualify cities', () => {
  for (const basis of ['technicalCompact', 'ordinaryTrade', 'localWithdrawal', 'signature']) {
    const s = setup(); tick(s, 0, f => { f.facts[0].basis = basis; }); assert.equal(s.phase, 'unverified');
  }
  const s = setup(); tick(s, 0); tick(s, S.INTERVAL, f => { f.facts[0].at = 0; }); assert.equal(s.phase, 'unverified');
});
test('tactical suppression, a species danger label, avatar defeat and loss of divinity cannot certify strategic resolution', () => {
  for (const basis of ['tacticalSuppression', 'dangerousSpecies', 'avatarDefeated', 'lostAllFollowers']) {
    const s = setup(); tick(s, 0, f => { f.facts[2].basis = basis; f.facts[3].basis = basis; }); assert.equal(s.phase, 'unverified');
  }
  const s = setup(); tick(s, 0, f => { delete f.facts[3].strategic; }); assert.equal(s.phase, 'unverified');
});
test('a capable willing strategic counterpower breaks holding; supported nonintervention requires actual strategic-source evidence', () => {
  const s = setup(); tick(s, 0); tick(s, 100, frame => {
    Object.assign(frame.facts[3].strategic, { canOverturn: true, willing: true, responseSupported: false });
  }); assert.equal(s.phase, 'failed'); assert.equal(s.qualifiedAt, null);
  tick(s, 101, frame => { frame.facts[3].basis = 'supportedNonintervention'; frame.facts[3].strategic.willing = false; });
  assert.equal(s.phase, 'holding'); assert.equal(s.since, 101);
});
test('missing or duplicate identities and accidentally empty or devastated worlds cannot manufacture success', () => {
  for (const change of [f => f.facts.pop(), f => f.facts.push(f.facts[0]), f => { f.facts = []; }, f => { f.complete = false; }]) {
    const s = setup(); tick(s, 0, change); assert.equal(s.phase, 'unverified');
  }
  const s = S.create(b, { complete: true, targets: [] }, 0); S.advance(s, b, { complete: true, facts: [] }, S.INTERVAL); assert.notEqual(s.phase, 'qualified');
  const devastated = setup(); tick(devastated, 0, frame => frame.facts.forEach(f => { f.state = 'retired'; f.lifecycle = {
    sourceId: f.sourceId, causeId: 'actual-owner-destruction', at: 0, survivingClaimants: 0,
    population: 0, kind: f.kind === 'city' ? 'physicalDestruction' : 'confirmedDeath' }; }));
  assert.equal(devastated.phase, 'failed'); assert.equal(devastated.reason, 'noLivingPolity');
});
test('retirement requires a supported original lifecycle outcome and accounts for displaced claimants', () => {
  const s = setup(); tick(s, 0, frame => { const f = frame.facts[0]; f.state = 'retired';
    f.lifecycle = { sourceId: f.sourceId, causeId: 'actual-destruction', at: 0, survivingClaimants: 1, population: 0, kind: 'physicalDestruction' }; });
  assert.equal(s.phase, 'unverified');
  tick(s, 1, frame => { const f = frame.facts[0]; f.state = 'retired';
    f.lifecycle = { sourceId: f.sourceId, causeId: 'actual-destruction', at: 0, survivingClaimants: 0, population: 0, kind: 'physicalDestruction' }; });
  assert.equal(s.phase, 'holding'); assert(s.targets.some(t => t.id === 'city:a'));
  const descended = setup(); tick(descended, 0, frame => {
    const f = frame.facts[3]; f.state = 'retired';
    f.lifecycle = { sourceId: f.sourceId, causeId: 'actual-faith-loss', at: 0, survivingClaimants: 0, kind: 'descent' };
  }); assert.equal(descended.phase, 'unverified');
});
test('new cities and ascendants join by dated original causes, deleted targets stay required, and qualifying-at-birth growth need not reset holding', () => {
  const s = setup(); tick(s, 0); const addition = { ...b, id: 'divine:new', sourceId: 'new-ascendant', kind: 'divine', createdAt: 50, causeId: 'actual-ascension' };
  S.advance(s, b, { complete: true, additions: [addition], facts: [...targets.map(t => fact(t, 50)), fact(addition, 50, 50)] }, 50);
  assert.equal(s.since, 0); assert.equal(s.targets.length, 5);
  S.syncBaseline(s, { complete: true, targets: targets.slice(1) }); assert(s.targets.some(t => t.id === 'city:a'));
  S.advance(s, b, { complete: true, facts: targets.map(t => fact(t, 51)) }, 51); assert.equal(s.phase, 'unverified');
});
test('coarse snapshots cannot hide an interruption in a source continuous-since interval or backfill a late first assessment', () => {
  const s = setup(); tick(s, 0); tick(s, S.INTERVAL + 1, f => { f.facts[1].since = 200; });
  assert.equal(s.phase, 'holding'); assert.equal(s.since, 200);
  tick(s, 200 + S.INTERVAL); assert.equal(s.phase, 'qualified'); assert.equal(s.qualifiedAt, 200 + S.INTERVAL);
  const late = S.create(b, { complete: true, targets }, 1000); tick(late, 1000); assert.equal(late.since, 1000);
});
test('received-evidence review is identical across opposite private worlds and retains source observation dates', () => {
  const a = setup(), z = setup(); tick(a, 0); tick(a, S.INTERVAL); tick(z, 0, f => { f.facts = []; });
  const evidence = [{ id: 'received:a', sourceId: 'original-account:a', label: 'Received operating account', status: 'control', observedAt: 10, receivedAt: 20 }];
  assert(S.review(a, b, evidence, S.INTERVAL)); assert(S.review(z, b, evidence, S.INTERVAL));
  assert.deepEqual(S.publicView(a), S.publicView(z)); assert(S.publicView(a).review.apparent);
  const publicBefore = S.publicView(a); tick(a, S.INTERVAL + 1, f => { f.facts = []; }); assert.deepEqual(S.publicView(a), publicBefore);
  assert.equal(S.publicView(a).review.evidence[0].observedAt, 10);
  assert.doesNotMatch(JSON.stringify(S.publicView(a)), /original-beasts|original-god|qualifiedAt|since|history|targets|phase/);
});
test('continued JSON save/import retains assessment and knowledge, rebinding only its own copy; a fresh run inherits nothing', () => {
  const s = setup(); tick(s, 0); tick(s, 100); const restored = S.normalize(copy(s)); assert.deepEqual(restored, s);
  const imported = S.rebind(restored, b, { ...b, runId: 'imported' }); assert.equal(imported.runId, 'imported'); assert.equal(s.runId, 'run');
  assert.equal(imported.since, 0); assert.equal(S.rebind(s, { ...b, runId: 'wrong' }, b), null);
  const fresh = S.create({ ...b, runId: 'fresh' }, { complete: true, targets }, 0); assert.equal(fresh.since, null); assert.equal(fresh.review, null);
  S.syncBaseline(restored, { complete: true, targets: [{ ...targets[0], sourceId: 'replacement-population' }] }); assert(restored.conflict);
});
test('invalid imported empty qualification cannot survive normalization, and foreign or future source facts cannot qualify', () => {
  const s = setup(); tick(s, 0); tick(s, S.INTERVAL);
  const empty = S.normalize({ ...s, targets: [] }); assert.equal(empty.phase, 'unverified'); assert.equal(empty.qualifiedAt, null);
  const conflicted = S.normalize({ ...s, conflict: true }); assert.equal(conflicted.since, null);
  for (const change of [f => { f.facts[0].runId = 'foreign'; }, f => { f.facts[0].since = 100; }, f => { f.facts[0].sourceId = 'replacement'; }]) {
    const x = setup(); tick(x, 0, change); assert.equal(x.phase, 'unverified');
  }
});
test('review strips private additions and rejects future documents without consulting private qualification', () => {
  const s = setup(); const evidence = { id: 'held', sourceId: 'original-account', label: 'Held document', status: 'control', observedAt: 1, receivedAt: 2, privateRoster: 'SECRET' };
  S.review(s, b, [evidence, { ...evidence, id: 'future', receivedAt: 200 }], 10);
  assert.equal(s.review.evidence.length, 1); assert.doesNotMatch(JSON.stringify(S.publicView(s)), /SECRET|future/);
  const before = copy(s.review); assert.equal(S.review(s, b, [], 11, true, false), false); assert.deepEqual(s.review, before);
});
test('irreversible death freezes private evaluation and received reviews without an ending or award from this module', () => {
  const s = setup(); tick(s, 0); const original = copy(s);
  assert.equal(S.advance(s, b, { complete: true, facts: targets.map(t => fact(t, S.INTERVAL)) }, S.INTERVAL, false), false);
  assert.equal(S.review(s, b, [], S.INTERVAL, false), false); assert.deepEqual(s, original);
});

test('qualified episodes retain original scope and proof through actual failure, recovery, later births and continued copies', () => {
  const s = setup(); tick(s, 0); tick(s, S.INTERVAL);
  const first = copy(s.intervals[0]); tick(s, S.INTERVAL + 20);
  assert.equal(s.intervals.length, 1); assert.equal(s.intervals[0].lastConfirmedAt, S.INTERVAL + 20);
  tick(s, S.INTERVAL + 40, f => { f.facts[0].state = 'notQualifying'; f.facts[0].viable = false; });
  assert.equal(s.phase, 'failed'); assert.equal(s.qualifiedAt, null); assert.equal(s.intervals.length, 1);
  assert.equal(s.intervals[0].qualifiedAt, first.qualifiedAt); assert.deepEqual(s.intervals[0].proofs, first.proofs);
  assert.equal(s.intervals[0].closedAt, S.INTERVAL + 40);
  const closed = copy(s.intervals[0]); tick(s, S.INTERVAL + 60); tick(s, 2 * S.INTERVAL + 60);
  assert.equal(s.intervals.length, 2); assert.deepEqual(s.intervals[0], closed);
  const newGod = { id: 'divine:later', sourceId: 'new-ascendant', kind: 'divine', createdAt: s.lastAt + 1 };
  S.advance(s, b, { complete: true, additions: [{ ...newGod, ...b, causeId: 'actual-later-ascension' }],
    facts: [...targets.map(t => fact(t, s.lastAt + 1, S.INTERVAL + 60)), fact(newGod, s.lastAt + 1, s.lastAt + 1)] }, s.lastAt + 1);
  assert(s.targets.some(t => t.id === newGod.id)); assert(!s.intervals[0].targets.some(t => t.id === newGod.id));
  const loaded = S.normalize(copy(s)); assert.deepEqual(loaded.intervals, s.intervals);
  const continued = S.rebind(copy(s), b, { worldId: 'copy', runId: 'continued' }); assert.deepEqual(continued.intervals, s.intervals);
  assert.deepEqual(setup().intervals, []); assert.doesNotMatch(JSON.stringify(S.publicView(s)), /supremacy-interval|lastConfirmedAt|proofs|targets|new-ascendant/);
});

test('legacy phase/history cannot manufacture an archived interval and corrupt archives are not accepted', () => {
  const old = setup(); tick(old, 0); tick(old, S.INTERVAL); delete old.intervals; delete old.archiveStartedAt;
  const restored = S.normalize(old); assert.deepEqual(restored.intervals, []); assert.equal(restored.archiveStartedAt, old.lastAt);
  tick(restored, old.lastAt + 1); assert.deepEqual(restored.intervals, []);
  tick(restored, 2 * S.INTERVAL); assert.equal(restored.intervals.length, 1); assert.equal(restored.intervals[0].qualifiedAt, 2 * S.INTERVAL);
  const invalids = [e => e.qualifiedAt--, e => e.proofs.pop(), e => { e.targets.pop(); e.proofs.pop(); },
    e => e.targets = [], e => e.proofs[0].viable = false,
    e => e.proofs[0].proofId = '', e => e.lastConfirmedAt = 10 ** 20,
    e => Object.assign(e.proofs[2].strategic, { canOverturn: true, willing: true })];
  for (const change of invalids) {
    const state = copy(restored); change(state.intervals[0]); assert.deepEqual(S.normalize(state).intervals, []);
  }
});

test('attended assessment compiles only held records, is identical across opposite hidden outcomes and creates no recognition', () => {
  const good = setup(), bad = setup(); tick(good, 0); tick(good, S.INTERVAL); tick(bad, S.INTERVAL);
  const c = { alive: true, capable: true, local: true, atDesk: true, deskAvailable: true, busy: false, deskId: 'original-workbench' };
  const evidence = [{ id: 'held-local-account', sourceId: 'original-clerk', label: 'Local account only', status: 'control', observedAt: 5, receivedAt: 10 }];
  bad.phase = 'failed'; bad.since = bad.qualifiedAt = null;
  for (const s of [good, bad]) { S.review(s, b, evidence, S.INTERVAL); assert(S.assess(s, b, c, S.INTERVAL)); }
  assert.deepEqual(S.publicView(good), S.publicView(bad)); assert.equal(good.accomplishment, undefined);
  assert.deepEqual(good.assessment.evidence, evidence); assert.equal(good.assessment.at, S.INTERVAL);
  const held = copy(good.assessment); tick(good, S.INTERVAL + 100); assert.deepEqual(good.assessment, held);
  assert.deepEqual(S.normalize(copy(good)).assessment, held);
  for (const key of ['alive', 'capable', 'local', 'atDesk', 'deskAvailable']) {
    assert.equal(S.assess(good, b, { ...c, [key]: false }, good.lastAt), false); assert.deepEqual(good.assessment, held);
  }
  assert.equal(S.assess(good, b, { ...c, busy: true }, good.lastAt), false);
  assert.equal(S.assess(good, b, { ...c, deskId: '' }, good.lastAt), false);
  assert.equal(S.assess(good, { ...b, runId: 'foreign' }, c, good.lastAt), false);
});
