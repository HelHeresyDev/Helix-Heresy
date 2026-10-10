const { test } = require('node:test');
const assert = require('node:assert/strict');
const Watch = require('../watch-recognition');
const Works = require('../public-works-recognition');
const Charter = require('../charter-recognition');
const Abdication = require('../incumbent-resistance');
const Succession = require('../city-succession');
const Bargains = require('../sovereign-bargains');
const Institutions = require('../home-institution-context');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap') {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a', active: true, channelPowered: true,
    civicCounter: { cell: { x: 17, y: 8, z: 6 } }, clerk: { id: 'clerk:a', locationId: 'office:a',
      mapCell: { x: 18, y: 8, z: 6 }, status: 'alive', health: 100 }, power: 12, workSeconds: 14400, assignment: null, records: [] };
  const rule = { id: 'rule:a', principle: Succession.CHARTERS[0], reviewInstitutionId: 'review:a',
    coercionRule: 'independentConfirmationPermitted', requiredAuthorizationIds: [], text: 'Explicit local rule.' };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Incumbent', kind: 'individual' },
    succession: Succession.CHARTERS[0], designationReview: rule, administrationId: office.institutionId, defenseId: 'defense:a',
    populationSourceId: 'population:a', archive: { coverage: [{ cellId: 'a' }] },
    institutions: Succession.ROLES.map(role => ({ role, id: role === 'centralAdministration' ? office.institutionId : role === 'civicReview' ? 'review:a' : `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office, { theme }), succession = Succession.create(source, b, office, { theme });
  const abdication = Abdication.create(succession, b, office, theme);
  succession.ruler.personalDefense.policy = 'preserveLife'; succession.ruler.health = 34;
  const c = { alive: true, capable: true, local: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true, busy: false,
    activeViolence: false, charterCurrent: true, cityId: 'a', authorityId: 'ruler:a', bodyEpoch: 0,
    rulerPresent: true, rulerDistanceM: 1, rulerLineOfEffect: true, cell: { x: 17, y: 8, z: 6 }, recordWitnesses: [office.clerk.id],
    administrationAvailable: true, reviewAvailable: true, rule: copy(rule), authorizationIds: [], conduct: [],
    publicWorksAvailable: true, publicWorksInstitutionId: source.institutions.find(i => i.role === Works.ROLE).id,
    watchAvailable: true, watchInstitutionId: source.institutions.find(i => i.role === Watch.ROLE).id,
    geometryAvailable: true, postReachable: true, counterVisible: true, presentIds: succession.leaders.map(a => a.id) };
  assert.ok(Abdication.demand(abdication, succession, c, 0));
  assert.ok(Abdication.accept(abdication, succession, office, copy(abdication.terms), c, 0)); Abdication.advance(abdication, succession, office, c, 60);
  const charter = Charter.create(succession, abdication, office, theme), institutions = Institutions.create({ cityId: 'a' },
    source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 60);
  Charter.admin(charter, succession).recognitionPolicy = 'considerAdministrativeContinuity';
  const args = [charter, succession, abdication, office, institutions];
  assert.ok(Charter.file(...args, c, 60)); let at = charter.review.readyAt;
  assert.ok(Charter.hear(...args, c, at)); at += 180; Charter.advance(...args, c, at);
  assert.ok(Charter.meeting(...args, c, at)); at += 60; Charter.advance(...args, c, at);
  assert.ok(Charter.sign(...args, copy(charter.terms), c, at)); at += 60; Charter.advance(...args, c, at);
  const works = Works.create(charter, succession, office); Works.worker(works, succession).publicWorksPolicy = 'considerSuppliedCounter';
  const wa = [works, charter, succession, abdication, office];
  assert.ok(Works.meet(...wa, c, at)); at += 60; Works.advance(...wa, c, at);
  assert.ok(Works.sign(...wa, copy(works.terms), c, at)); at += 60; Works.advance(...wa, c, at);
  const s = Watch.create(charter, works, succession, office), actor = Watch.actor(s, succession);
  actor.watchPolicy = 'considerCounterObservation';
  return { s, charter, works, succession, abdication, office, c, at, actor, b, institutions };
}
const args = f => [f.s, f.charter, f.works, f.succession, f.abdication, f.office];
const move = (a, target) => { for (const key of ['x', 'y', 'z']) if (a.mapCell[key] !== target[key]) { a.mapCell[key] += Math.sign(target[key] - a.mapCell[key]); return true; } return false; };
function tick(f, seconds = 1, effects = { move }) { f.at += seconds; Watch.advance(...args(f), f.c, f.at, effects); }
function recognize(f) {
  assert.ok(Watch.meet(...args(f), f.c, f.at)); tick(f, 60);
  assert.ok(Watch.sign(...args(f), copy(f.s.terms), f.c, f.at)); tick(f, 60);
}
function watch(f) { recognize(f); assert.ok(Watch.order(...args(f), Watch.instructionTerms(f.s), f.c, f.at)); tick(f, 30); }
function reach(f) { for (let n = 0; n < 30 && f.s.duty.status !== 'observing'; n++) tick(f); assert.equal(f.s.duty.status, 'observing'); }
const event = f => ({ id: `actual-attack:${f.at}`, at: f.at, cityId: 'a', actorId: 'scientist', targetId: 'ruler:a',
  kind: 'attackAtMunicipalCounter', cell: { x: 17, y: 8, z: 6 }, detail: 'Observed attack attempt on municipal ground.' });
const perception = { observed: true, identified: true, counterVisible: true };
test('records-only administrator reaffirmation cannot reactivate old public-works or watch assent, but accepted safe return survives', () => {
  const f = fixture(); watch(f); reach(f); tick(f, 100);
  const works = copy(f.works.receipt), watchReceipt = copy(f.s.receipt), originalCentral = copy(f.charter.recognition);
  assert.ok(Works.authorization(f.works, f.charter, f.succession, f.abdication, f.office, f.c));
  const ca = [f.charter, f.succession, f.abdication, f.office, f.institutions];
  f.c.rule.text = 'Received clarified local confirmation requirement.';
  assert.ok(Charter.reconsider(...ca, f.c, f.at)); f.at = f.charter.reconsideration.readyAt;
  assert.ok(Charter.hearReconsideration(...ca, f.c, f.at)); f.at += 180; Charter.advance(...ca, f.c, f.at);
  assert.ok(Charter.reaffirmMeeting(...ca, f.c, f.at)); f.at += 60; Charter.advance(...ca, f.c, f.at);
  assert.ok(Charter.reaffirmSign(...ca, copy(f.charter.reaffirmation.terms), f.c, f.at)); f.at += 60; Charter.advance(...ca, f.c, f.at);
  assert.equal(Charter.recordsAuthorityCurrent(f.charter, f.succession, f.abdication, f.office, f.c), true);
  assert.equal(Charter.authorityCurrent(f.charter, f.succession, f.abdication, f.office, f.c), false);
  assert.equal(Works.authorization(f.works, f.charter, f.succession, f.abdication, f.office, f.c), null);
  assert.equal(Watch.authorization(...args(f), f.c), null); assert.equal(Watch.order(...args(f), Watch.instructionTerms(f.s), f.c, f.at), false);
  assert.deepEqual(f.works.receipt, works); assert.deepEqual(f.s.receipt, watchReceipt); assert.deepEqual(f.charter.recognition, originalCentral);
  tick(f, 500); for (let n = 0; n < 30 && f.s.duty; n++) tick(f);
  assert.equal(f.s.duty, null); assert.equal(f.s.deliveries.length, 1); assert.equal(f.s.deliveries[0].seconds, 600);
  assert.equal(f.office.power, 0); assert.equal(f.succession.control, null); assert.equal(f.succession.handover, null);
});
test('all themes use separate authentic original receipts without wider roles, free stock or altered cases', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme), before = copy({ charter: f.charter.recognition, works: f.works.receipt, b: f.b, ruler: f.succession.ruler });
    f.actor.roles.push('publicWorksAndProvisioning'); recognize(f);
    assert.equal(f.s.receipt.role, 'civilWatch'); assert.equal(f.s.receipt.origin, 'coerced'); assert.equal(f.s.sourceTheme, 'shared');
    assert.equal(f.s.receipt.personId, f.actor.id); assert.match(f.s.terms.retainedRights, /property and faith/);
    assert.deepEqual({ charter: f.charter.recognition, works: f.works.receipt, b: f.b, ruler: f.succession.ruler }, before);
    assert.equal(f.succession.handover, null); assert.equal(f.succession.control, null); assert.deepEqual(f.succession.agreements, []);
    assert.equal(f.succession.provision.stock, 0); assert.equal(f.s.receipt.commandRelationship.role, 'civilWatch');
  }
});
test('missing or forged prerequisite receipts and changed original identities never authorize a signature', () => {
  const f = fixture(); assert.equal(Watch.create(f.charter, null, f.succession, f.office), null);
  const saved = copy(f.works.receipt); f.works.receipt.personId = 'replacement';
  assert.equal(Watch.meet(...args(f), f.c, f.at), false); f.works.receipt = saved; recognize(f);
  for (const change of [r => r.personId = 'replacement', r => r.role = 'militaryDefenseCommand', r => r.recorderId = 'new-clerk',
    r => r.bodyEpoch++, r => r.terms.reviewId = 'false-review', r => r.worksReceiptId = 'forged']) {
    const r = copy(f.s.receipt); change(f.s.receipt); assert.equal(Watch.authorization(...args(f), f.c), null); f.s.receipt = r;
  }
  assert.equal(Watch.authorization(...args(f), { ...f.c, watchAvailable: false }), null);
  assert.equal(Watch.authorization(...args(f), { ...f.c, watchInstitutionId: 'replacement' }), null);
});
test('personal and received-evidence refusals are stable across reload and do not judge guilt', () => {
  for (const reason of ['policy', 'conditions']) {
    const f = fixture(); if (reason === 'policy') f.actor.watchPolicy = 'declineCoercedContinuation'; else f.c.watchConditions = ['Received incompatible obligation'];
    assert.ok(Watch.meet(...args(f), f.c, f.at)); tick(f, 60); const response = copy(f.s.response);
    assert.equal(response.decision, 'refused'); assert.match(response.reason, /not criminal guilt/); f.s = Watch.normalize(f.s);
    assert.equal(Watch.meet(...args(f), f.c, f.at), false); assert.deepEqual(f.s.response, response); assert.equal(f.s.receipt, null);
  }
});
test('actual attendance, shared assignments, finite duty and power are required', () => {
  for (const change of [f => f.c.local = false, f => f.c.capable = false, f => f.c.cityId = 'other', f => f.c.bodyEpoch++,
    f => f.c.presentIds = [], f => f.c.atCounter = false, f => f.c.clerkPresent = false, f => f.c.lineOfSight = false,
    f => f.c.busy = true, f => f.c.activeViolence = true, f => f.c.watchAvailable = false, f => f.office.channelPowered = false,
    f => f.office.power = 0, f => f.office.workSeconds = 59, f => f.actor.workSeconds = 59, f => f.actor.assignment = 'independent-duty',
    f => f.office.clerk.assignment = 'independent-duty']) {
    const f = fixture(); change(f); assert.equal(Watch.meet(...args(f), f.c, f.at), false);
  }
});
test('partial meetings reload, pause without backfill, expire exact terms and retain spent costs', () => {
  const f = fixture(), work = f.office.workSeconds, power = f.office.power;
  assert.ok(Watch.meet(...args(f), f.c, f.at)); tick(f, 20); f.s = Watch.normalize(f.s);
  f.office.channelPowered = false; tick(f, 400); assert.equal(f.s.job.progress, 20);
  f.office.channelPowered = true; tick(f, 400); assert.equal(f.s.job.progress, 20); tick(f, 40);
  assert.equal(f.office.workSeconds, work - 60); assert.equal(f.office.power, power - 1);
  assert.equal(Watch.sign(...args(f), { ...f.s.terms, role: 'army' }, f.c, f.at), false);
  assert.ok(Watch.sign(...args(f), copy(f.s.terms), f.c, f.at)); tick(f, 10); tick(f, 3600);
  assert.equal(f.s.receipt, null); assert.equal(f.s.job, null); assert.equal(f.office.power, power - 2);
  assert.equal(Watch.meet(...args(f), f.c, f.at), false);
});
test('unsupported instructions, unavailable upkeep and insufficient duty cannot assign guards', () => {
  const f = fixture(); recognize(f); const terms = Watch.instructionTerms(f.s);
  for (const bad of [{ ...terms, duty: 'Arrest a rival' }, { ...terms, seconds: 86400 }, { ...terms, post: { x: 1, y: 1, z: 6 } }])
    assert.equal(Watch.order(...args(f), bad, f.c, f.at), false);
  for (const c of [{ ...f.c, postReachable: false }, { ...f.c, geometryAvailable: false }]) assert.equal(Watch.order(...args(f), terms, c, f.at), false);
  f.office.maintenanceReady = false; assert.equal(Watch.order(...args(f), terms, f.c, f.at), false); f.office.maintenanceReady = true;
  f.actor.workSeconds = 689; assert.equal(Watch.order(...args(f), terms, f.c, f.at), false); assert.equal(f.s.duty, null);
});
test('original officer physically reaches post, spends exactly ten minutes, and physically returns once', () => {
  const f = fixture(), work = f.actor.workSeconds, clerkWork = f.office.workSeconds, power = f.office.power, home = copy(f.actor.mapCell);
  watch(f); assert.equal(f.s.duty.progress, 0); assert.notDeepEqual(f.actor.mapCell, Watch.POST);
  tick(f, 1000, { move: () => false }); assert.equal(f.s.duty.progress, 0); assert.deepEqual(f.actor.mapCell, home);
  reach(f); tick(f, 200); f.s = Watch.normalize(f.s); assert.equal(f.s.duty.progress, 200);
  f.c.local = f.c.atCounter = false; f.c.cityId = 'away'; tick(f, 400);
  assert.equal(f.s.duty.status, 'returning'); assert.equal(f.s.duty.progress, 600);
  for (let n = 0; n < 30 && f.s.duty; n++) tick(f);
  assert.equal(f.s.duty, null); assert.deepEqual(f.actor.mapCell, home); assert.equal(f.s.deliveries.length, 1);
  assert.equal(f.s.deliveries[0].seconds, 600);
  assert.equal(f.actor.workSeconds, work - 150 - 600 - f.s.deliveries[0].travelSeconds);
  assert.equal(f.office.workSeconds, clerkWork - 150); assert.equal(f.office.power, power - 3);
  tick(f, 10000); assert.equal(f.s.deliveries.length, 1); assert.equal(f.actor.assignment, null);
});
test('outages, blocked sight, incapacity and zero duty pause watch without free backfill or substitutions', () => {
  const f = fixture(); watch(f); reach(f); tick(f, 100);
  for (const key of ['outage', 'sight', 'health', 'work']) {
    const prior = { powered: f.office.channelPowered, visible: f.c.counterVisible, health: f.actor.health, work: f.actor.workSeconds };
    if (key === 'outage') f.office.channelPowered = false;
    if (key === 'sight') f.c.counterVisible = false;
    if (key === 'health') f.actor.health = 49;
    if (key === 'work') f.actor.workSeconds = 0;
    tick(f, 500); assert.equal(f.s.duty.progress, 100);
    f.office.channelPowered = prior.powered; f.c.counterVisible = prior.visible; f.actor.health = prior.health; f.actor.workSeconds = prior.work;
    tick(f, 500); assert.equal(f.s.duty.progress, 100);
  }
  tick(f, 50); assert.equal(f.s.duty.progress, 150);
});
test('actual current identified perceptions alone create once-only private incidents, including scientist attacks', () => {
  const f = fixture(); watch(f);
  assert.equal(Watch.observe(f.s, f.succession, event(f), perception, f.at), null); reach(f);
  for (const p of [{ ...perception, observed: false }, { ...perception, identified: false }, { ...perception, counterVisible: false }])
    assert.equal(Watch.observe(f.s, f.succession, event(f), p, f.at), null);
  assert.equal(Watch.observe(f.s, f.succession, { ...event(f), at: f.at - 1 }, perception, f.at), null);
  assert.equal(Watch.observe(f.s, f.succession, { ...event(f), cityId: 'other' }, perception, f.at), null);
  const r = Watch.observe(f.s, f.succession, event(f), perception, f.at); assert.ok(r); assert.equal(r.actorId, 'scientist');
  assert.equal(Watch.observe(f.s, f.succession, event(f), perception, f.at), null);
  f.s = Watch.normalize(f.s); assert.equal(Watch.publicView(f.s).reports.length, 0);
  assert.doesNotMatch(JSON.stringify(Watch.publicView(f.s)), /watchPolicy|"evidence"|"eventId"|mapCell|workSeconds/);
});
test('fractional ticks preserve one-second travel costs and cannot teleport or duplicate movement after reload', () => {
  const f = fixture(); watch(f); const home = copy(f.actor.mapCell), work = f.actor.workSeconds;
  tick(f, .25); tick(f, .25); f.s = Watch.normalize(f.s); tick(f, .25);
  assert.deepEqual(f.actor.mapCell, home); assert.equal(f.actor.workSeconds, work);
  tick(f, .25); assert.notDeepEqual(f.actor.mapCell, home); assert.equal(f.actor.workSeconds, work - 1);
  assert.equal(f.s.duty.travelSeconds, 1); tick(f, .25); assert.equal(f.s.duty.travelSeconds, 1);
});
test('reports require actual return and attended finite communication before existing recognition evidence consumes them', () => {
  const f = fixture(); watch(f); reach(f); const original = copy(f.charter.recognition);
  Watch.observe(f.s, f.succession, event(f), perception, f.at);
  assert.equal(Watch.receive(f.s, f.succession, f.office, f.c, f.at), false); tick(f, 600);
  for (let n = 0; n < 30 && f.s.duty; n++) tick(f);
  const before = f.office.workSeconds, power = f.office.power;
  f.c.local = false; assert.equal(Watch.receive(f.s, f.succession, f.office, f.c, f.at), false); f.c.local = true;
  assert.ok(Charter.authorityCurrent(f.charter, f.succession, f.abdication, f.office, f.c));
  assert.ok(Watch.receive(f.s, f.succession, f.office, f.c, f.at, { communicate: r => f.c.conduct.push(r) }));
  assert.equal(f.office.workSeconds, before - 30); assert.equal(f.office.power, power - 1);
  assert.equal(Watch.publicView(f.s).reports.length, 1); assert.equal(f.s.reports[0].communicatedAt, f.at);
  assert.equal(Charter.authorityCurrent(f.charter, f.succession, f.abdication, f.office, f.c), false);
  assert.deepEqual(f.charter.recognition, original); assert.equal(Watch.receive(f.s, f.succession, f.office, f.c, f.at), false);
  assert.equal(Watch.order(...args(f), Watch.instructionTerms(f.s), f.c, f.at), false);
});
test('accepted safe work survives changed cooperation; body change requests physical return and death freezes exactly', () => {
  const f = fixture(); watch(f); reach(f); tick(f, 100);
  f.c.conduct.push({ id: 'new-evidence', at: f.at, kind: 'attack', targetId: 'ruler:a', witnessId: 'clerk:a' });
  tick(f, 100); assert.equal(f.s.duty.progress, 200);
  f.c.bodyEpoch++; tick(f); assert.equal(f.s.duty.status, 'returning'); assert.equal(f.s.duty.interrupted, true);
  f.c.alive = false; const frozen = copy({ s: f.s, actor: f.actor, office: f.office }); tick(f, 2000);
  assert.deepEqual({ s: f.s, actor: f.actor, office: f.office }, frozen);
  f.c.alive = true; for (let n = 0; n < 30 && f.s.duty; n++) tick(f);
  assert.equal(f.s.deliveries[0].status, 'interruptedReturn'); assert.equal(f.s.deliveries[0].seconds, 200);
});
test('another actor can be reported without attributing that conduct to the scientist or invalidating their historical finding', () => {
  const f = fixture(); watch(f); reach(f);
  assert.ok(Watch.observe(f.s, f.succession, { ...event(f), actorId: 'original-defender', targetId: 'scientist' }, perception, f.at));
  tick(f, 600); for (let n = 0; n < 30 && f.s.duty; n++) tick(f);
  const received = [];
  assert.ok(Watch.receive(f.s, f.succession, f.office, f.c, f.at, { communicate: r => {
    received.push(r); if (r.actorId === 'scientist') f.c.conduct.push(r);
  } }));
  assert.equal(received[0].actorId, 'original-defender'); assert.equal(f.c.conduct.length, 0);
  assert.ok(Charter.authorityCurrent(f.charter, f.succession, f.abdication, f.office, f.c));
});
