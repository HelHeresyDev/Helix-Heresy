const { test, expect } = require('@playwright/test');
const { fixture } = require('./helpers/resident-caretaker');
const { reload } = require('./helpers/field-station');
test.setTimeout(720000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldForceSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldForceAction(action, options), { action, options });
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldForceForTest(n, true), n);
const progress = page => page.evaluate(() => window.helixHeresyDebug.fieldForceProgressForTest());
async function walk(page, room, cell) {
  const before = await progress(page); if (JSON.stringify(before.cell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    const actual = Object.entries(saved.labMap.rooms).find(([, r]) => r.cells?.some(c => ['x', 'y', 'z'].every(k => c[k] === cell[k])))?.[0] || room;
    return Boolean(d.startScientistMove(actual, { toCell: cell, allowMultiRoom: true }));
  }, { room, cell }),
    JSON.stringify({ from: before.cell, to: cell, guards: before.saved?.members.map(m => m.actor.mapCell) })).toBe(true);
  for (let n = 0; n < 180; n++) {
    const tasks = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().tasks);
    if (!tasks.length) return;
    expect(tasks[0].reason || '').toBe(''); await tick(page, 5);
  }
  throw Error('Physical scientist walk did not finish.');
}
async function setup(page, renderer) {
  const f = await fixture(page, renderer);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    // Existing real defensive chapter is an explicit fixture; recruitment,
    // consent, kit custody and the operation are exercised through production UI.
    g.preparedForeignEscortTestSource = {
      city: { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact' },
      standings: [{ standing: 'licensed', network: { id: 'military:b', category: 'military', roles: ['perimeterDefense', 'escortContracting'], prohibitions: ['claiming police authority'] },
        branch: { id: 'chapter:b', publicName: 'Birch Defensive Chapter', currentCityId: 'b', organizationForm: 'escortChapter', publicPhysicalPresence: true,
          operationalStatus: 'active', physicalCondition: 'intact', capacityBand: 'functional' } }] };
    // Temperate, previously reached ground with no beast actors is legitimate;
    // this contract must not invent an attack to demonstrate its watch.
    g.foreignSurvey.wilderness.beasts = { ...window.HelixWildernessBeasts.defaultState(), materialized: true, lastAt: s.clock };
    d.importSurveyExpeditionTestState(s);
  });
  await page.getByRole('button', { name: 'Inspect refuge defensive posts and walking route', exact: true }).click();
  expect((await snap(page)).plan).toBeTruthy();
  // Physical prior return to municipal ground is a setup input. The operation's
  // outward journey and later return are not supplied by the fixture.
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    d.configureUnsupportedTest({ cell: { x: 14, y: 10, z: e.entry.z } });
  });
  expect((await snap(page)).saved?.members).toHaveLength(2);
  expect((await snap(page)).context.near).toBe(true);
  return f;
}
for (const renderer of ['canvas', 'dom']) test(`${renderer} actual two-person muster, saved physical march, independent watch, finite supplies and personal return settlement`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const f = await setup(page, renderer);
  console.info(`${renderer}: supplied refuge and original local defensive source ready.`);
  const initial = await snap(page), members = initial.saved.members.map(m => m.actor.id);
  const total = s => s.stacks.filter(i => members.includes(i.carriedBy)).reduce((n, i) => n + i.quantity, 0);
  expect(total(initial)).toBe(22);
  await page.getByRole('button', { name: 'Review two-person refuge watch contract', exact: true }).click();
  const quoted = await snap(page); expect(quoted.saved.quote).toBeTruthy();
  await page.getByRole('button', { name: 'Accept exact two-person refuge watch', exact: true }).click();
  let s = await snap(page); expect(s.saved.operation.phase).toBe('outward'); expect(s.money).toBe(initial.money - quoted.saved.quote.upfront);
  const signed = s.saved.operation.signedAt;
  await act(page, 'report'); const dated = (await snap(page)).saved.report;
  await tick(page, 10); s = await snap(page); expect(s.saved.operation.watchStartedAt).toBeNull();
  const beforeSave = s.saved; await reload(page, renderer); expect((await snap(page)).saved).toEqual(beforeSave);
  console.info(`${renderer}: original muster, finite payment and saved outward operation verified.`);
  // Lead at walking pace and let the original guards follow the actual route.
  const plan = s.saved.operation.plan;
  const startIndex = Math.max(0, plan.route.findIndex(c => JSON.stringify(c) === JSON.stringify(s.cell)));
  for (let i = startIndex + 3; i < plan.route.length; i += 3) {
    const cell = plan.route[Math.min(i, plan.route.length - 1)];
    const room = cell.x >= 19 ? f.wildRoom : f.room;
    await walk(page, room, cell); await tick(page, 6);
    // The scientist leads at the detachment's actual pace, rather than leaving
    // a slower original member behind and granting a catch-up teleport.
    for (let wait = 0; wait < 8; wait++) {
      const group = await progress(page);
      if (group.saved.members.every(m => Math.max(Math.abs(m.actor.mapCell.x - group.cell.x), Math.abs(m.actor.mapCell.y - group.cell.y)) <= 3)) break;
      await tick(page, 2);
    }
    const group = await progress(page);
    expect(group.saved.members.every(m => Math.max(Math.abs(m.actor.mapCell.x - group.cell.x), Math.abs(m.actor.mapCell.y - group.cell.y)) <= 4),
      JSON.stringify({ clock: group.clock, scientist: group.cell, members: group.saved.members.map(m => ({ cell: m.actor.mapCell, phase: m.phase, seenAt: m.leaderSeenAt, seenCell: m.leaderSeenCell })) })).toBe(true);
  }
  await walk(page, f.wildRoom, f.l.rest); await tick(page, 20);
  s = await snap(page); expect(s.saved.operation.phase, JSON.stringify(s.saved.members.map(m => ({ phase: m.phase, cell: m.actor.mapCell })))).toBe('watch');
  expect(s.saved.members.map(m => m.actor.mapCell)).toEqual(plan.posts);
  console.info(`${renderer}: both original people physically reached their distinct posts.`);
  const end = s.saved.operation.watchEndsAt;
  expect(end - s.saved.operation.watchStartedAt).toBe(14400);
  expect(s.saved.operation.signedAt).toBe(signed); expect(total(s)).toBe(total(initial));
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    const force = saved.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.fieldForce;
    // Existing bodily need, not an awarded ration or a care outcome. The
    // ongoing watch must spend actual original carried food and water.
    for (const m of force.members) { m.actor.needs.thirst = 39; m.actor.needs.hunger = 39; }
    d.importSurveyExpeditionTestState(saved);
  });
  await walk(page, f.wildRoom, f.l.apron);
  expect(await act(page, 'hold')).toBe(true); expect((await snap(page)).saved.operation.watchEndsAt).toBe(end);
  expect(await act(page, 'report')).toBe(true);
  const lastReport = (await snap(page)).saved.report;
  // Actual absence: the scientist is outside the municipal/foreign map. Safe
  // watch must not end simply because a different location/body is viewed.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.scientist.roomId = 'mainLab'; s.scientist.mapCell = { x: 5, y: 5, z: 0 }; d.importSurveyExpeditionTestState(s); });
  expect(await act(page, 'withdraw')).toBe(false); expect(await act(page, 'report')).toBe(false);
  await tick(page, 60); s = await snap(page); expect(s.saved.operation.phase).toBe('watch'); expect(s.saved.report).toEqual(lastReport);
  expect(s.saved.members.every(m => m.dutySeconds < initial.saved.members[0].dutySeconds)).toBe(true);
  await reload(page, renderer); expect((await snap(page)).saved.operation.watchEndsAt).toBe(end);
  // Advance in bounded calls to keep the browser responsive and the four-hour
  // finite watch honest; self-care spends actual member-owned bottles/food.
  for (let n = 0; n < 6; n++) { const current = await snap(page); if (current.clock >= end) break; await tick(page, Math.min(3000, end - current.clock)); }
  s = await snap(page); expect(['returning', 'returned']).toContain(s.saved.operation.phase);
  for (let n = 0; n < 20 && (await snap(page)).saved.operation.phase !== 'returned'; n++) await tick(page, 30);
  s = await snap(page); expect(s.saved.operation.phase).toBe('returned');
  expect(s.saved.members.map(m => m.actor.id)).toEqual(members); expect(total(s)).toBeLessThan(total(initial));
  expect(s.saved.report).toEqual(lastReport); expect(await act(page, 'settle')).toBe(false);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.fieldForceSnapshot(); d.configureUnsupportedTest({ cell: { ...s.saved.members[0].layout.meeting, y: 10, x: 14 } }); });
  await page.getByRole('button', { name: 'Settle physically returned detachment', exact: true }).click();
  s = await snap(page); expect(s.saved.operation.phase).toBe('completed'); const balance = s.money;
  expect(await act(page, 'settle')).toBe(false); expect((await snap(page)).money).toBe(balance);
  const originalDuty = s.saved.members.map(m => m.dutySeconds);
  expect(await act(page, 'review')).toBeNull(); // Original spent kit needs real resupply.
  expect((await snap(page)).saved.members.map(m => m.dutySeconds)).toEqual(originalDuty);
  await reload(page, renderer); expect((await snap(page)).saved.members.map(m => m.actor.id)).toEqual(members);
  expect((await snap(page)).money).toBe(balance);
  const first = (await snap(page)).saved.members[0], stockBefore = total(await snap(page));
  await page.getByRole('button', { name: `Begin supplied eight-hour rest for ${first.actor.name}`, exact: true }).click();
  s = await snap(page); expect(s.saved.members[0].recovery.status).toBe('resting'); expect(total(s)).toBe(stockBefore - 2);
  await tick(page, 300); s = await snap(page); expect(s.saved.members[0].recovery.progressSeconds).toBe(300);
  expect(s.saved.members[0].dutySeconds).toBe(first.dutySeconds); expect(s.saved.members[0].actor.health).toBe(first.actor.health);
  await reload(page, renderer); expect((await snap(page)).saved.members[0].recovery.progressSeconds).toBe(300);
  await page.getByRole('button', { name: `End off-duty rest for ${first.actor.name}`, exact: true }).click();
  expect((await snap(page)).saved.members[0].dutySeconds).toBe(first.dutySeconds);
  expect(errors).toEqual([]);
});

test('Canvas disclosed restriction, real defensive combat, stranded original casualty and saved withdrawal do not manufacture replacements', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, 'canvas');
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    g.preparedForeignEscortTestSource.standings[0].branch.clientRestrictions = [{ id: 'oath', text: 'No declared opponents of our god.', refusesDeclaredOpposition: true }];
    d.importSurveyExpeditionTestState(s);
  });
  expect(await act(page, 'review')).toBeNull(); expect((await snap(page)).saved.reply.text).toContain('opponents');
  await reload(page, 'canvas'); expect(await act(page, 'review')).toBeNull();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').preparedForeignEscortTestSource.standings[0].branch.clientRestrictions = [];
    d.importSurveyExpeditionTestState(s);
  });
  const q = await act(page, 'review'); expect(q).toBeTruthy(); expect(await act(page, 'accept', { expected: q })).toBe(true);
  const before = await snap(page), ids = before.saved.members.map(m => m.actor.id);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    // This focused combat fixture starts from original guards already at the
    // posts. The other tests cover the actual outward walk, without wildlife.
    for (const [i, m] of e.fieldForce.members.entries()) { m.actor.mapCell = e.fieldForce.operation.plan.posts[i]; m.actor.roomId = e.wilderness.roomId; }
    const first = e.fieldForce.members[0].actor;
    const beast = window.HelixWildernessBeasts.actor('beast:rimefang-pack', 'original-test-beast', { ...first.mapCell, x: first.mapCell.x - 1 }, 'finite-existing-test-population', s.clock);
    Object.assign(beast, { roomId: e.wilderness.roomId, health: 1000, maxHealth: 1000, nextMoveAt: s.clock + 1000, nextAttackAt: s.clock,
      targetId: first.id, behavior: 'pursue', provokedUntil: s.clock + 1000 });
    e.wilderness.beasts.actors = [beast];
    s.scientist.roomId = 'mainLab'; s.scientist.mapCell = { x: 5, y: 5, z: 0 };
    d.importSurveyExpeditionTestState(s);
  });
  await tick(page, 60);
  let s = await snap(page); const battle = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.wilderness.beasts);
  expect(battle.actors).toHaveLength(1); expect(battle.actors[0].health).toBeLessThan(1000);
  expect(s.saved.members.some(m => Object.values(m.gearCondition).some(c => c < 100))).toBe(true);
  expect(s.saved.members.some(m => m.actor.health < 100)).toBe(true); expect(s.injuries.some(i => ids.includes(i.actorId))).toBe(true);
  expect(s.saved.report).toBeNull(); expect(await act(page, 'withdraw')).toBe(false);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    e.wilderness.beasts.actors[0].status = 'dead'; e.wilderness.beasts.actors[0].health = 0;
    // Explicit severe living casualty, not a free treatment or recovery result.
    e.fieldForce.members[0].actor.health = 5;
    d.importSurveyExpeditionTestState(s);
  });
  await tick(page, 5); s = await snap(page); expect(s.saved.operation.phase).toBe('returning');
  const casualty = s.saved.members[0].actor.mapCell;
  await reload(page, 'canvas'); await tick(page, 20); s = await snap(page);
  expect(s.saved.members[0].actor.mapCell).toEqual(casualty); expect(s.saved.members.map(m => m.actor.id)).toEqual(ids);
  expect(s.saved.members[0].actor.health).toBeLessThanOrEqual(5);
  expect(s.saved.members[0].actor.health).toBeGreaterThan(0); expect(s.saved.operation.phase).toBe('returning');
  expect(await act(page, 'settle')).toBe(false); expect(errors).toEqual([]);
});
