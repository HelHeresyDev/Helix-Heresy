const { test, expect } = require('@playwright/test');
const Clinic = require('../municipal-clinic');
const { pathToFileURL } = require('url');
const path = require('path');

test('emergency allowance creates bounded debt, never optional payment authority', () => {
  const stay = Clinic.admit(1, 0, true);
  expect(Clinic.available(stay, false)).toBe(0);
  for (let i = 0; i < 9; i++) expect(Clinic.charge(stay, 20, true)).toBe(20);
  expect(Clinic.charge(stay, 1, true)).toBeNull();
  expect(stay.emergencySpent).toBe(180);
  expect(stay.escrow).toBe(0);
});
test('paid care respects its cap and refunds unused escrow exactly once', () => {
  const stay = Clinic.admit(2, 0, false); stay.escrow = 120;
  expect(Clinic.charge(stay, 20, false)).toBe(0);
  expect(stay.spent).toBe(20);
  expect(Clinic.close(stay, 'left', 60)).toBe(100);
  expect(Clinic.close(stay, 'left', 61)).toBe(0);
  expect(Clinic.active(stay)).toBe(false);
});

async function setup(page, health = 50, injury = true) {
  page.on('dialog', d => d.accept());
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(({ health, injury }) => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'clinic-test', publicProspects: {}, truth: {} } });
    d.configureUnsupportedTest({ municipal: true });
    d.configureMedicalTest({ health, injury, cell: { x: 17, y: 10, z: 6 } });
    d.configureClinicTest({ money: 1000 });
  }, { health, injury });
}
const snap = page => page.evaluate(() => window.helixHeresyDebug.clinicSnapshot());
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceClinicForTest(n), seconds);

test.describe('physical municipal clinic', () => {
  test.setTimeout(180000);
  test('walk-in assessment, reserved supplies across reload, capped care and physical discharge', async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await setup(page);
    expect(await page.evaluate(() => window.helixHeresyDebug.admitMunicipalClinic())).toBe(true);
    expect((await snap(page)).cell).toEqual({ x: 17, y: 10, z: 6 });
    await advance(page, 80);
    let s = await snap(page);
    expect(s.cell).toEqual(Clinic.BED); expect(s.stay.assessment).toBeTruthy(); expect(s.health).toBe(50);
    expect(s.stay.assessment).toMatchObject({ personId: 'scientist', issuerId: 'municipal-clinician', cityId: 'a' });
    expect(s.stay.assessment.injuryIds).toContain(s.injuries.find(i => i.actorId === 'scientist').id);
    expect(s.money).toBe(1000); expect(s.routineSuspension.reason).toBe('municipal clinic care');
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.approveClinicCare())).toBe(true);
    await advance(page, 1); s = await snap(page);
    expect(s.stay.operation.kind).toBe('stabilize');
    const stackId = s.stay.operation.stackId, quantity = s.stacks.find(x => x.id === stackId).quantity;
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    await advance(page, 46); s = await snap(page);
    expect(s.stacks.find(x => x.id === stackId).quantity).toBe(quantity - 1);
    expect(s.health).toBe(50); expect(s.debt).toBe(0);
    await advance(page, 65);
    expect((await snap(page)).injuries.some(i => i.actorId === 'scientist' && i.status === 'recovering')).toBe(true);
    await advance(page, 905); s = await snap(page); expect(s.health).toBe(52);
    const paid = s.stay.spent;
    expect(await page.evaluate(() => window.helixHeresyDebug.leaveMunicipalClinic())).toBe(true);
    s = await snap(page); expect(s.cell).toEqual(Clinic.BED); expect(s.money).toBe(1000 - paid); expect(s.routineSuspension).toBeNull();
    expect(await page.evaluate(() => window.helixHeresyDebug.leaveMunicipalClinic())).toBe(false);
    await page.locator('[data-workspace-tab="visits"]').click();
    await expect(page.locator('[data-municipal-clinic]')).toContainText('Clinician Iona Vale');
    expect(errors).toEqual([]);
  });
  test('incapacitated handoff bills limited emergency care and stops at restored consent', async ({ page }) => {
    await setup(page, 5, false);
    await page.evaluate(() => window.helixHeresyDebug.configureClinicTest({ handoff: true, money: 0 }));
    expect((await snap(page)).stay.emergency).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.leaveMunicipalClinic())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.approveClinicCare())).toBe(false);
    await advance(page, 3000); let s = await snap(page);
    expect(s.health).toBe(11); expect(s.incapacitated).toBe(false); expect(s.money).toBe(0); expect(s.debt).toBe(30);
    await advance(page, 1800); s = await snap(page); expect(s.health).toBe(11); expect(s.debt).toBe(30);
    expect(await page.evaluate(() => window.helixHeresyDebug.leaveMunicipalClinic())).toBe(true);
    await advance(page, 60); expect((await snap(page)).stay.status).toBe('left');
  });
  test('missing finite supplies block care without charges; death never becomes a clinic cure', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => window.helixHeresyDebug.admitMunicipalClinic()); await advance(page, 80);
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.approveClinicCare(); d.configureClinicTest({ removeStock: true }); });
    await advance(page, 120); let s = await snap(page);
    expect(s.stay.reason).toContain('finite'); expect(s.stay.spent).toBe(0); expect(s.health).toBe(50);
    await page.evaluate(() => window.helixHeresyDebug.configureMedicalTest({ health: 0 }));
    await advance(page, 1); s = await snap(page);
    expect(s.stay.status).toBe('dead'); expect(s.money).toBe(1000); expect(s.health).toBe(0);
  });
  test('normal simulation advances admission and stops ordinary boarding during care', async ({ page }) => {
    await setup(page, 100, false);
    expect(await page.evaluate(() => window.helixHeresyDebug.admitMunicipalClinic())).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(80));
    const s = await snap(page);
    expect(s.cell).toEqual(Clinic.BED); expect(s.stay.assessment).toBeTruthy();
    expect(s.health).toBe(100); expect(s.money).toBe(1000);
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.leaveMunicipalClinic())).toBe(true);
    expect((await snap(page)).stay.status).toBe('discharged');
  });
});
