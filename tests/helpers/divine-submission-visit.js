const { expect } = require('@playwright/test');
const { startLifecycleRun } = require('./start-lifecycle-run');
const snap = p => p.evaluate(() => window.helixHeresyDebug.divineBodiesSnapshot());
const act = (p, action, id) => p.evaluate(({ action, id }) => window.helixHeresyDebug.divineBodyAction(action, id), { action, id });
const tick = (p, n = 1) => p.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), n);
async function finish(p) {
  await p.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 60; n++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) return;
      d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
    }
    throw Error('Actual packing/walking did not finish');
  });
}
async function walk(p, cell, roomId = 'supportedSurveyGround') {
  expect(await p.evaluate(({ cell, roomId }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, urgent: true, allowMultiRoom: true })), { cell, roomId })).toBe(true);
  await finish(p);
}
async function prepare(p, renderer, motive = 'protectFollowers', attacker = false, strongerBody = false, closeout = false) {
  await startLifecycleRun(p, `true-body-${renderer}`);
  expect(await p.evaluate(({ renderer, motive, attacker, strongerBody, closeout }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const god = { id: 'god:original-a', privateObjective: motive, objectives: ['protectFollowers'],
      stableIdentity: { mortalIdentityId: 'original-mortal-a', originKind: renderer === 'dom' ? 'human' : 'beast' },
      domains: ['fire', 'war'], lifecycle: { lifeState: 'living', divinityState: 'divine' },
      divineCore: { identityBound: true, state: 'stable', repeatableSignature: 'original-physical-signature', innateCapacity: strongerBody ? 450 : 400, receivingCapacity: 600 },
      power: { reserve: closeout ? 0 : strongerBody ? 475 : 450, reserveCapacity: 2000, worshipIncome: 100 }, expenditures: { communication: 7, protection: 8, miracles: 10 },
      worshipSources: [{ populationSourceId: 'original-population-a', followerUnits: 12 }] };
    const home = { godId: god.id, cityId: closeout ? null : 'a', cellId: closeout ? 'planet-cell:00002' : 'planet-cell:00001', placeId: closeout ? 'holy-site:original' : 'city:a', name: 'Original Ember God' };
    const other = { ...JSON.parse(JSON.stringify(god)), id: 'god:original-b', privateObjective: 'opposeRivals',
      stableIdentity: { mortalIdentityId: 'original-mortal-b', originKind: 'human' }, domains: [],
      lifecycle: { lifeState: 'living', divinityState: 'descended' },
      divineCore: { ...god.divineCore, repeatableSignature: 'other-original-signature', innateCapacity: closeout ? 1 : 600 },
      power: { reserve: 0, reserveCapacity: 2000, worshipIncome: 0 } };
    return d.configureDivineBodiesTest({ god, home,
      additionalOriginals: attacker ? [{ god: other, home: { ...home, godId: other.id, name: 'Original Descended Individual' } }] : [],
      priorBeaconScholarship: true, skills: { animancy: 201, fabrication: 151, materialsScience: 101, striking: 201, guarding: 201, evasion: strongerBody ? 251 : 201, perception: 201 },
      materials: { arcaneFeedstock: closeout ? 120 : 40, metalParts: closeout ? 12 : 8, glass: closeout ? 12 : 8 } });
  }, { renderer, motive, attacker, strongerBody, closeout })).toBe(true);
  expect(await p.evaluate(() => window.helixHeresyDebug.startResearchProject('divineCoreResonance'))).toBe(true);
  let s;
  for (let n = 0; n < 6; n++) {
    s = await snap(p); if (s.research.projects.divineCoreResonance.status === 'completed') break;
    const t = s.tasks.find(t => t.type === 'researchWork'); expect(t).toBeTruthy();
    await p.evaluate(n => window.helixHeresyDebug.advanceSoulBeaconsForTest(n), Math.max(60, t.dueAt - s.clock + 60));
  }
  expect((await snap(p)).research.projects.divineCoreResonance.status).toBe('completed');
  if (closeout) {
    expect(await p.evaluate(() => window.helixHeresyDebug.startResearchProject('divineWayfinding'))).toBe(true);
    for (let n = 0; n < 6; n++) {
      s = await snap(p); if (s.research.projects.divineWayfinding.status === 'completed') break;
      const t = s.tasks.find(t => t.type === 'researchWork'); expect(t).toBeTruthy();
      await p.evaluate(n => window.helixHeresyDebug.advanceSoulBeaconsForTest(n), Math.max(60, t.dueAt - s.clock + 60));
    }
    expect((await snap(p)).research.projects.divineWayfinding.status).toBe('completed');
  }
  console.info(`${renderer}: submission check researched through actual work and materials`);
  await p.evaluate(() => window.helixHeresyDebug.setInstrumentCalibration('thaumometer', 90));
  expect(await act(p, 'packInstrument')).toBe(true); await finish(p);
  expect(await (closeout ? p.evaluate(() => window.helixHeresyDebug.divineWayfindingAction('pack')) : act(p, 'packReagents'))).toBe(true); await finish(p);
  await p.evaluate(closeout => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'true-body', publicProspects: {}, truth: {} } });
    if (!closeout) { d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true }); }
  }, closeout);
  await p.locator('[data-workspace-tab="visits"]').click();
  if (closeout) return (await snap(p)).saved.bodies[0].id;
  await walk(p, { x: 10, y: 15, z: 6 });
  const id = (await snap(p)).saved.bodies[0].id;
  expect(await act(p, 'examine', id)).toBe(true); await tick(p, 120);
  expect((await snap(p)).saved.bodies[0].identified).toBeTruthy();
  console.info(`${renderer}: original personally examined after actual packing and approach`);
  expect(await act(p, 'demand', id)).toBe(false); // Knowing a name is not leverage.
  expect(await act(p, 'resonance', id)).toBe(true); await tick(p, 1); await tick(p, 2);
  expect(await act(p, 'guard', id)).toBe(true);
  for (let n = 0; n < 6; n++) {
    s = await snap(p);
    if (s.contexts[0].context.combatReady) break;
    await tick(p);
  }
  s = await snap(p);
  expect(s.saved.bodies[0].lastDamage?.attackerId, JSON.stringify({ body: s.saved.bodies[0], context: s.contexts[0], combat: s.combat })).toBe('scientist');
  expect(s.saved.bodies[0].health).toBe(strongerBody ? 450 : 200);
  return id;
}
module.exports = { snap, act, tick, finish, walk, prepare };
