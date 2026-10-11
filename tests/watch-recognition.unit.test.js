const { test } = require('node:test');
const assert = require('node:assert/strict');
const Watch = require('../watch-recognition');
const Works = require('../public-works-recognition');
const Charter = require('../charter-recognition');
const Abdication = require('../incumbent-resistance');
const Succession = require('../city-succession');
const Bargains = require('../sovereign-bargains');
const Institutions = require('../home-institution-context');
const Administration = require('../city-administration');
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

// Use the real original installation and a real carried battery; no rewritten
// signature, manufactured eligible finding, replacement officer or free refill.
function supportedCounter(f) {
  f.u = Administration.create(f.succession, f.b, f.office, { context: { ...f.c,
    recognitions: { publicWorks: f.works, charter: f.charter, abdication: f.abdication }, recognitionContext: f.c } });
  assert.ok(f.u); f.c.upkeep = f.u; return supplyBattery(f);
}
function supplyBattery(f) {
  const c = { ...f.c, workerPresent: true,
    recognitions: { publicWorks: f.works, charter: f.charter, abdication: f.abdication }, recognitionContext: f.c };
  const battery = { id: 'watch:carried-battery', key: 'relayBattery', quantity: 1, carriedBy: 'scientist' };
  assert.ok(Administration.handSupply(f.u, f.succession, f.b, f.office, [battery], 'relayBattery', c, f.at));
  assert.equal(battery.quantity, 0); return f;
}
function revised(f, suffix = 'clarified') {
  f.c.rule.text = `Authentic clarified local confirmation requirement: ${suffix}`;
  const a = [f.charter, f.succession, f.abdication, f.office, f.institutions];
  assert.ok(Charter.reconsider(...a, f.c, f.at)); f.at = f.charter.reconsideration.readyAt;
  assert.ok(Charter.hearReconsideration(...a, f.c, f.at)); f.at += 180; Charter.advance(...a, f.c, f.at);
  assert.equal(f.charter.reconsideration.finding.outcome, 'eligible'); return f;
}
function adminRenewed(f) {
  const a = [f.charter, f.succession, f.abdication, f.office, f.institutions];
  assert.ok(Charter.reaffirmMeeting(...a, f.c, f.at)); f.at += 60; Charter.advance(...a, f.c, f.at);
  assert.ok(Charter.reaffirmSign(...a, copy(f.charter.reaffirmation.terms), f.c, f.at)); f.at += 60; Charter.advance(...a, f.c, f.at); return f;
}
function worksRenewed(f) {
  const a = [f.works, f.charter, f.succession, f.abdication, f.office];
  assert.ok(Works.reaffirmMeeting(...a, f.c, f.at)); f.at += 60; Works.advance(...a, f.c, f.at);
  assert.ok(Works.reaffirmSign(...a, copy(f.works.reaffirmation.terms), f.c, f.at)); f.at += 60; Works.advance(...a, f.c, f.at);
  assert.ok(Works.reaffirmationCurrent(...a, f.c)); return f;
}
function ready(theme = 'madcap') {
  const f = fixture(theme); recognize(f); supportedCounter(f); return worksRenewed(adminRenewed(revised(f)));
}
function reaffirmed(f) {
  assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 60);
  assert.equal(f.s.reaffirmation.response.decision, 'offered');
  assert.ok(Watch.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at)); tick(f, 60);
  assert.ok(Watch.reaffirmationCurrent(...args(f), f.c)); return f;
}
test('each theme separately reaffirms only the original watch with once-only linked register receipt and finite costs', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = ready(theme), historical = copy({ receipt: f.s.receipt, response: f.s.response, terms: f.s.terms,
      charter: f.charter, works: f.works, reports: f.s.reports, deliveries: f.s.deliveries, upkeep: f.u,
      ruler: f.succession.ruler, defender: f.b.defender, agreements: f.succession.agreements });
    const duty = f.office.workSeconds, work = f.actor.workSeconds, power = f.office.power;
    assert.equal(Watch.authorization(...args(f), f.c), null); reaffirmed(f);
    assert.equal(f.office.workSeconds, duty - 120); assert.equal(f.actor.workSeconds, work - 120); assert.equal(f.office.power, power - 2);
    assert.deepEqual({ receipt: f.s.receipt, response: f.s.response, terms: f.s.terms,
      charter: f.charter, works: f.works, reports: f.s.reports, deliveries: f.s.deliveries, upkeep: f.u,
      ruler: f.succession.ruler, defender: f.b.defender, agreements: f.succession.agreements }, historical);
    assert.equal(Watch.authorization(...args(f), f.c), f.s.receipt);
    assert.equal(f.s.reaffirmation.receipt.type, 'watchReaffirmation');
    assert.equal(f.s.reaffirmation.receipt.worksReaffirmationId, f.works.reaffirmation.receipt.id);
    assert.equal(f.s.reaffirmation.receipt.originalReceiptId, historical.receipt.id);
    assert.equal(f.office.records.filter(r => r.type === 'watchReaffirmation').length, 1);
    assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false);
    assert.equal(Watch.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at), false);
    assert.equal(f.succession.handover, null); assert.equal(f.succession.control, null); assert.equal(f.succession.provision.stock, 0);
  }
});
test('watch renewal requires separately authentic administrative and public-works support, not just eligible reconsideration', () => {
  const f = fixture(); recognize(f); supportedCounter(f); revised(f);
  assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false);
  adminRenewed(f); assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false);
  worksRenewed(f); assert.equal(Watch.authorization(...args(f), f.c), null);
  assert.ok(Watch.canReaffirm(...args(f), f.c));
  for (const change of [f => f.charter.reconsideration.finding.outcome = 'unresolved',
    f => f.charter.reaffirmation.receipt.recorderId = 'replacement', f => f.works.reaffirmation.receipt.role = 'civilWatch',
    f => f.office.records = [], f => f.s.receipt.personId = 'replacement', f => f.s.terms.duties = 'army',
    f => f.s.response.facts = null, f => f.charter.review = null, f => f.charter.claim = null,
    f => f.actor.institutionId = 'other', f => f.actor.status = 'dead', f => f.actor.locationId = 'other',
    f => f.office.clerk.id = 'replacement', f => f.office.clerk = null, f => f.c.watchAvailable = false, f => f.c.watchInstitutionId = 'other',
    f => f.c.publicWorksAvailable = false, f => f.c.upkeep = null, f => f.u.installation.workCell.x++,
    f => f.c.bodyEpoch++, f => f.c.cityId = 'foreign', f => f.c.atCounter = false, f => f.c.local = false,
    f => f.c.presentIds = [], f => f.c.busy = true, f => f.c.activeViolence = true, f => f.c.geometryAvailable = false,
    f => f.office.maintenanceReady = false, f => f.office.workSeconds = 59, f => f.actor.workSeconds = 59,
    f => f.actor.assignment = 'other-duty', f => f.office.power = 0]) {
    const g = ready(); change(g); const old = copy({ s: g.s, actor: g.actor, office: g.office });
    assert.equal(Watch.reaffirmMeeting(...args(g), g.c, g.at), false);
    assert.deepEqual({ s: g.s, actor: g.actor, office: g.office }, old);
  }
});
test('original watch independence and incompatible obligations refuse stably without refreshing offers or clearing evidence', () => {
  for (const why of ['policy', 'conditions']) {
    const f = ready(); if (why === 'policy') f.actor.watchPolicy = 'declineCoercedContinuation';
    else f.c.watchConditions = ['Existing watch duty conflicts with proposed observation'];
    assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 60);
    const old = copy(f.s.reaffirmation), power = f.office.power;
    assert.equal(old.response.decision, 'refused'); assert.equal(old.terms, null);
    f.s = Watch.normalize(f.s); f.actor.watchPolicy = 'considerCounterObservation';
    assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at + 1000), false);
    assert.deepEqual(f.s.reaffirmation, old); assert.equal(f.office.power, power);
    assert.equal(Watch.authorization(...args(f), f.c), null);
  }
  const f = fixture(); recognize(f); supportedCounter(f);
  const incident = { id: 'actual-renewed-attack', at: f.at, kind: 'attack', witnessId: f.office.clerk.id };
  f.c.conduct.push(incident); revised(f);
  const ca = [f.charter, f.succession, f.abdication, f.office, f.institutions];
  assert.ok(Charter.reaffirmMeeting(...ca, f.c, f.at)); f.at += 60; Charter.advance(...ca, f.c, f.at);
  assert.equal(f.charter.reaffirmation.response.decision, 'refused');
  assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false); assert.deepEqual(f.c.conduct, [incident]);
});
test('partial watch reaffirmation saves and pauses through lost attendance and power without backfill', () => {
  const f = ready(), work = f.actor.workSeconds, duty = f.office.workSeconds, power = f.office.power;
  assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 20); f.s = Watch.normalize(f.s);
  f.c.clerkPresent = false; tick(f, 500); assert.equal(f.s.job.progress, 20);
  f.c.clerkPresent = true; tick(f, 100); assert.equal(f.s.job.progress, 20); tick(f, 40);
  assert.ok(Watch.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at)); tick(f, 20); f.s = Watch.normalize(f.s);
  f.office.channelPowered = false; tick(f, 500); assert.equal(f.s.job.progress, 20);
  f.office.channelPowered = true; tick(f, 100); assert.equal(f.s.job.progress, 20); tick(f, 40);
  assert.ok(Watch.reaffirmationCurrent(...args(f), f.c)); assert.equal(f.actor.workSeconds, work - 120);
  assert.equal(f.office.workSeconds, duty - 120); assert.equal(f.office.power, power - 2);
});
test('expired unsigned watch terms cannot be refreshed on identical answered circumstances', () => {
  const f = ready(); assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 60);
  const terms = copy(f.s.reaffirmation.terms); f.at = terms.expiresAt - 10;
  assert.ok(Watch.reaffirmSign(...args(f), terms, f.c, f.at)); tick(f, 10);
  assert.equal(f.s.job, null); assert.equal(f.s.reaffirmation.receipt, null);
  assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false);
  assert.equal(Watch.reaffirmSign(...args(f), terms, f.c, f.at), false);
  assert.equal(f.s.reaffirmation.terms.expiresAt, terms.expiresAt);
});
test('forged watch reaffirmations, scope, originals and register copies never grant an assignment', () => {
  for (const change of [f => f.s.reaffirmation.receipt.role = 'militaryDefenseCommand', f => f.s.reaffirmation.receipt.type = 'recognition',
    f => f.s.reaffirmation.receipt.recorderId = 'replacement', f => f.s.reaffirmation.receipt.originalReceiptId = 'fake',
    f => f.s.reaffirmation.receipt.findingId = f.charter.review.id, f => f.s.reaffirmation.receipt.worksReaffirmationId = 'fake',
    f => f.s.reaffirmation.receipt.bodyEpoch++, f => f.s.reaffirmation.receipt.commandRelationship.scope = 'army',
    f => f.s.reaffirmation.terms.duties = 'unlimited obedience', f => f.s.reaffirmation.response.personId = 'replacement',
    f => f.s.reaffirmation.receipt.at = f.s.reaffirmation.terms.expiresAt,
    f => f.office.records = f.office.records.filter(r => r.type !== 'watchReaffirmation')]) {
    const f = reaffirmed(ready()); change(f);
    assert.equal(Watch.authorization(...args(f), f.c), null); assert.equal(Watch.reaffirmationCurrent(...args(f), f.c), false);
    assert.equal(Watch.order(...args(f), Watch.instructionTerms(f.s), f.c, f.at), false);
  }
});
test('cancellation, changed bodies and changed evidence preserve costs and historical watch decisions', () => {
  for (const change of [f => f.c.bodyEpoch++, f => f.c.rule.text = 'Further authentic changed local rule',
    f => f.works.reaffirmation.receipt.role = 'army']) {
    const f = ready(); assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 20);
    const duty = f.office.workSeconds, work = f.actor.workSeconds, power = f.office.power, original = copy(f.s.receipt);
    change(f); tick(f, 40); assert.equal(f.s.job, null); assert.equal(f.s.reaffirmation.receipt, null);
    assert.deepEqual(f.s.receipt, original); assert.equal(f.actor.workSeconds, work); assert.equal(f.office.workSeconds, duty);
    assert.equal(f.office.power, power); assert.equal(f.actor.assignment, null); assert.equal(f.office.assignment, null);
  }
  const f = ready(); assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 20);
  const work = f.actor.workSeconds, power = f.office.power;
  assert.ok(Watch.cancel(f.s, f.succession, f.office, f.at)); assert.equal(f.actor.workSeconds, work); assert.equal(f.office.power, power);
  assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 60); const old = copy(f.s.reaffirmation);
  f.c.watchConditions = ['Actually changed independent obligation'];
  assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 60);
  assert.deepEqual(f.s.previousReaffirmations.at(-1), old); assert.equal(f.s.reaffirmation.response.decision, 'refused');
});
test('renewed watch still requires finite duty, actual geometry and exact instructions; no recovery is added', () => {
  const f = reaffirmed(ready()), terms = Watch.instructionTerms(f.s), work = f.actor.workSeconds;
  assert.equal(terms.reaffirmationId, f.s.reaffirmation.receipt.id);
  assert.equal(Watch.order(...args(f), { ...terms, duty: 'Arrest rival' }, f.c, f.at), false);
  for (const change of [f => f.c.postReachable = false, f => f.c.geometryAvailable = false,
    f => f.office.maintenanceReady = false, f => f.actor.workSeconds = Watch.SECONDS + 89, f => f.office.power = 0]) {
    const g = reaffirmed(ready()); change(g); assert.equal(Watch.order(...args(g), Watch.instructionTerms(g.s), g.c, g.at), false);
  }
  assert.ok(!f.u.staffIds.includes(f.actor.id)); assert.equal(f.u.workCaps[f.actor.id], undefined);
  assert.equal(f.actor.workSeconds, work);
  assert.ok(Watch.order(...args(f), terms, f.c, f.at)); tick(f, 30); reach(f); tick(f, 100);
  const partial = f.s.duty.progress; f.s = Watch.normalize(f.s); f.office.channelPowered = false; tick(f, 500);
  assert.equal(f.s.duty.progress, partial); f.office.channelPowered = true; tick(f); tick(f, 500);
  for (let n = 0; n < 30 && f.s.duty; n++) tick(f);
  assert.equal(f.s.duty, null); assert.equal(f.s.deliveries.length, 1); assert.equal(f.s.deliveries[0].seconds, 600);
});
test('received real renewed-watch incidents invalidate new permission without erasing reports or duplicating delivery', () => {
  const f = reaffirmed(ready()), historical = copy({ receipt: f.s.receipt, reaffirmation: f.s.reaffirmation.receipt });
  assert.ok(Watch.order(...args(f), Watch.instructionTerms(f.s), f.c, f.at)); tick(f, 30); reach(f);
  const e = event(f); assert.ok(Watch.observe(f.s, f.succession, e, perception, f.at));
  assert.equal(Watch.observe(f.s, f.succession, e, perception, f.at), null);
  assert.deepEqual(Watch.publicView(f.s).reports, []); assert.equal(Watch.receive(f.s, f.succession, f.office, f.c, f.at), false);
  assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false); tick(f, 600);
  for (let n = 0; n < 30 && f.s.duty; n++) tick(f);
  assert.ok(Watch.receive(f.s, f.succession, f.office, f.c, f.at, { communicate: r => f.c.conduct.push(r) }));
  assert.equal(Watch.authorization(...args(f), f.c), null); assert.equal(Watch.reaffirmationCurrent(...args(f), f.c), false);
  assert.deepEqual({ receipt: f.s.receipt, reaffirmation: f.s.reaffirmation.receipt }, historical);
  assert.equal(f.s.reports.length, 1); assert.equal(Watch.publicView(f.s).reports.length, 1);
  assert.equal(Watch.receive(f.s, f.succession, f.office, f.c, f.at), false);
  assert.equal(Watch.order(...args(f), Watch.instructionTerms(f.s), f.c, f.at), false);
  assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false);
});
test('old accepted safe duties and reports cannot be reset or erased by requesting new watch consent', () => {
  const f = fixture(); watch(f); reach(f); tick(f, 100); supportedCounter(f);
  const e = { ...event(f), actorId: 'other' }; assert.ok(Watch.observe(f.s, f.succession, e, perception, f.at));
  worksRenewed(adminRenewed(revised(f))); const old = copy({ duty: f.s.duty, reports: f.s.reports });
  assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false); assert.deepEqual({ duty: f.s.duty, reports: f.s.reports }, old);
  tick(f, 500); for (let n = 0; n < 30 && f.s.duty; n++) tick(f);
  assert.equal(f.s.deliveries.length, 1); assert.equal(f.s.deliveries[0].seconds, 600);
  reaffirmed(f); assert.equal(f.s.deliveries.length, 1); assert.equal(f.s.reports[0].communicatedAt, null);
  assert.ok(Watch.receive(f.s, f.succession, f.office, f.c, f.at)); assert.equal(f.s.reports.length, 1);
});
test('death freezes watch reaffirmation and public projections never disclose private snapshots', () => {
  const f = ready(); assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 20);
  f.c.alive = false; const frozen = copy({ s: f.s, actor: f.actor, office: f.office }); tick(f, 2000);
  assert.deepEqual({ s: f.s, actor: f.actor, office: f.office }, frozen);
  const g = reaffirmed(ready()), view = Watch.publicView(g.s);
  assert.equal(view.reaffirmation.receipt.originalReceiptId, g.s.receipt.id);
  assert.equal(view.reaffirmation.terms.evidence, undefined); assert.equal(view.reaffirmation.terms.conditions, undefined);
  assert.doesNotMatch(JSON.stringify(view), /watchPolicy|workSeconds|"evidence"|"conditions"/);
});
test('further genuine reconsideration requires all separate new consents and retains earlier watch receipt and original installation', () => {
  const f = reaffirmed(ready()), original = copy(f.s.receipt), earlier = copy(f.s.reaffirmation), upkeep = copy(f.u);
  supplyBattery(f); f.c.rule.text = 'Second genuinely received clarification';
  assert.equal(Watch.authorization(...args(f), f.c), null); assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false);
  revised(f, 'second'); assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false);
  adminRenewed(f); assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false);
  worksRenewed(f); reaffirmed(f);
  assert.deepEqual(f.s.receipt, original); assert.deepEqual(f.s.previousReaffirmations, [earlier]);
  assert.deepEqual(f.u.installation, upkeep.installation); assert.equal(f.u.dueAt, upkeep.dueAt); assert.equal(f.u.graceUntil, upkeep.graceUntil);
  assert.equal(f.office.records.filter(r => r.type === 'watchReaffirmation').length, 2);
  assert.ok(Watch.authorization(...args(f), f.c)); assert.equal(Watch.reaffirmMeeting(...args(f), f.c, f.at), false);
});
test('further facts interrupt renewed signing or instruction without creating a receipt, assignment or refund', () => {
  for (const kind of ['signing', 'instruction']) {
    const f = ready();
    if (kind === 'signing') {
      assert.ok(Watch.reaffirmMeeting(...args(f), f.c, f.at)); tick(f, 60);
      assert.ok(Watch.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at));
    } else { reaffirmed(f); assert.ok(Watch.order(...args(f), Watch.instructionTerms(f.s), f.c, f.at)); }
    tick(f, 20); const duty = f.office.workSeconds, work = f.actor.workSeconds, power = f.office.power;
    const old = copy(f.s.reaffirmation.receipt); f.c.rule.text = 'Authentic further received rule'; tick(f, 40);
    assert.equal(f.s.job, null); assert.equal(f.s.duty, null); assert.equal(f.actor.assignment, null);
    assert.equal(f.actor.workSeconds, work); assert.equal(f.office.workSeconds, duty); assert.equal(f.office.power, power);
    assert.deepEqual(f.s.reaffirmation.receipt, old); assert.equal(Watch.authorization(...args(f), f.c), null);
  }
});
