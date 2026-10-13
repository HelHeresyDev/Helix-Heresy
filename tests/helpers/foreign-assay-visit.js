const { expect } = require('@playwright/test');
const Registry = require('../../carrier-identity');
const Civic = require('../../scientist-identity');
const { startLifecycleRun } = require('./start-lifecycle-run');
const workspace = page => page.evaluate(() => window.helixHeresyDebug.foreignWorkspaceSnapshot());
const advance = (page, seconds) => page.evaluate(s => window.helixHeresyDebug.advanceForeignReceptionTestTime(s), seconds);
const action = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignCommissionAction(action, options), { action, options });
const wa = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignWorkspaceAction(action, options), { action, options });
async function finish(page) {
  for (let n = 0; n < 12; n++) { const s = await workspace(page), t = s.tasks.find(t => !t.reason); if (!t) return;
    await advance(page, Math.max(1, t.dueAt - s.clock + 1)); }
  throw new Error('Physical work did not finish');
}
function identity() {
  const m = { homeId: 'a' }; Registry.provision(m, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const identity = Civic.create(), office = m.identityOffices[0], c = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(identity, office, Civic.preview(identity, office, 'Mira Vale'), { money: 100 }, c, -1800); Civic.advance(identity, m.identityOffices, c, 0);
  return { identity, offices: m.identityOffices };
}
async function openForeignWorkspace(page, seed = 'foreign-industrial-commission', renderer = 'dom', carrySample = false) {
  page.setDefaultTimeout(30000); await startLifecycleRun(page, seed);
  await page.evaluate(({ identity, renderer, carrySample }) => {
    const d = window.helixHeresyDebug, network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
      ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
    ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] };
    const sampleId = d.configureLaboratoryAssistantTestSupport(); d.setLeasedAnnexTestSupport({ atLoading: true });
    const s = d.exportSurveyExpeditionTestState();
    for (const key of ['assayCase', 'assayReagent']) { const item = s.physicalItemStacks.find(i => i.key === key);
      if (!d.carryActorStack('scientist', item.id, 1)) throw new Error('Finite original cargo unavailable'); }
    if (carrySample && !d.carryActorStack('scientist', sampleId, 1)) throw new Error('Finite original sample unavailable');
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }, network,
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Transport', capacityBand: 'functional', operationalStatus: 'active' } }] });
    d.setMapRenderer(renderer);
    d.setForeignReceptionTestContext({ source: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', administrationId: 'admin:b', administrationName: 'B Administration',
      capacityBand: 'functional', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, recognition: 'verified', localRules: [] }, ...identity });
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Unable to board');
  }, { identity: identity(), renderer, carrySample });
  await finish(page); await advance(page, 1600);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.setForeignWorkspaceTestSource({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' },
    standings: [{ standing: 'licensed', network: { id: 'research', category: 'research' }, branch: { id: 'research:b', publicName: 'B Research', organizationForm: 'localLaboratory',
      currentCityId: 'b', publicPhysicalPresence: true, operationalStatus: 'active', capacityBand: 'functional' } }] }));
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true); await advance(page, 180);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true); await advance(page, 60);
  expect(await wa(page, 'walk')).toBe(true); await finish(page); expect(await wa(page, 'quote')).toBe(true);
  expect(await wa(page, 'sign', { expected: (await workspace(page)).saved.quote })).toBe(true);
}
module.exports = { openForeignWorkspace, workspace, advance, action, wa, finish };
