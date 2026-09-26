const { test, expect } = require('@playwright/test');
const Investigations = require('../cargo-investigations');
const Referrals = require('../cargo-criminal-referrals');
const Review = require('../cargo-property-review');
const Gates = require('../smuggling-checkpoints');
const Market = require('../intercity-smuggling');
const Laws = require('../strategic-city-laws');
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture() {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Gates.bind(state, [{ cityId: 'b', cellId: 'b', institutionId: 'watch', jurisdiction: 'city' }]);
  const gate = state.checkpoints[0]; Review.publish(gate, { legalStatus: 'restricted' }, { institutionId: 'court' }, 0);
  Referrals.provision(gate, { id: 'criminal-commerce', offenseId: 'contrabandCommerce', legalStatus: 'prohibited', elements: Laws.OFFENSE_CATALOG.find(o => o.id === 'contrabandCommerce').elements }, { institutionId: 'prosecution' }, 0);
  const manifest = { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ amount: 1, stack: { id: 'lot', section: 'chemicalBatches', quantity: 1, knownQuantity: 1,
    chemicalBatch: { id: 'batch', phase: 'liquid', productId: 'unlicensedMutagenicPrimer', purity: 90, label: 'Unlicensed Mutagenic Primer', packaging: { state: 'packaged' } } } }] };
  const request = { manifest, value: 800, cargo: { massKg: 1, volumeL: 1 }, localDistanceKm: 8 };


  return { state, gate, request, manifest, op: state.operators[0], advance: at => Market.advance(state, at, [route]), referral: () => gate.criminalIntake.referrals[0] };
}

const Identity = require('../carrier-identity');
function setup() {
  const f = fixture(); Identity.provision(f.state, { institutionId: 'registry:a', cityId: 'a', name: 'Home Registry', active: true, localDistanceKm: 2 }, 0);
  f.office = f.state.identityOffices[0]; f.driver = f.op.crew[0]; return f;
}
function register(f) {
  expect(Identity.request(f.state, f.op, Identity.preview(f.state, f.op), 0)).toBe(true); f.advance(2520);
  expect(f.op.identityTrip).toBeNull(); expect(f.driver.civicDocument).toBeTruthy();
}
function ship(f, at = 2600) {
  const quote = Market.offer(f.state, f.op.id, f.request, route, at);
  f.sh = Market.book(f.state, quote, f.request, route, 'private-contract', at).shipment;
  Market.markCollected(f.state, f.sh.id, f.manifest, 'collector', at); Market.receiveDepot(f.state, f.sh.id, f.manifest, at); f.advance(at);
}
function finished(f) { ship(f); f.advance(100000); f.advance(106000); return f; }
test('registration requires an actual local office and creates no historical identity automatically', () => {
  const f = fixture();
  for (const office of [null, { institutionId: 'foreign', cityId: 'b', active: true, localDistanceKm: 2 }, { institutionId: 'no-route', cityId: 'a', active: true }]) Identity.provision(f.state, office, 0);
  expect(f.state.identityOffices).toBeUndefined(); expect(Identity.preview(f.state, f.op)).toBeNull();
  f.advance(10000); expect(f.op.crew[0].civicDocument).toBeUndefined();
});
test('preview sends nothing; carrier funds a real outward visit, clerk time and return without cargo duplication', () => {
  const f = setup(), p = Identity.preview(f.state, f.op), before = { money: f.op.money, fuel: f.op.fuelKm };
  expect(f.office.records).toEqual([]); expect(f.op.identityTrip).toBeUndefined();
  expect(Identity.request(f.state, f.op, p, 0)).toBe(true); f.advance(180);
  expect(f.op.identityTrip.positionKm).toBe(1); expect(f.driver.civicDocument).toBeUndefined();
  expect(Market.offer(f.state, f.op.id, f.request, route, 180).ok).toBe(false);
  f.advance(360); expect(f.op.location).toBe(f.office.id); f.advance(2160);
  expect(f.driver.civicDocument.issuedAt).toBe(2160); expect(f.op.identityTrip.phase).toBe('returning');
  f.advance(2520); expect(f.op.location).toBe('a'); expect(f.op.identityTrip).toBeNull();
  expect(f.op.fuelKm).toBe(before.fuel - 4); expect(f.op.money + f.office.money).toBe(before.money);
  expect(f.office).toMatchObject({ power: 11, workSeconds: 12600, money: 20 });
  expect(f.state.shipments).toEqual([]); expect(f.office.records[0].document).not.toHaveProperty('driverId');
});
test('driver refusal and changed previews cannot be overridden; poor resources cannot start a trip', () => {
  for (const failure of ['consent', 'fee', 'fuel', 'money', 'health', 'route', 'busy', 'officePower', 'officeWork']) {
    const f = setup(), p = Identity.preview(f.state, f.op);
    if (failure === 'consent') f.driver.civicPreferences.registrationConsent = false;
    if (failure === 'fee') f.office.fee++;
    if (failure === 'fuel') f.op.fuelKm = 0;
    if (failure === 'money') f.op.money = 0;
    if (failure === 'health') f.driver.health = 0;
    if (failure === 'route') f.office.route.open = false;
    if (failure === 'busy') f.op.assignment = 'other-trip';
    if (failure === 'officePower') f.office.power = 0;
    if (failure === 'officeWork') f.office.workSeconds = 0;
    expect(Identity.request(f.state, f.op, p, 0)).toBe(false); expect(f.office.records).toEqual([]);
  }
});
test('closed routes and disabled registries pause physical work without teleportation, rerolls or repeat fees', () => {
  const f = setup(); expect(Identity.request(f.state, f.op, Identity.preview(f.state, f.op), 0)).toBe(true);
  f.advance(900); const progress = f.op.identityTrip.progress;
  f.office.channelPowered = false; f.advance(1000); expect(f.office.assignment).toBeNull();
  f.office.channelPowered = true; f.advance(10000); expect(f.op.identityTrip.progress).toBe(progress);
  const saved = JSON.parse(JSON.stringify(f.state)); f.advance(12000); Market.advance(saved, 12000, [route]); expect(saved).toEqual(f.state);
  expect(f.office.money).toBe(20); expect(f.office.records).toHaveLength(1);
  const g = setup(); Identity.request(g.state, g.op, Identity.preview(g.state, g.op), 0); g.advance(180);
  g.office.route.open = false; g.advance(2000); expect(g.op.identityTrip.positionKm).toBe(1);
});
test('valid document plus bounded appearance match identifies only the observed gate presenter', () => {
  const f = setup(); register(f); finished(f);
  const check = f.sh.inspection.identityChecks[0], result = f.referral().investigation.assessments.at(-1);
  expect(check).toMatchObject({ result: 'supported', issuerResult: 'confirmed', appearance: 'consistent' });
  expect(result.actors.find(a => a.role === 'observed cargo presenter').identity).toContain('Registered identity:');
  expect(result.actors.every(a => a.knowledge === 'not established')).toBe(true);
  expect(result.elements.filter(e => ['transaction', 'knowledge'].includes(e.id)).every(e => !e.support.length)).toBe(true);
  expect(check.presentedAt).toBeGreaterThan(f.driver.civicDocument.issuedAt);
  expect(JSON.stringify(f.referral().revisions)).not.toContain(f.driver.id);
  expect(check.sourceGroups).toHaveLength(2); expect(check.limit).toContain('not certain identity');
});
test('issuer confirmation and physical match remain independent with ambiguous and wrong-person outcomes', () => {
  for (const appearance of ['mismatch', 'ambiguous']) {
    const f = setup(); register(f);
    if (appearance === 'mismatch') f.driver.appearance.face = 'different face'; else f.gate.identityVisibility = 'obscured';
    finished(f); const c = f.sh.inspection.identityChecks[0];
    expect(c.issuerResult).toBe('confirmed'); expect(c.appearance).toBe(appearance); expect(c.result).toBe(appearance);
    expect(f.referral().investigation.assessments.at(-1).actors[0].identity).toBe('unverified');
  }
});
test('altered, expired, revoked and unknown documents cannot establish identity', () => {
  for (const failure of ['altered', 'expired', 'revoked', 'unknown']) {
    const f = setup(); register(f);
    if (failure === 'altered') f.driver.civicDocument.registeredName = 'Someone else';
    if (failure === 'expired') { f.driver.civicDocument.expiresAt = 2600; f.office.records[0].document.expiresAt = 2600; }
    if (failure === 'revoked') f.office.records[0].status = 'revoked';
    if (failure === 'unknown') f.driver.civicDocument.number = 'unknown-document';
    finished(f); expect(f.sh.inspection.identityChecks[0].result).not.toBe('supported');
  }
});
test('presentation and verification require independent driver consent; refusal never lengthens detention', () => {
  const baseline = setup(); finished(baseline);
  for (const preference of ['presentationConsent', 'verificationConsent']) {
    const f = setup(); register(f); f.driver.civicPreferences[preference] = false; finished(f);
    if (preference === 'presentationConsent') { expect(f.sh.inspection.identityPresentation.result).toBe('notPresented'); expect(f.sh.inspection.identityChecks).toBeUndefined(); }
    else expect(f.sh.inspection.identityChecks[0].issuerResult).toBe('notConsented');
    expect(f.sh.inspection.releasedAt).toBe(baseline.sh.inspection.releasedAt); expect(f.sh.inspection.crewDetained).toBe(false);
  }
});
test('unavailable registry, staff and finite verification resources cannot hold cargo or invent evidence', () => {
  const baseline = setup(); finished(baseline);
  for (const failure of ['channel', 'clerk', 'power', 'work', 'assignment']) {
    const f = setup(); register(f);
    if (failure === 'channel') f.office.channelPowered = false;
    if (failure === 'clerk') f.office.clerk.health = 0;
    if (failure === 'power') f.office.power = 0;
    if (failure === 'work') f.office.workSeconds = 0;
    if (failure === 'assignment') f.office.assignment = 'other-work';
    finished(f); expect(f.sh.inspection.identityChecks[0].result).toBe('unavailable');
    expect(f.sh.inspection.releasedAt).toBe(baseline.sh.inspection.releasedAt);
  }
});
test('later checks cannot attach a new document to an old anonymous presentation', () => {
  const f = setup(); finished(f); const r = JSON.stringify(f.referral().revisions);
  f.driver.civicDocument = { number: 'later-document' };
  expect(Identity.recheck(f.state, f.sh, 106000)).toBe(false); f.advance(120000);
  expect(JSON.stringify(f.referral().revisions)).toBe(r);
});
test('source withdrawal appends a correction and withdraws the identity link without deleting earlier evidence or changing property', () => {
  const f = setup(); register(f); finished(f);
  const first = JSON.stringify(f.sh.inspection.identityChecks[0]), property = JSON.stringify(f.sh.propertyOrder), i = f.referral().investigation;
  expect(i.assessments.at(-1).actors[0].identity).toContain('Registered identity');
  f.office.records[0].status = 'withdrawn';
  expect(Identity.recheck(f.state, f.sh, 106000)).toBe(true); f.advance(106600); f.advance(108400); f.advance(110200);
  expect(f.sh.inspection.identityChecks[1]).toMatchObject({ result: 'mismatch', issuerResult: 'withdrawn', supersedes: f.sh.inspection.identityChecks[0].id });
  expect(JSON.stringify(f.sh.inspection.identityChecks[0])).toBe(first); expect(JSON.stringify(f.sh.propertyOrder)).toBe(property);
  expect(i.assessments.at(-1).actors[0].identity).toContain('withdrawn');
  expect(i.assessments[0].actors[0].identity).toContain('Registered identity');
});
test('verification progress, consent and resource allocations persist across reload without duplicate findings', () => {
  const f = setup(); register(f); ship(f); f.advance(6500);
  const saved = JSON.parse(JSON.stringify(f.state)); f.advance(106000); Market.advance(saved, 106000, [route]); expect(saved).toEqual(f.state);
  expect(f.sh.inspection.identityChecks).toHaveLength(1); expect(f.office.power).toBe(10);
  expect(f.gate.identityDesk).toMatchObject({ power: 5, workSeconds: 6600 });
});
test('incapacitated visiting driver releases the clerk without teleporting or inventing registration', () => {
  const f = setup(); Identity.request(f.state, f.op, Identity.preview(f.state, f.op), 0); f.advance(900);
  expect(f.office.assignment).toBeTruthy(); f.driver.health = 0; f.advance(2000);
  expect(f.office.assignment).toBeNull(); expect(f.op.location).toBe(f.office.id); expect(f.driver.civicDocument).toBeUndefined();
});
test('a recheck cannot double-book the gate officer or turn a later expiry into past invalidity', () => {
  const f = setup(); register(f); finished(f);
  const original = f.sh.inspection.identityChecks[0];
  f.gate.identityDesk.assignment = 'other-query';
  expect(Identity.recheck(f.state, f.sh, 106000)).toBe(true); f.advance(107800);
  expect(f.sh.inspection.identityChecks.at(-1).issuerResult).toBe('unavailable'); expect(f.gate.identityDesk.power).toBe(5);
  f.gate.identityDesk.assignment = null;
  const afterExpiry = f.driver.civicDocument.expiresAt + 1;
  expect(Identity.recheck(f.state, f.sh, afterExpiry)).toBe(true); f.advance(afterExpiry + 600);
  expect(f.sh.inspection.identityChecks.at(-1)).toMatchObject({ result: 'supported', presentedAt: original.presentedAt });
});
