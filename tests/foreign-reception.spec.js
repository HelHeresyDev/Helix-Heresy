const { test, expect } = require('@playwright/test');
const Visitor = require('../foreign-reception');
const Approach = require('../city-approach');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const { pathToFileURL } = require('url');
const path = require('path');
test.use({ actionTimeout: 15000 });
const copy = v => JSON.parse(JSON.stringify(v));
const source = () => ({ cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', administrationId: 'admin:b',
  administrationName: 'Neighbor Civic Administration', watchId: 'watch:b', currentAuthority: true, capacityBand: 'functional',
  lawId: 'law:b', recognition: 'verified', localRules: [{ offenseId: 'geneticEngineering', legalStatus: 'prohibited', summary: 'Genetic engineering requires separate authority.' }] });
function identityFixture() {
  const market = { homeId: 'a' }; Registry.provision(market, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const identity = Civic.create(), office = market.identityOffices[0];
  const ctx = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  expect(Civic.begin(identity, office, Civic.preview(identity, office, 'Mira Vale'), { money: 100 }, ctx, -1800)).toBe(true);
  Civic.advance(identity, market.identityOffices, ctx, 0);
  return { identity, offices: market.identityOffices };
}
function fixture() {
  const g = Approach.gate({ id: 'reception:b', cityId: 'b', institutionId: 'admin:b', capacityBand: 'functional', createdAt: 0,
    clerk: { id: 'original-clerk', name: 'Mira Clerk', status: 'alive', health: 100, mapCell: { x: 10, y: 6 } },
    guard: { id: 'original-guard', name: 'Gate Guard', status: 'alive', health: 100, mapCell: { x: 12, y: 7 } } });
  Visitor.publish(g, source(), 0);
  const { identity, offices } = identityFixture(), issuer = offices[0], document = identity.documents[0];
  const c = { alive: true, capable: true, local: true, atDesk: true, clerkPresent: true, lineOfSight: true, cityId: 'b',
    bodyEpoch: 0, visitId: 'actual-road-trip', description: identity.description, authorityCurrent: true, otherBusy: false, bans: [],
    evidence: { present: true, sourceRecordId: document.number, document, comparison: Civic.compare(issuer, document, identity.description, 2000), connection: true, recognition: 'verified' } };
  return { g, issuer, c, wallet: { money: 500 }, at: 2000 };
}
function start(f) { return Visitor.begin(f.g, f.issuer, Visitor.quote(f.g, f.c), f.c, f.wallet, f.at); }
function review(f) { expect(start(f)).toBe(true); Visitor.advance(f.g, f.issuer, f.c, f.at + 180); }
test('published visitor authority is population-backed, city-local and never changes canonical sources', () => {
  const f = fixture(), raw = source(), frozen = JSON.stringify(raw), g = copy(f.g); delete g.visitorAdmission;
  expect(Visitor.publish(g, raw, 0)).not.toBeNull(); expect(JSON.stringify(raw)).toBe(frozen);
  for (const change of [{ currentPopulation: 0 }, { physicalCondition: 'ruined' }, { administrationId: 'foreign-admin' }, { lawId: null }, { currentAuthority: false }]) {
    const gate = copy(g); delete gate.visitorAdmission;
    expect(Visitor.publish(gate, { ...raw, ...change }, 0)).toBeNull();
  }
  g.receptionWorkSeconds = 1; Visitor.publish(g, raw, 3000); expect(g.receptionWorkSeconds).toBe(1);
});
test('exact processing fee, shared finite source verification and separate acceptance issue one narrow permit', () => {
  const f = fixture(), work = f.issuer.workSeconds, power = f.issuer.power;
  const q = Visitor.quote(f.g, f.c); expect(q).toMatchObject({ fee: 40, reviewSeconds: 180, acceptanceSeconds: 60, visitSeconds: 21600 });
  expect(Visitor.begin(f.g, f.issuer, { ...q, fee: 0 }, f.c, f.wallet, f.at)).toBe(false);
  review(f); expect(f.wallet.money).toBe(460); expect(f.issuer.power).toBe(power - 1); expect(f.issuer.workSeconds).toBe(work - 180);
  expect(f.g.visitorAdmission.decisions[0]).toMatchObject({ status: 'admitted', identityVerified: true, scope: 'visitorHallOnly' });
  expect(Visitor.permission(f.g, 0, f.c.visitId, 2200)).toBeNull();
  const o = copy(f.g.visitorAdmission.offers[0]); expect(Visitor.accept(f.g, { ...o, visitSeconds: 99999 }, f.c, 2200)).toBe(false);
  expect(Visitor.accept(f.g, o, f.c, 2200)).toBe(true); Visitor.advance(f.g, f.issuer, f.c, 2260);
  const p = Visitor.permission(f.g, 0, f.c.visitId, 2260); expect(p).toMatchObject({ issuedAt: 2260, expiresAt: 23860, scope: 'visitorHallOnly' });
  expect(f.g.receptionWorkSeconds).toBe(14400 - 240); expect(f.g.powerSeconds).toBe(86400 - 240);
  expect(Visitor.accept(f.g, o, f.c, 2260)).toBe(false); Visitor.advance(f.g, f.issuer, f.c, 2300); expect(f.g.visitorAdmission.permits).toHaveLength(1);
});
test('missing identity, case review, directional refusal and applicable exclusion stay stable without criminal guilt', () => {
  for (const kind of ['missing', 'caseReview', 'refused', 'domesticBan', 'foreignNotice']) {
    const f = fixture();
    if (kind === 'missing') f.c.evidence = { present: false, connection: false, sourceRecordId: null };
    if (['caseReview', 'refused'].includes(kind)) f.c.evidence.recognition = kind;
    if (kind === 'domesticBan') f.c.bans = [{ personId: 'scientist', status: 'active', cityId: 'b', orderId: 'local-order' }];
    if (kind === 'foreignNotice') f.c.bans = [{ personId: 'scientist', status: 'active', cityId: 'a', orderId: 'foreign-notice', recognizedBy: [{ cityId: 'b' }] }];
    review(f); const s = f.g.visitorAdmission;
    expect(s.decisions[0].status).toBe(kind === 'foreignNotice' ? 'admitted' : ['missing', 'caseReview'].includes(kind) ? 'pending' : 'refused');
    expect(s).not.toHaveProperty('custody'); expect(s).not.toHaveProperty('guilt');
    if (kind !== 'foreignNotice') { expect(start(f)).toBe(false); expect(s.decisions).toHaveLength(1); expect(f.wallet.money).toBe(460); }
  }
});
test('staff outages, finite issuer work and absence pause original attendance without backfill across reload', () => {
  let f = fixture(); expect(start(f)).toBe(true); Visitor.advance(f.g, f.issuer, f.c, 2060);
  f.issuer.channelPowered = false; f.c.evidence.connection = false; Visitor.advance(f.g, f.issuer, f.c, 2100);
  expect(f.g.visitorAdmission.job.progress).toBe(60); expect(f.issuer.assignment).toBeNull();
  f = copy(f); f.issuer.channelPowered = true; f.c.evidence.connection = true;
  Visitor.advance(f.g, f.issuer, f.c, 9000); expect(f.g.visitorAdmission.job.progress).toBe(60);
  f.c.atDesk = false; Visitor.advance(f.g, f.issuer, f.c, 9030); f.c.atDesk = true; Visitor.advance(f.g, f.issuer, f.c, 9500);
  Visitor.advance(f.g, f.issuer, f.c, 9620); expect(f.g.visitorAdmission.job).toBeNull(); expect(f.g.visitorAdmission.decisions).toHaveLength(1);
  expect(f.wallet.money).toBe(460); expect(f.g.receptionWorkSeconds).toBe(14220);
});
test('restored verification is genuinely changed evidence, not a free reroll of pending records', () => {
  const f = fixture(); f.c.evidence.connection = false; review(f);
  expect(f.g.visitorAdmission.decisions[0].status).toBe('pending');
  expect(start(f)).toBe(false); expect(f.wallet.money).toBe(460);
  f.c.evidence.connection = true; f.at = 2300; review(f);
  expect(f.g.visitorAdmission.decisions.map(d => d.status)).toEqual(['pending', 'admitted']); expect(f.wallet.money).toBe(420);
});
test('original staff, shared queue, money, power and body changes prevent unsupported work; cancellation retains costs', () => {
  for (const failure of ['staff', 'power', 'work', 'queue', 'issuerQueue', 'money', 'away', 'busy']) {
    const f = fixture();
    if (failure === 'staff') f.g.clerk.health = 0;
    if (failure === 'power') f.g.powerSeconds = 0;
    if (failure === 'work') f.g.receptionWorkSeconds = 0;
    if (failure === 'queue') f.g.receptionAssignment = 'another-person';
    if (failure === 'issuerQueue') f.issuer.assignment = 'driver-registration';
    if (failure === 'money') f.wallet.money = 0;
    if (failure === 'away') f.c.atDesk = false;
    if (failure === 'busy') f.c.otherBusy = true;
    expect(start(f), failure).toBe(false); expect(f.g.visitorAdmission.decisions).toEqual([]);
  }
  const f = fixture(); start(f); Visitor.advance(f.g, f.issuer, f.c, 2060); expect(Visitor.cancel(f.g, f.issuer, 2060)).toBe(true);
  expect(f.wallet.money).toBe(460); expect(f.g.receptionWorkSeconds).toBe(14340); expect(f.issuer.assignment).toBeNull();
  const h = fixture(); start(h); h.c.bodyEpoch++; Visitor.advance(h.g, h.issuer, h.c, 2060); expect(h.g.visitorAdmission.job).toBeNull(); expect(h.g.visitorAdmission.offers).toEqual([]);
});
test('absolute offer and permit expiry, truthful dated records, dead-body freezing and new-body exclusion', () => {
  const f = fixture(); review(f); const o = copy(f.g.visitorAdmission.offers[0]);
  expect(Visitor.accept(f.g, o, f.c, o.expiresAt)).toBe(false);
  expect(Visitor.accept(f.g, o, f.c, 2200)).toBe(true); Visitor.advance(f.g, f.issuer, f.c, 2260);
  Visitor.observe(f.g, f.c, 2260); const known = copy(f.g.visitorAdmission.knowledge);
  f.c.atDesk = false; Visitor.advance(f.g, f.issuer, f.c, 22960); expect(f.g.visitorAdmission.permits[0].warned).toBe(true);
  expect(Visitor.observe(f.g, f.c, 23000)).toEqual(known); expect(Visitor.permission(f.g, 0, f.c.visitId, 23860)).toBeNull();
  expect(Visitor.permission(f.g, 1, f.c.visitId, 23000)).toBeNull(); expect(Visitor.permission(f.g, 0, 'new-trip', 23000)).toBeNull();
  f.c.alive = false; const frozen = JSON.stringify(f.g); Visitor.advance(f.g, f.issuer, f.c, 100000); expect(JSON.stringify(f.g)).toBe(frozen);
  expect(JSON.stringify(known)).not.toContain('grounds'); expect(JSON.stringify(known)).not.toContain('bodyEpoch'); expect(JSON.stringify(known)).not.toContain('facts');
});
test('coarse attendance dates actual completion and cannot extend a nearly expired unsigned offer', () => {
  const f = fixture(); start(f); Visitor.advance(f.g, f.issuer, f.c, 2400);
  expect(f.g.visitorAdmission.decisions[0].at).toBe(2180);
  const o = copy(f.g.visitorAdmission.offers[0]);
  expect(Visitor.accept(f.g, o, f.c, o.expiresAt - 100)).toBe(true);
  Visitor.advance(f.g, f.issuer, f.c, o.expiresAt + 100);
  expect(f.g.visitorAdmission.permits[0].issuedAt).toBe(o.expiresAt - 40);
  const h = fixture(); review(h); const offer = copy(h.g.visitorAdmission.offers[0]);
  expect(Visitor.accept(h.g, offer, h.c, offer.expiresAt - 30)).toBe(true);
  Visitor.advance(h.g, h.issuer, h.c, offer.expiresAt + 100);
  expect(h.g.visitorAdmission.permits).toEqual([]); expect(h.g.receptionWorkSeconds).toBe(14400 - 180 - 30);
});

const passengerCity = () => ({ cityId: 'a', assetId: 'city:a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } });
const standings = () => [{ network: { id: 'transport:a', category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Passenger Depot', capacityBand: 'functional', operationalStatus: 'active' } }];
const network = () => ({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
  ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] });
async function finishWork(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 8; i++) { const s = d.intercityPassengerSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return; d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1)); }
    throw new Error('Physical work did not finish');
  });
}
async function showVisits(page) {
  if (!await page.locator('[data-intercity-passenger]').isVisible()) await page.locator('[data-workspace-tab="visits"]').click();
}
async function arrive(page, renderer, withIdentity = true, recognition = 'verified') {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  const f = identityFixture();
  await page.evaluate(({ city, network, standings, source, identity, offices, renderer }) => {
    const d = window.helixHeresyDebug; d.setIntercityPassengerTestContext({ city, network, standings }); d.setMapRenderer(renderer);
    d.setForeignReceptionTestContext({ source, identity, offices });
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Unable to board prepared source');
  }, { city: passengerCity(), network: network(), standings: standings(), source: { ...source(), recognition },
    identity: withIdentity ? f.identity : Civic.create(), offices: f.offices, renderer });
  await finishWork(page); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finishWork(page);
}
for (const renderer of ['dom', 'canvas']) test(`road arrival, scoped verification, attended acceptance, real gate passage and return through ${renderer}`, async ({ page }) => {
  test.setTimeout(300000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await arrive(page, renderer);
  const snap = () => page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot());
  const initial = await snap(); expect(initial.permission).toBeNull(); expect(initial.roomId).toBe('passenger-outer-b');
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignReceptionSnapshot(); return d.startScientistMove(s.gate.annexRoomId, { toCell: { x: 15, y: 7, z: s.gate.z }, allowMultiRoom: true }); })).toBeFalsy();
  await showVisits(page);
  await page.getByRole('button', { name: 'Walk to Foreign Reception Desk', exact: true }).click(); await finishWork(page);
  expect((await snap()).context.atDesk).toBe(true);
  await showVisits(page);
  await page.getByRole('button', { name: 'Pay $40 for Visitor Review and Scoped Identity Verification', exact: true }).click();
  expect((await snap()).money).toBe(initial.money - 40);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  expect((await snap()).gate.visitorAdmission.job.progress).toBeGreaterThan(0);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(180));
  const reviewed = await snap(); expect(reviewed.gate.visitorAdmission.decisions).toHaveLength(1); expect(reviewed.gate.visitorAdmission.decisions[0].status).toBe('admitted'); expect(reviewed.permission).toBeNull();
  await showVisits(page);
  await page.getByRole('button', { name: 'Accept Exact Six-Hour Visitor-Hall Terms', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  const accepted = await snap(); expect(accepted.permission).not.toBeNull(); expect(accepted.roomId).toBe(initial.roomId);
  await page.getByRole('button', { name: 'Walk Through Gate to Visitor Hall', exact: true }).click(); await finishWork(page);
  const inside = await snap(); expect(inside.roomId).toBe(inside.gate.annexRoomId); expect(inside.gate.clerk.id).toBe(initial.gate.clerk.id);
  await showVisits(page);
  await expect(page.locator('[data-foreign-reception]')).toContainText('Neighbor Civic Administration');
  await expect(page.locator('[data-foreign-reception]')).toContainText('geneticEngineering: prohibited');
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(false);
  if (renderer === 'dom') {
    await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignReceptionSnapshot(); d.advanceForeignReceptionTestTime(s.permission.expiresAt - s.clock); });
    const expired = await snap(); expect(expired.permission).toBeNull(); expect(expired.roomId).toBe(inside.roomId);
    expect(expired.gate.visitorAdmission.permits[0].warned).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('enter'))).toBe(false);
    await expect(page.locator('[data-foreign-reception]')).toContainText('Permission expired');
  }
  await page.getByRole('button', { name: 'Walk Back to Outer Passenger Stand', exact: true }).click(); await finishWork(page);
  expect((await snap()).roomId).toBe(initial.roomId);
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finishWork(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finishWork(page);
  const home = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot()); expect(home.roomId).toBe('supportedSurveyGround');
  expect(home.money).toBe(5000 - 216 - 40); expect(errors).toEqual([]);
});
test('undocumented visitor stays playable outside, cannot reroll fees and can return without admission', async ({ page }) => {
  test.setTimeout(240000); await arrive(page, 'dom', false);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finishWork(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(180));
  const before = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot());
  expect(before.gate.visitorAdmission.decisions[0].status).toBe('pending'); expect(before.permission).toBeNull();
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(false);
  expect((await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot())).money).toBe(before.money);
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
});
