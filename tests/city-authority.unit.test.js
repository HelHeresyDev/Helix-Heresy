const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('../city-authority'), R = require('../city-rule'), S = require('../durable-supremacy');
const { sourceMap } = require('./helpers/city-authority-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(kind = 'collective', status = 'sovereign') {
  const sources = sourceMap(kind, status), book = A.create({ worldId: 'world', runId: 'run' }), e = A.register(book, sources.political);
  const offices = Object.fromEntries(['a', 'controller'].map(cityId => [cityId, { id: `${cityId}:counter`,
    clerk: { id: `${cityId}:clerk`, status: 'alive', health: 100 }, workSeconds: 10000, power: 10000, assignment: null }]));
  const f = { sources, book, e, offices, at: 0, current: 'a' };
  f.context = () => ({ alive: true, capable: true, local: true, atCounter: true, free: true, permission: true,
    sourceCurrent: true, clerkPresent: true, clerkId: offices[f.current].clerk.id, bodyEpoch: 0, at: f.at, cityId: f.current,
    ...(status === 'displacedClaim' ? { displacedChannelId: sources.political.parties[0].channel } : {}) });
  f.act = (action, expected = null, seconds) => { assert(A.begin(book, e, action, f.context(), offices[f.current], f.at, expected));
    f.at += seconds ?? book.job.seconds; assert(A.advance(book, f.context(), offices[f.current], f.at)); };
  f.sign = () => { f.act('inspect'); f.act('negotiate'); assert.equal(e.phase, 'offered'); f.act('accept', copy(e.terms)); };
  f.operationContext = () => ({ ...f.context(), politicalAuthorities: book.authorities, coverageVerified: true,
    institutionsAvailable: true, defenseAvailable: true, counterpower: 'noEstablishedChallenge', reportersPresent: true,
    routes: { 'farm:a': true } });
  e.staff = [...new Set(sources.operation.institutions.map(i => i.id))].map(institutionId => ({ id: `${institutionId}:officeholder`, institutionId,
    roles: sources.operation.institutions.filter(i => i.id === institutionId).map(i => i.role), status: 'alive', health: 100 }));
  return f;
}
test('current source matrix preserves individual/collective government and every original control state without rewriting the world', () => {
  for (const kind of ['individual', 'collective']) for (const status of ['sovereign', 'tributary', 'puppet', 'occupied', 'displacedClaim']) {
    const f = sourceMap(kind, status), original = JSON.stringify(f.map);
    assert(A.validSource(f.political)); assert.equal(f.political.parties[0].kind, kind);
    assert.equal(f.political.controlStatus, status); assert.equal(f.political.parties.length, ['tributary', 'puppet', 'occupied'].includes(status) ? 2 : 1);
    assert.deepEqual(A.sourceFromWorld(f.map, 'a'), f.political); assert.equal(JSON.stringify(f.map), original);
  }
});
test('missing published political authority cannot be inferred from a collective label or silently added to an old charter', () => {
  const f = sourceMap(), original = JSON.stringify(f.map);
  delete f.map.cityGovernments.governments[0].charter.politicalAgreements;
  assert.equal(A.sourceFromWorld(f.map, 'a'), null);
  assert.equal(f.map.cityGovernments.governments[0].charter.politicalAgreements, undefined);
  const restored = JSON.parse(original); restored.cityGovernments.governments[0].charter.politicalAgreements.collectiveRule = 'spokespersonMaySurrender';
  assert.equal(A.sourceFromWorld(restored, 'a'), null);
});
test('collective authorization requires the original body resolution; the reception representative or a single imported vote cannot submit a city', () => {
  const f = fixture(); f.act('inspect'); f.act('negotiate');
  assert.equal(f.book.authorities[0].members.length, 3); assert.equal(f.e.phase, 'offered');
  assert.equal(A.authorizes(f.e, f.book.authorities, f.context(), f.at), false);
  f.act('accept', copy(f.e.terms)); assert(A.authorizes(f.e, f.book.authorities, f.context(), f.at));
  assert.equal(f.e.resolutions[0].members.length, 3);
  const forged = copy(f.book); forged.authorities[0].members.splice(1); forged.entries[0].resolutions[0].members.splice(1); forged.entries[0].resolutions[0].required = 1;
  assert.equal(A.normalize(forged), null); assert.equal(A.authorizes(forged.entries[0], forged.authorities, f.context(), f.at), false);
});
test('original controller assent is city-specific, consumes its own original duty and does not transfer another city automatically', () => {
  for (const status of ['tributary', 'puppet', 'occupied']) {
    const f = fixture('collective', status); f.sign(); assert.equal(f.e.phase, 'awaitingControllers');
    assert.equal(A.authorizes(f.e, f.book.authorities, f.context(), f.at), false);
    const local = copy(f.book.authorities[0]); f.current = 'controller'; f.act('assent', copy(f.e.terms));
    assert(A.authorizes(f.e, f.book.authorities, f.context(), f.at)); assert.deepEqual(f.book.authorities[0], local);
    assert.equal(f.book.authorities[1].members[0].dutySeconds, 1620);
    assert.equal(f.book.entries.length, 1); assert.equal(f.book.entries[0].source.cityId, 'a');
  }
});
test('public charter inspection cannot disclose a covert puppet controller; the actual original governing body must consent to disclosure', () => {
  const f = fixture('collective', 'puppet'); f.act('inspect');
  assert.equal(f.e.knowledge.controlStatus, 'sovereign'); assert.equal(f.e.knowledge.parties.length, 1);
  assert(!JSON.stringify(f.e.knowledge).includes('ruler:controller'));
  f.act('negotiate'); assert.equal(f.e.knowledge.controlStatus, 'puppet'); assert.equal(f.e.knowledge.parties.length, 2);
  const saved = copy(f.e.knowledge); f.e.source.parties[1].name = 'PRIVATE_NEW_NAME';
  assert.deepEqual(f.e.knowledge, saved);
});
test('actual client operation, not political signatures, supplies three-day local control; real shortages and withdrawal break it without deleting historical receipts', () => {
  const f = fixture(); f.sign(); const c = f.operationContext();
  const r = R.createClient(f.sources.operation, f.e, f.book.authorities, f.book, f.at, { id: 'original-ward', initialEnergy: 69120 }, c);
  assert(r); assert.equal(r.authorityKind, 'subordinateLocalGovernment');
  assert.equal(S.cityAccount(f.book, r, f.e, f.e.staff, c, f.at).state, 'notQualifying');
  assert(R.order(r, f.e, f.e.staff, c, f.at)); f.at += 3600 + R.INTERVAL;
  R.advance(r, f.e, f.e.staff, f.operationContext, f.at); assert.equal(r.status, 'established');
  assert.equal(S.cityAccount(f.book, r, f.e, f.e.staff, f.operationContext(), f.at).basis, 'enforceableClient');
  assert(R.receive(r, f.e, f.e.staff, f.operationContext(), f.at)); const received = copy(r.report);
  const support = S.create(f.book, { complete: false, targets: [] }, f.at); assert(S.receiveCityReport(support, support, received, f.at));
  const held = copy(support.cityReports); f.act('withdraw'); R.advance(r, f.e, f.e.staff, f.operationContext, f.at);
  assert.equal(r.status, 'contested'); assert.deepEqual(support.cityReports, held);
  assert.equal(R.authority(r, f.e, f.e.staff, f.operationContext()), false);
  const second = fixture(); second.sign(); const r2 = R.createClient(second.sources.operation, second.e, second.book.authorities, second.book, second.at,
    { id: 'original-ward', initialEnergy: 69120 }, second.operationContext());
  R.order(r2, second.e, second.e.staff, second.operationContext(), second.at); second.at += 5 * R.DAY;
  R.advance(r2, second.e, second.e.staff, second.operationContext, second.at);
  assert.equal(r2.energy, 0); assert.equal(r2.status, 'contested'); assert.equal(r2.initialEnergy, r.initialEnergy);
});
test('destruction alone cannot retire a city; an actual original claimant settlement can, without killing surviving people or rebuilding the ruins', () => {
  const f = fixture('collective', 'displacedClaim');
  assert.equal(A.lifecycleFact(f.e, f.book, f.context(), f.at).state, 'unverified'); f.sign();
  const fact = A.lifecycleFact(f.e, f.book, f.context(), f.at); assert.equal(fact.state, 'retired');
  assert.equal(fact.lifecycle.population, 0); assert.equal(fact.lifecycle.causeId, 'original-destruction-and-displacement');
  assert(f.book.authorities[0].members.every(m => m.status === 'alive' && m.health === 100));
  const target = { kind: 'city', id: 'city:a', sourceId: 'population:a', createdAt: 0 };
  assert.equal(S.factState(target, fact, f.book, f.at), 'retired');
  assert.equal(A.lifecycleFact(f.e, f.book, { ...f.context(), actualOpposition: true }, f.at).state, 'unverified');
});
test('a historical claimant broadcast hook cannot manufacture a current communication address, operator or power allocation', () => {
  const f = sourceMap('collective', 'displacedClaim');
  delete f.map.strategicPoliticalHistory.currentControlRows[0].claimantChannel;
  assert.equal(A.sourceFromWorld(f.map, 'a'), null);
  const g = fixture('collective', 'displacedClaim'); g.sign();
  assert.equal(g.book.authorities[0].channelPower, 9); assert.equal(g.book.authorities[0].channelWorkSeconds, 1500);
  g.book.authorities[0].channelPower = 0;
  assert.equal(A.begin(g.book, g.e, 'report', g.context(), g.offices.a, g.at), false);
});
test('relinking a previously materialized original keeps political role bindings and cannot refill wounded or spent physical reserves', () => {
  const f=fixture(), actor={id:'same-original',roles:['militaryDefenseCommand'],status:'alive',health:60,workSeconds:700,stamina:15,wardMana:8,stats:{bodyIntegrity:{current:60,max:100}}};
  f.e.staff=[actor]; const incoming={id:actor.id,status:'alive',health:100,workSeconds:3600,stamina:100,wardMana:120,mapCell:{x:1,y:2,z:3}};
  const linked=A.adoptActor(f.book,incoming); assert.equal(linked,actor);
  assert.deepEqual(linked.roles,['militaryDefenseCommand']);assert.equal(linked.health,60);assert.equal(linked.workSeconds,700);
  assert.equal(linked.stamina,15);assert.equal(linked.wardMana,8);assert.deepEqual(linked.mapCell,incoming.mapCell);
  A.adoptActor(f.book,{...incoming,stats:{bodyIntegrity:{current:20,max:100}}});assert.equal(actor.stats.bodyIntegrity.current,20);
  A.adoptActor(f.book,{...incoming,health:0,status:'dead'});assert.equal(actor.status,'dead');assert.equal(actor.health,0);
});
test('finite shared duty, original clerk, exact terms, attendance and living body gate political work; partial absence never backfills', () => {
  const f = fixture(); f.act('inspect'); const c = f.context(), o = f.offices.a;
  assert(A.begin(f.book, f.e, 'negotiate', c, o, f.at));
  f.at += 30; A.advance(f.book, f.context(), o, f.at); const duty = f.book.authorities[0].members[0].dutySeconds;
  f.at += 500; A.advance(f.book, { ...f.context(), local: false }, o, f.at); assert.equal(f.book.job.progress, 30);
  f.at++; A.advance(f.book, f.context(), o, f.at); assert.equal(f.book.job.progress, 30);
  f.at += 150; A.advance(f.book, f.context(), o, f.at); assert.equal(f.e.phase, 'offered');
  assert.equal(f.book.authorities[0].members[0].dutySeconds, duty - 150);
  assert.equal(A.begin(f.book, f.e, 'accept', f.context(), o, f.at, { ...f.e.terms, rights: 'fabricated unrestricted powers' }), false);
  assert.equal(A.begin(f.book, f.e, 'accept', { ...f.context(), bodyEpoch: 1 }, o, f.at, copy(f.e.terms)), false);
  o.clerk.status = 'dead'; assert.equal(A.begin(f.book, f.e, 'accept', f.context(), o, f.at, copy(f.e.terms)), false);
});
test('stable personal refusal cannot reroll; expiry, real hostile original people and witnessed breach stop authority without refreshing received knowledge', () => {
  const f = fixture('individual'); f.sources.political.parties[0].authorityId = 'ruler:b';
  const book = A.create(f.book), e = A.register(book, f.sources.political), c = f.context(), o = f.offices.a;
  A.begin(book, e, 'inspect', c, o, 0); A.advance(book, { ...c, at: 60 }, o, 60);
  A.begin(book, e, 'negotiate', { ...c, at: 60 }, o, 60); A.advance(book, { ...c, at: 240 }, o, 240);
  assert.equal(e.phase, 'refused'); assert.equal(A.begin(book, e, 'negotiate', { ...c, at: 240 }, o, 240), false);
  const g = fixture(); g.sign(); const received = copy(g.e.knowledge);
  assert.equal(A.authorizes(g.e, g.book.authorities, g.context(), g.e.terms.expiresAt), true); assert.deepEqual(g.e.knowledge, received);
  const unsigned = fixture(); unsigned.act('inspect'); unsigned.act('negotiate'); unsigned.at = unsigned.e.terms.expiresAt;
  assert.equal(A.begin(unsigned.book, unsigned.e, 'accept', unsigned.context(), unsigned.offices.a, unsigned.at, copy(unsigned.e.terms)), false);
  assert.equal(A.externalCampaignAllowed(g.book, 'a', g.context(), g.at), false);
  assert.equal(A.breach(g.book, g.book.authorities[0].members[0].id, { alive: true, witnessed: false }, g.at, 'unseen'), false);
  assert(A.breach(g.book, g.book.authorities[0].members[0].id, { alive: true, witnessed: true }, g.at, 'actual-attack'));
  assert.equal(A.authorizes(g.e, g.book.authorities, g.context(), g.at), false); assert.deepEqual(g.e.knowledge, received);
});
test('actual JSON saves and continued copies preserve original spending, partial work and scoped records; new runs inherit none and death freezes work', () => {
  const f = fixture(); f.sign(); const before = copy(f.book);
  assert.deepEqual(A.normalize(copy(f.book)), before);
  const continued = A.rebind(f.book, f.book, { worldId: 'copy', runId: 'continued' });
  assert.equal(continued.entries[0].runId, 'continued'); assert.deepEqual(continued.authorities, before.authorities);
  assert.deepEqual(continued.entries[0].knowledge, before.entries[0].knowledge);
  assert.deepEqual(A.create(f.book).entries, []);
  assert.equal(A.begin(f.book, f.e, 'report', { ...f.context(), alive: false }, f.offices.a, f.at), false);
  assert.equal(A.advance(f.book, { ...f.context(), alive: false }, f.offices.a, f.at + 100), false); assert.deepEqual(f.book, before);
});
test('political documents cannot replace missing original institutional staff, and later actor materialization cannot refill the same original person', () => {
  const f = fixture('individual'); f.sign(); const ruler = f.book.authorities[0].members[0];
  const spent = ruler.dutySeconds; ruler.health = 55;
  const incoming = { id: ruler.id, health: 100, status: 'alive', workSeconds: 1800, mapCell: { x: 3, y: 4, z: 6 } };
  const samePerson = A.adoptActor(f.book, incoming);
  assert.equal(samePerson, ruler); assert.equal(samePerson.health, 55); assert.equal(samePerson.workSeconds, spent);
  assert.equal(samePerson.dutySeconds, undefined); assert.deepEqual(samePerson.mapCell, incoming.mapCell);
  const r = R.createClient(f.sources.operation, f.e, f.book.authorities, f.book, f.at, { id: 'ward', initialEnergy: 69120 }, f.operationContext());
  assert(r); assert.equal(R.authority(r, f.e, [], f.operationContext()), false);
  assert(R.authority(r, f.e, f.e.staff, f.operationContext()));
  f.e.staff[0].health = 0; f.e.staff[0].status = 'dead';
  assert.equal(R.authority(r, f.e, f.e.staff, f.operationContext()), false);
});
test('home power units fund a job once while foreign seconds fund actual work, and an outage pauses an already paid job', () => {
  const f = fixture(), o = f.offices.a, c = { ...f.context(), powerPerSecond: 0 }; o.power = 1;
  assert(A.begin(f.book, f.e, 'inspect', c, o, 0)); assert.equal(o.power, 0);
  A.advance(f.book, { ...c, at: 30 }, o, 30); assert.equal(f.book.job.progress, 30);
  o.channelPowered = false; A.advance(f.book, { ...c, at: 100 }, o, 100); assert.equal(f.book.job.progress, 30);
  o.channelPowered = true; A.advance(f.book, { ...c, at: 110 }, o, 110); assert.equal(f.book.job.progress, 30);
  A.advance(f.book, { ...c, at: 140 }, o, 140); assert.equal(f.book.job, null); assert.equal(o.power, 0);
  assert.equal(A.begin(f.book, f.e, 'negotiate', { ...c, at: 140 }, o, 140), false);
});
