const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { source } = require('../scripts/benchmark-beast-regional-ecology');
const { source: workSource } = require('./helpers/regional-work-source');

test('measured habitat lows survive browser reload and later supplied recovery without becoming a passing source', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const src = source(); src.groups[0].activityState = { sleeping: true, dreamConsent: false };
  src.groups[1].cohorts[0].count = 20;
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastHabitatSources);
  await page.evaluate(src => {
    const P = window.HelixBeastPopulations, s = P.create(src, { worldId: 'browser-world', runId: 'measured-control' });
    for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12;
    P.advance(s, 70 * P.DAY, true, true);
    localStorage.setItem('measured-habitat-control', JSON.stringify({ src, s }));
  }, src);
  await page.reload(); await page.waitForFunction(() => window.HelixBeastHabitatSources);
  const loaded = await page.evaluate(() => {
    const P = window.HelixBeastPopulations, S = window.HelixBeastHabitatSources;
    const { src, s: saved } = JSON.parse(localStorage.getItem('measured-habitat-control')), s = P.normalize(saved);
    if (!s) throw Error('Measured history did not normalize');
    P.setEcologicalActivity(s, 'root', { sleeping: false, dreamConsent: false }, s.clock, 'actual-recovery');
    const branch = P.rebind(s, { worldId: s.worldId, runId: s.runId }, { worldId: s.worldId, runId: 'continued' });
    P.advance(s, 120 * P.DAY, true, true); P.advance(branch, 120 * P.DAY, true, true);
    const report = S.assess(src, null, { account: s }), continued = S.assess(src, null, { account: branch });
    return { status: report.status, condition: s.regions[0].condition.soilCover, exhausted: s.regions[0].exhausted,
      minimum: report.ecology[0].minimumCondition.soilCover, breach: report.issues.find(i => i.kind === 'performedHabitatFloorBreach'),
      same: JSON.stringify(report) === JSON.stringify(continued), valid: Boolean(P.normalize(s)) };
  });
  expect(loaded.status).toBe('rejected'); expect(loaded.condition).toBe(100); expect(loaded.minimum).toBeCloseTo(24);
  expect(loaded.breach.firstAt).toBeCloseTo(62.5 * 86400); expect(loaded.exhausted).toBe(false);
  expect(loaded.same).toBe(true); expect(loaded.valid).toBe(true); expect(errors).toEqual([]);
});

test('browser dependency order and internal regional work survive a serialized partial-work continuation', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastRegionalEcology);
  // The model is deliberately not adopted into live encounters. Exercise its
  // actual browser dependencies and its own serializer, not a fake native save.
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'beast-populations.js') });
  const saved = await page.evaluate(src => {
    const P = window.HelixBeastPopulations, binding = { worldId: 'browser-world', runId: 'browser-run' };
    const s = P.create(src, binding); P.advance(s, P.DAY / 2, true, true);
    return JSON.stringify(s);
  }, source());
  await page.reload(); await page.waitForFunction(() => window.HelixBeastRegionalEcology);
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'beast-populations.js') });
  const result = await page.evaluate(saved => {
    const P = window.HelixBeastPopulations, binding = { worldId: 'browser-world', runId: 'browser-run' };
    const s = P.normalize(JSON.parse(saved), binding);
    if (!s) throw Error('Regional partial work did not normalize');
    const planCount = s.plans.length;
    P.advance(s, P.DAY, true, true);
    return { soil: s.regions[0].condition.soilCover, biomass: s.regions[0].outputs.rootedBiomassKg,
      samePlan: s.plans.length === planCount, exhausted: s.regions[0].exhausted,
      minerals: s.regions[0].stocks.mineralsKg, valid: Boolean(P.normalize(s)) };
  }, saved);
  expect(result.soil).toBeCloseTo(83.2, 6); expect(result.biomass).toBeCloseTo(150, 6);
  expect(result.minerals).toBeCloseTo(2000000 - 1320, 6);
  expect(result.samePlan).toBe(true); expect(result.exhausted).toBe(false); expect(result.valid).toBe(true);
  expect(errors).toEqual([]);
});

test('all eight browser work adapters retain paid transfers and original structures across a partial-work reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const actions = ['tendWetland', 'cultivateReef', 'buildDam', 'growBlooms', 'buildFurnace', 'dreamWeather', 'filterMana', 'filterPlankton'];
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastRegionalWork);
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'beast-populations.js') });
  const saved = await page.evaluate(sources => {
    const P = window.HelixBeastPopulations;
    return sources.map(src => {
      const s = P.create(src, { worldId: 'browser-world', runId: src.id });
      P.advance(s, P.DAY / 2, true, true); return JSON.stringify(s);
    });
  }, actions.map(action => workSource(action)));
  await page.reload(); await page.waitForFunction(() => window.HelixBeastRegionalWork);
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'beast-populations.js') });
  const results = await page.evaluate(records => records.map(text => {
    const P = window.HelixBeastPopulations, s = P.normalize(JSON.parse(text));
    if (!s) throw Error('Unsupported partial regional work');
    P.advance(s, P.DAY, true, true);
    const r = s.regions[0], action = s.groups[0].ecology.action;
    return { action, valid: Boolean(P.normalize(s)), work: r.ecologicalReceipts[action],
      reef: r.stocks.livingReefKg, bloom: r.stocks.bloomKg, mana: r.stocks.excessMana,
      plankton: r.stocks.planktonKg, passed: r.watercourseReceipts?.passedL || 0 };
  }), saved);
  expect(results.map(r => r.action)).toEqual(actions); expect(results.every(r => r.valid && r.work > 0)).toBe(true);
  expect(results.find(r => r.action === 'cultivateReef').reef).toBeCloseTo(125);
  expect(results.find(r => r.action === 'growBlooms').bloom).toBeCloseTo(102);
  expect(results.find(r => r.action === 'filterMana').mana).toBeCloseTo(9940);
  expect(results.find(r => r.action === 'filterPlankton').plankton).toBeCloseTo(960000);
  expect(results.find(r => r.action === 'buildDam').passed).toBeCloseTo(2000);
  expect(errors).toEqual([]);
});

test('physical work-face stocks and explicit dream participation survive browser storage without refills or renewed consent', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const sources = ['buildDam', 'dreamWeather'].map(action => {
    const src = workSource(action), site = src.regions[0].ecology.workSites[0];
    Object.assign(site, { featureId: 'original-feature', footprintHa: 1,
      position: { regionId: 'workface', eastM: 0, northM: 0, altitudeM: 0 } });
    for (const g of src.groups) g.home = { patchId: 'workface', eastKm: 0, northKm: 0, depthM: 0 };
    if (action === 'buildDam') {
      site.inputKeys = { constructionKg: `${site.id}:constructionKg` };
      src.regions[0].stocks[site.inputKeys.constructionKg] = 100;
      src.regions[0].capacity[site.inputKeys.constructionKg] = 100;
    } else {
      site.participantGroupIds = []; site.allowDormantParticipants = true;
      src.groups[1].activityState = { sleeping: false, dreamConsent: false };
    }
    return src;
  });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastPopulations);
  await page.evaluate(sources => {
    const P = window.HelixBeastPopulations;
    const records = sources.map(src => {
      const s = P.create(src, { worldId: 'browser-world', runId: src.id });
      P.advance(s, P.DAY / 4, true, true);
      if (s.groups[0].ecology.action === 'dreamWeather') {
        const site = s.regions[0].ecology.workSites[0];
        if (!P.setDreamParticipants(s, 'workface', site.id, ['original-sleepers'], s.clock, 'actual-presence')) throw Error('Participant not bound');
        P.advance(s, P.DAY / 2, true, true);
        if (s.regions[0].ecologicalReceipts?.dreamWeather) throw Error('Invented consent');
        P.setEcologicalActivity(s, 'original-sleepers', { sleeping: true, dreamConsent: true }, s.clock, 'explicit-consent');
        P.advance(s, 3 * P.DAY / 4, true, true);
        P.setEcologicalActivity(s, 'original-sleepers', { sleeping: true, dreamConsent: false }, s.clock, 'refusal');
      }
      return s;
    });
    localStorage.setItem('physical-work-account-test', JSON.stringify(records));
  }, sources);
  await page.reload(); await page.waitForFunction(() => window.HelixBeastPopulations);
  const loaded = await page.evaluate(() => {
    const P = window.HelixBeastPopulations;
    return JSON.parse(localStorage.getItem('physical-work-account-test')).map(saved => {
      const s = P.normalize(saved); if (!s) throw Error('Physical work did not normalize');
      const branch = P.rebind(s, { worldId: s.worldId, runId: s.runId }, { worldId: s.worldId, runId: 'continued' });
      P.advance(branch, 2 * P.DAY, true, true);
      const r = branch.regions[0], site = r.ecology.workSites[0];
      return { action: site.action, valid: Boolean(P.normalize(branch)), work: r.ecologicalReceipts[site.action],
        local: r.stocks[site.inputKeys?.constructionKg] ?? null, global: r.stocks.constructionKg,
        atmosphere: r.stocks.atmosphericWaterL, consent: branch.groups[1]?.activityState.dreamConsent ?? null };
    });
  });
  expect(loaded.every(r => r.valid)).toBe(true);
  expect(loaded[0].work).toBeCloseTo(1); expect(loaded[0].local).toBeCloseTo(0); expect(loaded[0].global).toBe(1000);
  expect(loaded[1].work).toBeCloseTo(.25); expect(loaded[1].atmosphere).toBeCloseTo(99750); expect(loaded[1].consent).toBe(false);
  expect(errors).toEqual([]);
});
