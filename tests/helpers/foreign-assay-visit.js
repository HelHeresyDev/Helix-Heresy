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
async function openForeignWorkspace(page, seed = 'foreign-industrial-commission', renderer = 'dom', carrySample = false, viaMunicipal = false, carriedMetalParts = 0, fieldKit = false, repairKit = false, beforeDeparture = null, originalSources = null) {
  page.setDefaultTimeout(30000); await startLifecycleRun(page, seed);
  if (beforeDeparture) await beforeDeparture(page);
  await page.evaluate(({ identity, renderer, carrySample, viaMunicipal, carriedMetalParts, fieldKit, repairKit, originalSources }) => {
    const d = window.helixHeresyDebug, network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
      ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
    ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] };
    const samples = [d.configureLaboratoryAssistantTestSupport()];
    if (viaMunicipal && carrySample) samples.push(d.configureLaboratoryAssistantTestSupport());
    d.setLeasedAnnexTestSupport({ atLoading: true });
    const s = d.exportSurveyExpeditionTestState();
    for (const key of repairKit ? [] : ['assayCase', 'assayReagent']) { const item = s.physicalItemStacks.find(i => i.key === key);
      if (!d.carryActorStack('scientist', item.id, 1)) throw new Error('Finite original cargo unavailable'); }
    if (carrySample) for (const sampleId of samples) if (!d.carryActorStack('scientist', sampleId, 1)) throw new Error('Finite original sample unavailable');
    if (fieldKit) {
      // Explicit original departure fixture, never supplies awarded by a visit.
      const ids = d.configureHiddenWorkshopTest({ carryTools: ['environmentalSurveyKit', ...(repairKit ? ['masonryHammer'] : []), ...(['stone', 'station'].includes(repairKit) ? ['stoneChisel'] : []), ...(repairKit === 'station' ? ['handSaw'] : [])], supplies: { sealedReagentBottle: 1, drinkingWater: 1, fieldRation: 1,
        ...(repairKit && !['stone', 'station'].includes(repairKit) ? { metalParts: 3, rubber: 2 } : {}),
        ...(fieldKit === 'wilderness' ? { fieldShelter: 1 } : {}) } });
      const quantities = repairKit ? new Map(d.exportSurveyExpeditionTestState().physicalItemStacks.filter(i => ids.includes(i.id)).map(i => [i.id, i.quantity])) : null;
      for (const id of ids) if (!d.carryActorStack('scientist', id, quantities?.get(id) || 1)) throw new Error('Finite original survey cargo unavailable');
    }
    const city = { cityId: 'a', ...(originalSources ? { assetId: originalSources.homePopulationId } : {}),
      currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional', provisioning: 'functional' } };
    const standings = [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Transport', capacityBand: 'functional', operationalStatus: 'active' } }];
    if (viaMunicipal) d.setSurveyExpeditionTestContext({ network,
      context: { worldId: 'factory-import-test', siteId: 'parcel', strategicCellId: 'planet-cell:00009', seed: 'factory-import' },
      carrierSource: { strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: { governments: [{ cityId: 'a', roleAssignments: { publicWorksAndProvisioning: 'works:a' }, institutions: [{ id: 'works:a', name: 'Aster Works', capacityBand: 'functional' }] }] } },
      passengerSource: { city, standings } });
    else d.setIntercityPassengerTestContext({ city, network, standings });
    d.setMapRenderer(renderer);
    d.setForeignReceptionTestContext({ source: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', administrationId: 'admin:b', administrationName: 'B Administration',
      capacityBand: 'functional', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, recognition: 'verified', localRules: [] }, ...identity });
    if (carriedMetalParts) d.setForeignSuppliesTestContext({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' }, standings: [], carriedMetalParts });
    if (!viaMunicipal && (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard'))) throw new Error('Unable to board');
  }, { identity: identity(), renderer, carrySample, viaMunicipal, carriedMetalParts, fieldKit, repairKit, originalSources });
  if (viaMunicipal) {
    for (const key of ['environmentalSurveyKit', 'sealedReagentBottle', 'medicalBandage', 'fieldRation']) {
      expect(await page.evaluate(key => window.helixHeresyDebug.packSurveyItem(key), key)).toBe(true); await finishHome(page);
    }
    expect(await page.evaluate(() => window.helixHeresyDebug.reserveMunicipalCarrier())).toBe(true);
    await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.surveyExpeditionSnapshot(), j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.carrier.journeyId); d.advanceSimulation(j.exactArrivalAt - s.clock + 1); });
    const board = await page.evaluate(() => { const d = window.helixHeresyDebug; return { ok: d.boardSurveyVehicle(), reason: d.surveyExpeditionSnapshot().departureReason }; });
    expect(board.ok, board.reason).toBe(true); await finishHome(page); await municipalTravel(page);
    // These bulky original survey objects are required for municipal departure,
    // not for foreign manual assays. Leave them physically at the survey ground
    // rather than expanding the actual passenger car's cargo limit.
    expect(await page.evaluate(() => { const d = window.helixHeresyDebug;
      const items = d.surveyExpeditionSnapshot().carried.filter(i => ['environmentalSurveyKit', 'sealedReagentBottle'].includes(i.key));
      return items.every(i => d.dropActorStack('scientist', i.id));
    })).toBe(true);
    const booking = await page.evaluate(() => { const d = window.helixHeresyDebug; return { ok: d.bookIntercityPassenger('city:b'), state: d.intercityPassengerSnapshot() }; });
    expect(booking.ok, JSON.stringify(booking.state)).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true);
  }
  await finish(page); await advance(page, 1600);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  await page.evaluate(originalSources => window.helixHeresyDebug.setForeignWorkspaceTestSource({ city: { cityId: 'b',
    ...(originalSources ? { assetId: originalSources.foreignPopulationId } : {}), currentPopulation: 100, physicalCondition: 'intact' },
    standings: [{ standing: 'licensed', network: { id: 'research', category: 'research' }, branch: { id: 'research:b', publicName: 'B Research', organizationForm: 'localLaboratory',
      currentCityId: 'b', publicPhysicalPresence: true, operationalStatus: 'active', capacityBand: 'functional' } }] }), originalSources);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true); await advance(page, 180);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true); await advance(page, 60);
  expect(await wa(page, 'walk')).toBe(true); await finish(page); expect(await wa(page, 'quote')).toBe(true);
  expect(await wa(page, 'sign', { expected: (await workspace(page)).saved.quote })).toBe(true);
}
async function finishHome(page) {
  await page.evaluate(() => { const d = window.helixHeresyDebug;
    for (let n = 0; n < 12; n++) { const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) return; d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1)); }
    throw new Error('Home physical work did not finish');
  });
}
async function municipalTravel(page) {
  await page.evaluate(() => { const d = window.helixHeresyDebug;
    for (let n = 0; n < 8; n++) { const s = d.surveyExpeditionSnapshot(); if (!['outbound', 'inbound'].includes(s.phase)) return;
      const j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.journeyId); d.advanceSimulation(Math.max(1, j.exactArrivalAt - s.clock + 1)); }
    throw new Error('Municipal route did not finish');
  });
}
module.exports = { openForeignWorkspace, workspace, advance, action, wa, finish, finishHome, municipalTravel };
