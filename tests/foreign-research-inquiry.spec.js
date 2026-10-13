const { test, expect } = require('@playwright/test');
const Inquiry = require('../foreign-research-inquiry');
const Visitor = require('../foreign-reception');
const Approach = require('../city-approach');
const Lodging = require('../foreign-lodging');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const { pathToFileURL } = require('url');
const path = require('path');
const copy = x => JSON.parse(JSON.stringify(x));
test.use({ actionTimeout: 15000 });
function rule(topic, status = 'restricted') {
  return { id: `law:b:${topic}`, offenseId: topic, legalStatus: status,
    authorizationExceptions: ['Only a named chartered institution or expressly approved emergency may authorize this conduct.'],
    elements: [{ id: 'conduct', kind: 'conduct', label: 'The accused actually performed the regulated conduct.' }], culpability: 'knowing',
    defenses: ['lawfulLicense'], aggravatingFactors: ['weaponization'], responsibleInstitutionIds: ['court:b', 'watch:b'],
    sentencing: { ordinarySanctions: ['fine', 'finitePrison'], fineRangeCredits: { minimum: 300, maximum: 3000 },
      finitePrisonRangeMonths: { minimum: 3, maximum: 36 }, penalLegionEligible: true,
      capitalEligibility: topic === 'animancy' ? { requiresProvenTrigger: true, triggers: ['soulDestruction'], withoutPublicEnemy: 'penalFlight', withPublicEnemy: 'publicBeheading' } : null,
      hiddenAllocation: 'secret-sentence-allocation' }, hiddenEnforcement: 'secret-police-plan' };
}
function source() {
  const administration = { id: 'admin:b', branches: [{ id: 'admin:b:branch:central-administration:public-records', role: 'centralAdministration', title: 'Public-records' }] };
  return { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', administrationId: 'admin:b', administrationName: 'Neighbor Civic Administration',
    watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, capacityBand: 'functional', recognition: 'verified', localRules: [],
    researchRecords: Inquiry.recordsFrom(administration, { id: 'law:b', offenseRules: Object.keys(Inquiry.TOPICS).map(t => rule(t, t === 'geneticEngineering' ? 'licensed' : 'restricted')) }) };
}
function fixture() {
  const g = Approach.gate({ id: 'reception:b', cityId: 'b', institutionId: 'admin:b', createdAt: 0, capacityBand: 'functional',
    clerk: { id: 'original-clerk', name: 'Original Clerk', status: 'alive', health: 100, mapCell: { x: 10, y: 6 } },
    guard: { id: 'original-guard', status: 'alive', health: 100, mapCell: { x: 12, y: 7 } } });
  Visitor.publish(g, source(), 0); g.materialized = true; Inquiry.publish(g, 0);
  const c = { alive: true, capable: true, originalBody: true, custodyActive: false, local: true, atDesk: true, clerkPresent: true,
    lineOfSight: true, cityId: 'b', bodyEpoch: 0, visitId: 'visit', authorityCurrent: true, otherBusy: false, source: source(),
    visitorPermit: { id: 'original-permit', cityId: 'b', bodyEpoch: 0, visitId: 'visit', issuedAt: 0, expiresAt: 21600, scope: 'visitorHallOnly' } };
  return { g, c };
}
function begin(f, topic = 'geneticEngineering', at = 100) { return Inquiry.begin(f.g, f.c, Inquiry.quote(f.g, f.c, topic, at), at); }
test('research inquiry sources actual public-records branches and redacts nested private facts without mutating law', () => {
  const law = { id: 'law:b', offenseRules: [rule('animancy'), { id: 'other', offenseId: 'theft', legalStatus: 'prohibited' }], secret: 'private-archive' }, before = copy(law);
  const administration = { id: 'admin:b', branches: [{ id: 'admin:b:branch:central-administration:public-records', role: 'centralAdministration' }] };
  const records = Inquiry.recordsFrom(administration, law); expect(records.rules).toHaveLength(1); expect(law).toEqual(before);
  expect(JSON.stringify(records)).not.toMatch(/secret|private-archive|theft/); expect(records.rules[0].sentencing.capitalEligibility.withPublicEnemy).toBe('publicBeheading');
  expect(Inquiry.recordsFrom({ ...administration, branches: [] }, law)).toBeNull();
  expect(Inquiry.recordsFrom({ ...administration, branches: [{ ...administration.branches[0], role: 'civilWatch' }] }, law)).toBeNull();
  expect(Inquiry.recordsFrom(administration, { id: 'law:b' })).toBeNull();
  const malformed = rule('animancy'); malformed.elements = { hidden: 'secret-elements' }; malformed.sentencing.capitalEligibility.withPublicEnemy = { hidden: 'secret-capital-detail' };
  expect(JSON.stringify(Inquiry.publicRule(malformed))).not.toContain('secret');
  const f = fixture(), raw = copy(f.c.source), people = copy([f.g.clerk, f.g.guard]);
  Inquiry.publish(f.g, 500); expect(f.c.source).toEqual(raw); expect([f.g.clerk, f.g.guard]).toEqual(people); expect(f.g.researchInquiry).not.toHaveProperty('staff');
  const g = copy(f.g); delete g.researchInquiry; g.materialized = false; expect(Inquiry.publish(g, 1)).toBeNull();
});
test('research inquiry requires original visitor body, precise mandate, actual desk, permission and shared finite queue', () => {
  for (const change of [f => f.c.alive = false, f => f.c.capable = false, f => f.c.originalBody = false, f => f.c.custodyActive = true,
    f => f.c.local = false, f => f.c.atDesk = false, f => f.c.clerkPresent = false, f => f.c.lineOfSight = false,
    f => f.c.cityId = 'a', f => f.c.authorityCurrent = false, f => f.c.otherBusy = true, f => f.c.visitorPermit = null,
    f => f.c.bans = [{ status: 'active', cityId: 'b' }],
    f => f.c.bans = [{ status: 'active', cityId: 'a', recognizedBy: [{ cityId: 'b', status: 'active', localOrderId: 'b-order', institutionId: 'b-court' }] }],
    f => f.c.visitorPermit.cityId = 'a', f => f.c.visitorPermit.scope = 'lodging', f => f.c.visitorPermit.bodyEpoch++,
    f => f.c.visitorPermit.visitId = 'other', f => f.c.visitorPermit.expiresAt = 280, f => f.c.visitorPermit.issuedAt = 110,
    f => f.c.source.currentPopulation = 0, f => f.c.source.currentPopulation = NaN, f => f.c.source.physicalCondition = 'ruined',
    f => f.c.source.currentAuthority = false, f => f.c.source.administrationId = 'other', f => f.c.source.lawId = 'other',
    f => f.c.source.researchRecords = null, f => f.c.source.researchRecords.mandate = 'registry',
    f => f.c.source.researchRecords.branchId = null, f => f.c.source.researchRecords.institutionId = 'other',
    f => f.c.source.researchRecords.rules = [], f => f.c.source.researchRecords.rules.push(copy(f.c.source.researchRecords.rules[0])),
    f => f.g.clerk.id = 'replacement', f => f.g.clerk.health = 49, f => f.g.clerk.fatigue = 80,
    f => f.g.powerSeconds = 179, f => f.g.receptionWorkSeconds = NaN, f => f.g.receptionAssignment = 'other-duty',
    f => f.g.visitorAdmission.job = {}, f => f.g.visitorLodging = { job: {} }]) {
    const f = fixture(); change(f); expect(Inquiry.quote(f.g, f.c, 'geneticEngineering', 100)).toBeNull();
  }
  const f = fixture(); expect(Inquiry.quote(f.g, f.c, 'theft', 100)).toBeNull();
  f.c.bans = [{ status: 'active', cityId: 'a', recognizedBy: [{ cityId: 'b' }] }];
  expect(Inquiry.quote(f.g, f.c, 'geneticEngineering', 100)).toMatchObject({ seconds: 180, fee: 0, clerkId: 'original-clerk' });
});
test('research inquiry exact preview starts disclosure only, rejects stale sources and cannot invent instant permission or records', () => {
  for (const change of [f => f.c.source.researchRecords.rules[0].legalStatus = 'prohibited', f => f.g.clerk.id = 'other',
    f => f.c.bodyEpoch++, f => f.c.visitId = 'other', f => f.c.visitorPermit.id = 'other']) {
    const f = fixture(), q = Inquiry.quote(f.g, f.c, 'geneticEngineering', 100); change(f); const before = copy(f.g);
    expect(Inquiry.begin(f.g, f.c, q, 100)).toBe(false); expect(f.g).toEqual(before);
  }
  const f = fixture(), q = Inquiry.quote(f.g, f.c, 'geneticEngineering', 100);
  expect(JSON.stringify(q)).not.toContain('Only a named'); expect(Inquiry.begin(f.g, f.c, { ...q, fee: 1 }, 100)).toBe(false);
  expect(begin(f)).toBe(true); expect(f.g.researchInquiry.extracts).toEqual([]); expect(f.g.visitorAdmission.permits).toEqual([]);
  expect(f.g.receptionWorkSeconds).toBe(14400); expect(f.g.researchInquiry.history[0]).toMatchObject({ disclosedInterest: 'Genetic engineering', status: 'begun' });
  expect(begin(f, 'animancy')).toBe(false); expect(f.g.receptionAssignment).toBe(f.g.researchInquiry.job.id);
});
test('research inquiry completed extracts preserve public law, licensing uncertainty, finite costs and once-only original receipt', () => {
  for (const status of ['prohibited', 'restricted', 'licensed', 'tolerated', 'unregulated']) {
    const f = fixture(); f.c.source.researchRecords.rules[0] = rule('geneticEngineering', status);
    expect(begin(f)).toBe(true); Inquiry.advance(f.g, f.c, 400);
    const [e] = f.g.researchInquiry.extracts; expect(e.at).toBe(280); expect(e.source.rule.legalStatus).toBe(status);
    expect(e.application).toContain('Authorization cannot presently be established'); expect(e.scope).toContain('not proof of an offense');
    expect(e.source.rule.sentencing).toMatchObject({ fineRangeCredits: { minimum: 300, maximum: 3000 }, finitePrisonRangeMonths: { minimum: 3, maximum: 36 } });
    expect(JSON.stringify(e)).not.toMatch(/secret|private-archive/); expect(f.g.receptionWorkSeconds).toBe(14220); expect(f.g.powerSeconds).toBe(86220);
    expect(f.g.receptionAssignment).toBeNull(); expect(f.g.researchInquiry.job).toBeNull();
    const before = copy(f.g); Inquiry.advance(f.g, f.c, 500); expect(f.g).toEqual(before); expect(begin(f, 'geneticEngineering', 500)).toBe(false);
    f.c.source.researchRecords.rules[0].legalStatus = status === 'prohibited' ? 'licensed' : 'prohibited';
    expect(Inquiry.quote(f.g, f.c, 'geneticEngineering', 500)).not.toBeNull(); expect(f.g.researchInquiry.extracts[0]).toEqual(e);
  }
});
test('research inquiry saved partial attendance survives outages, absence and custody without backfill or replacement staff', () => {
  for (const field of ['atDesk', 'local', 'clerkPresent', 'lineOfSight', 'capable', 'custodyActive', 'otherBusy', 'power']) {
    const f = fixture(); begin(f); Inquiry.advance(f.g, f.c, 160); f.g = copy(f.g);
    const savedPower = f.g.powerSeconds;
    if (field === 'power') f.g.powerSeconds = 0;
    else f.c[field] = ['custodyActive', 'otherBusy'].includes(field);
    Inquiry.advance(f.g, f.c, 1000); expect(f.g.researchInquiry.job.progress).toBe(60); expect(f.g.receptionWorkSeconds).toBe(14340);
    if (field === 'power') f.g.powerSeconds = savedPower;
    else f.c[field] = !['custodyActive', 'otherBusy'].includes(field);
    Inquiry.advance(f.g, f.c, 1500); expect(f.g.researchInquiry.job.progress).toBe(60);
    Inquiry.advance(f.g, f.c, 1620); expect(f.g.researchInquiry.extracts[0].at).toBe(1620); expect(f.g.receptionWorkSeconds).toBe(14220);
  }
});
test('research inquiry cancellation preserves disclosure and spent resources and releases only its original queue assignment', () => {
  const f = fixture(); begin(f); Inquiry.advance(f.g, f.c, 160);
  expect(Inquiry.cancel(f.g, { ...f.c, bodyEpoch: 1 }, 160)).toBe(false); expect(Inquiry.cancel(f.g, { ...f.c, local: false }, 160)).toBe(false);
  f.g.receptionAssignment = 'other-duty'; expect(Inquiry.cancel(f.g, f.c, 160)).toBe(true); expect(f.g.receptionAssignment).toBe('other-duty');
  expect(f.g.researchInquiry.extracts).toEqual([]); expect(f.g.receptionWorkSeconds).toBe(14340); expect(f.g.powerSeconds).toBe(86340);
  expect(f.g.researchInquiry.history).toHaveLength(2); expect(Inquiry.cancel(f.g, f.c, 170)).toBe(false);
});
test('research inquiry original body, visit, clerk, law and permit changes end unfinished work without a retroactive extract', () => {
  for (const change of [f => f.c.bodyEpoch++, f => f.c.visitId = 'another-visit', f => f.c.originalBody = false,
    f => f.g.clerk.id = 'replacement', f => f.c.source.currentAuthority = false, f => f.c.source.lawId = 'changed',
    f => f.c.source.researchRecords.rules[0].legalStatus = 'prohibited', f => f.c.visitorPermit.id = 'replacement', f => f.c.visitorPermit = null]) {
    const f = fixture(); begin(f); Inquiry.advance(f.g, f.c, 160); change(f); Inquiry.advance(f.g, f.c, 1000);
    expect(f.g.researchInquiry.job).toBeNull(); expect(f.g.researchInquiry.extracts).toEqual([]); expect(f.g.receptionWorkSeconds).toBe(14340); expect(f.g.receptionAssignment).toBeNull();
  }
});
test('research inquiry exact expiry counts only actual eligible attendance and lodging cannot replace visitor permission', () => {
  const f = fixture(); f.c.visitorPermit.expiresAt = 400; begin(f); Inquiry.advance(f.g, f.c, 500); expect(f.g.researchInquiry.extracts[0].at).toBe(280);
  const h = fixture(); h.c.visitorPermit.expiresAt = 400; begin(h); Inquiry.advance(h.g, h.c, 160);
  h.c.atDesk = false; Inquiry.advance(h.g, h.c, 250); h.c.atDesk = true; Inquiry.advance(h.g, h.c, 300); Inquiry.advance(h.g, h.c, 500);
  expect(h.g.researchInquiry.extracts).toEqual([]); expect(h.g.researchInquiry.job).toBeNull(); expect(h.g.receptionWorkSeconds).toBe(14240);
  const l = fixture(); l.g.visitorLodging = { permissions: [{ expiresAt: 30000 }] }; l.c.visitorPermit = null;
  expect(Inquiry.quote(l.g, l.c, 'animancy', 100)).toBeNull();
});
test('research inquiry death freezes jobs and received knowledge; away reports never gain live laws or progress', () => {
  const f = fixture(); begin(f); Inquiry.advance(f.g, f.c, 160); Inquiry.observe(f.g, f.c, 160);
  const known = copy(f.g.researchInquiry.knowledge); Inquiry.advance(f.g, { ...f.c, local: false }, 1000);
  expect(Inquiry.observe(f.g, { ...f.c, local: false }, 1000)).toEqual(known); expect(JSON.stringify(known)).not.toContain('legalStatus');
  expect(Inquiry.observe(f.g, { ...f.c, capable: false }, 1000)).toEqual(known);
  expect(Inquiry.observe(f.g, { ...f.c, originalBody: false }, 1000)).toEqual(known);
  expect(Inquiry.observe(f.g, { ...f.c, custodyActive: true }, 1000)).toEqual(known);
  const frozen = copy(f.g); f.c.alive = false; Inquiry.advance(f.g, f.c, 10000); Inquiry.observe(f.g, f.c, 10000);
  expect(Inquiry.cancel(f.g, f.c, 10000)).toBe(false); expect(f.g).toEqual(frozen);
});
test('research inquiry shares original finite clerk and power with visitor review and guest check-in', () => {
  const f = fixture(); f.g.annexRoomId = 'annex'; expect(Lodging.publish(f.g, f.c.source, 0)).not.toBeNull();
  expect(begin(f)).toBe(true);
  const lodgingContext = { ...f.c, sourceCurrent: true, accommodationIntact: true, bans: [] };
  expect(Lodging.quote(f.g, lodgingContext, 100)).toBeNull();
  expect(Visitor.begin(f.g, null, Visitor.quote(f.g, f.c), f.c, { money: 100 }, 100)).toBe(false);
  Inquiry.advance(f.g, f.c, 280); expect(Lodging.quote(f.g, lodgingContext, 280)).not.toBeNull();
});

function identity() {
  const m = { homeId: 'a' }; Registry.provision(m, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const identity = Civic.create(), office = m.identityOffices[0], c = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(identity, office, Civic.preview(identity, office, 'Mira Vale'), { money: 100 }, c, -1800); Civic.advance(identity, m.identityOffices, c, 0);
  return { identity, offices: m.identityOffices };
}
async function finish(page) {
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 12; n++) {
    const s = d.intercityPassengerSnapshot(), task = s.tasks.find(t => !t.reason); if (!task) return;
    d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
  } throw new Error('Ordinary physical work did not finish'); });
}
const snapshot = (page, topic = 'geneticEngineering') => page.evaluate(topic => window.helixHeresyDebug.foreignResearchInquirySnapshot(topic), topic);
async function visits(page) { if (!await page.locator('[data-intercity-passenger]').isVisible()) await page.locator('[data-workspace-tab="visits"]').click(); }
async function arrive(page, renderer) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(({ source, identity, renderer }) => {
    const d = window.helixHeresyDebug, network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
      ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
    ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] };
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }, network,
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Transport', capacityBand: 'functional', operationalStatus: 'active' } }] });
    d.setMapRenderer(renderer); d.setForeignReceptionTestContext({ source, ...identity });
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Unable to board');
  }, { source: source(), identity: identity(), renderer });
  await finish(page); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect((await snapshot(page)).quote).toBeNull();
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180));
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60)); await visits(page);
}
for (const renderer of ['dom', 'canvas']) test(`research inquiry controls, original attendance, saved interruptions and dated extracts through ${renderer}`, async ({ page }) => {
  test.setTimeout(300000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await arrive(page, renderer); const panel = page.locator('[data-foreign-research-inquiry]'), initial = await snapshot(page);
  expect(initial.quote).toMatchObject({ fee: 0, seconds: 180 }); await expect(panel.locator('[data-research-law-extract]')).toHaveCount(0);
  await expect(panel).not.toContainText('Only a named chartered institution');
  await panel.getByRole('button', { name: 'Inquire About Genetic engineering', exact: true }).click();
  expect((await snapshot(page)).inquiry.extracts).toHaveLength(0); expect((await snapshot(page)).money).toBe(initial.money);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignLodgingAction('book', window.helixHeresyDebug.foreignLodgingSnapshot().quote))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('enter'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60));
  expect((await snapshot(page)).inquiry.job.progress).toBe(60);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').powerSeconds = 0; d.importSurveyExpeditionTestState(s); });
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(120));
  expect((await snapshot(page)).inquiry.job.progress).toBe(60);
  await page.evaluate(power => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').powerSeconds = power; d.importSurveyExpeditionTestState(s); }, initial.powerSeconds - 60);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60)); expect((await snapshot(page)).inquiry.job.progress).toBe(60);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(120));
  const completed = await snapshot(page); expect(completed.inquiry.job).toBeNull(); expect(completed.inquiry.extracts).toHaveLength(1);
  expect(completed.workSeconds).toBe(initial.workSeconds - 180); expect(completed.powerSeconds).toBe(initial.powerSeconds - 180);
  expect(completed.money).toBe(initial.money); expect(completed.quote).toBeNull();
  await visits(page); await expect(panel).toContainText('Authorization cannot presently be established'); await expect(panel).toContainText('Genetic engineering — licensed');
  await expect(panel).not.toContainText('secret-police-plan'); await expect(panel).toContainText('300');
  await panel.getByRole('button', { name: 'Inquire About Artificial creature creation', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60));
  await panel.getByRole('button', { name: 'Cancel Unfinished Research-Law Inquiry', exact: true }).click();
  expect((await snapshot(page)).inquiry.extracts).toHaveLength(1); expect((await snapshot(page)).workSeconds).toBe(initial.workSeconds - 240);
  await panel.getByRole('button', { name: 'Inquire About Animancy and soul interference', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180));
  await expect(panel).toContainText('Public Beheading');
  const extracts = (await snapshot(page)).inquiry.extracts;
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    g.preparedReceptionTestSource.researchRecords.rules[0].legalStatus = 'prohibited'; d.importSurveyExpeditionTestState(s); });
  expect((await snapshot(page)).quote).not.toBeNull(); await expect(panel).toContainText('Genetic engineering — licensed');
  // Paid accommodation persists beyond visitor approval, but cannot authorize another law inquiry.
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignLodgingAction('book', d.foreignLodgingSnapshot().quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60));
  const permit = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().permission);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').visitorAdmission.permits.at(-1).expiresAt = s.clock;
    d.importSurveyExpeditionTestState(s); });
  expect((await snapshot(page)).quote).toBeNull(); expect((await snapshot(page)).inquiry.extracts).toEqual(extracts);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignLodgingSnapshot().permission)).not.toBeNull();
  // Physical home return must not refresh foreign law or erase received documents.
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  await visits(page); await expect(panel.locator('[data-research-law-extract]')).toHaveCount(2); await expect(panel).toContainText('Genetic engineering — licensed');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await visits(page); await expect(panel.locator('[data-research-law-extract]')).toHaveCount(2);
  expect(permit.scope).toBe('visitorHallOnly'); expect(errors).toEqual([]);
});
