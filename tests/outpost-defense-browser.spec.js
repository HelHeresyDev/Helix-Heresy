const { test, expect } = require('@playwright/test');
const { fixture } = require('./helpers/resident-caretaker');
const { reload } = require('./helpers/field-station');
test.setTimeout(480000);
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceOutpostDefenseForTest(n), n);
const snapshot = page => page.evaluate(() => {
  const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
  const e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
  return { clock: s.clock, beasts: e.wilderness.beasts, force: e.fieldForce, refuge: s.fieldRefuge,
    door: s.doors[s.fieldRefuge.site.doorId], structure: d.structuralSnapshot(s.fieldRefuge.site.layout.door), injuries: s.injuries, stacks: s.physicalItemStacks,
    events: s.events, scientist: s.scientist, health: d.wildernessBeastSnapshot().health, mana: d.wildernessBeastSnapshot().mana,
    knowledge: d.wildernessBeastSnapshot().knowledge, tasks: d.foreignSurveySnapshot().tasks };
});
async function setup(page, renderer, { guarded = true, condition = 100, outside = false, priorReport = false } = {}) {
  const f = await fixture(page, renderer);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    g.preparedForeignEscortTestSource = {
      city: { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact' },
      standings: [{ standing: 'licensed', network: { id: 'military:b', category: 'military', roles: ['perimeterDefense'], prohibitions: [] },
        branch: { id: 'chapter:b', publicName: 'Birch Defensive Chapter', currentCityId: 'b', organizationForm: 'escortChapter', publicPhysicalPresence: true,
          operationalStatus: 'active', physicalCondition: 'intact', capacityBand: 'functional' } }] };
    g.foreignSurvey.wilderness.beasts = { ...window.HelixWildernessBeasts.defaultState(), materialized: true, lastAt: s.clock };
    d.importSurveyExpeditionTestState(s);
  });
  if (guarded) {
    expect(await page.evaluate(() => window.helixHeresyDebug.fieldForceAction('inspect'))).toBe(true);
    await page.evaluate(() => {
      const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
      const e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
      d.configureUnsupportedTest({ cell: { x: 14, y: 10, z: e.entry.z } });
    });
    expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.fieldForceAction('review')))).toBe(true);
    expect(await page.evaluate(() => {
      const d = window.helixHeresyDebug; return d.fieldForceAction('accept', { expected: d.fieldForceSnapshot().saved.quote });
    })).toBe(true);
    if (priorReport) expect(await page.evaluate(() => window.helixHeresyDebug.fieldForceAction('report'))).toBe(true);
  }
  await page.evaluate(({ guarded, condition, outside }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey, l = s.fieldRefuge.site.layout;
    if (guarded) {
      // The already tested march is a prior input here, not an outcome of
      // defense. Original source, consent, prepaid clock and finite kit remain.
      const force = e.fieldForce, o = force.operation;
      o.phase = 'watch'; o.watchStartedAt = s.clock; o.watchEndsAt = s.clock + 14400;
      force.members.forEach((m, i) => { m.phase = 'watch'; m.actor.roomId = l.roomId || e.wilderness.roomId;
        m.actor.mapCell = o.plan.posts[i]; m.actor.nextAttackAt = s.clock; m.actor.nextMoveAt = s.clock + 20; });
    }
    s.doors[s.fieldRefuge.site.doorId].condition = condition;
    s.doors[s.fieldRefuge.site.doorId].state = 'closed';
    d.importSurveyExpeditionTestState(s); d.configureUnsupportedTest({ cell: outside ? { ...l.apron, y: l.apron.y + 3 } : l.rest });
  }, { guarded, condition, outside });
  return f;
}
async function animal(page, f, { condition = 'remembered', health = 48, away = false, speciesId = 'beast:rimefang-pack' } = {}) {
  await page.evaluate(({ f, condition, health, away, speciesId }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    const a = window.HelixWildernessBeasts.actor(speciesId, 'original-regional-animal', f.l.apron, 'finite-original-regional-population', s.clock);
    Object.assign(a, { roomId: e.wilderness.roomId, health, nextMoveAt: s.clock, nextAttackAt: s.clock,
      // A just-seen retreat through the formerly open door is a saved input.
      // No knowledge is manufactured by the new defense behavior.
      lastTarget: condition === 'remembered' ? f.l.rest : null, rememberedUntil: condition === 'remembered' ? s.clock + 12 : 0,
      targetId: condition === 'remembered' ? 'scientist' : null });
    e.wilderness.beasts.actors = [a];
    if (away) { s.scientist.roomId = 'mainLab'; s.scientist.mapCell = { x: 5, y: 5, z: 0 }; }
    d.importSurveyExpeditionTestState(s);
  }, { f, condition, health, away, speciesId });
}
async function walk(page, room, cell) {
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell, allowMultiRoom: true })), { room, cell })).toBe(true);
  for (let i = 0; i < 160; i++) {
    const s = await page.evaluate(() => window.helixHeresyDebug.outpostDefenseProgressForTest()); if (!s.tasks.length) return;
    expect(s.tasks[0].reason || '').toBe('');
    if (i % 20 === 0) console.info(`Physical evacuation: ${JSON.stringify(s)}`);
    await page.evaluate(() => window.helixHeresyDebug.advanceOutpostDefenseForTest(3, true));
  }
  throw Error('Actual refuge evacuation walk did not finish.');
}
for (const renderer of ['canvas', 'dom']) {
  test(`${renderer}: original supplied guards resist a real regional animal during scientist absence; wounds and spent kit persist`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const f = await setup(page, renderer); const before = await snapshot(page);
    await animal(page, f, { condition: 'none', away: true }); await tick(page, 60);
    let s = await snapshot(page);
    expect(s.beasts.actors).toHaveLength(1); expect(s.beasts.actors[0].health).toBeLessThan(48);
    expect(s.beasts.actors[0].status === 'dead' || s.beasts.actors[0].health < 48 * .3).toBe(true);
    expect(s.force.members.some(m => Object.values(m.gearCondition).some(c => c < 100))).toBe(true);
    expect(s.force.members.some(m => m.actor.health < 100)).toBe(true);
    expect(s.door.condition).toBe(100); expect(s.force.report).toBeNull();
    expect(s.events.filter(e => /took .*damage from a creature|struck the door/.test(e.message))).toHaveLength(0);
    const ids = s.force.members.map(m => m.actor.id), beast = s.beasts.actors[0];
    await reload(page, renderer); s = await snapshot(page);
    expect(s.force.members.map(m => m.actor.id)).toEqual(ids); expect(s.beasts.actors[0].health).toBeLessThanOrEqual(beast.health);
    expect(s.force.members.some(m => m.dutySeconds < before.force.members[0].dutySeconds)).toBe(true);
    // Independently verify that a genuinely lost barrier, visible from the
    // original posts, ends support and starts physical return, not teleportation.
    expect(await page.evaluate(cell => window.helixHeresyDebug.damageStructure(cell, 200), f.l.door)).toBe(true);
    await tick(page, 1); s = await snapshot(page);
    expect(s.door.breached).toBe(true); expect(s.force.operation.phase).toBe('returning');
    expect(s.force.members.some(m => m.actor.roomId === f.wildRoom)).toBe(true);
    expect(s.force.members.map(m => m.actor.id)).toEqual(ids);
    expect(errors).toEqual([]);
  });
  test(`${renderer}: a remembered target at an unstaffed refuge causes a saved breach and physical evacuation`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const f = await setup(page, renderer, { guarded: false, condition: 26 });
    await animal(page, f); await tick(page, 1); let s = await snapshot(page);
    expect(s.door.breached, JSON.stringify({ door: s.door, structure: s.structure, beast: s.beasts.actors[0] })).toBe(true); expect(s.door.state).toBe('open'); expect(s.door.condition).toBeLessThan(26);
    expect(s.beasts.actors[0].barrierContact).toMatchObject({ cell: f.l.door, breached: true });
    const condition = s.door.condition, attackAt = s.beasts.actors[0].nextAttackAt;
    await reload(page, renderer); s = await snapshot(page);
    expect(s.door.condition).toBe(condition); expect(s.beasts.actors[0].nextAttackAt).toBe(attackAt);
    await tick(page, 3);
    // The attacker now physically blocks the narrow exit. Escape needs real
    // defensive action, not walking through its body or deleting the animal.
    const mana = (await snapshot(page)).mana;
    for (let i = 0; i < 8; i++) {
      s = await snapshot(page); if (s.beasts.actors[0].health < 48 * .3) break;
      expect(await page.evaluate(() => window.helixHeresyDebug.startScientistCombatAction('soulLash', 'original-regional-animal'))).toBe(true);
      await tick(page, 2);
    }
    s = await snapshot(page); expect(s.beasts.actors[0].health).toBeLessThan(48 * .3); expect(s.mana).toBeLessThan(mana);
    await tick(page, 6);
    await walk(page, f.wildRoom, f.l.apron);
    await walk(page, f.room, { ...f.home, x: 12, y: 10 }); await tick(page, 40); s = await snapshot(page);
    expect(s.scientist.roomId).toBe(f.room); expect(s.door.breached).toBe(true); expect(s.door.condition).toBe(condition);
    expect(s.health).toBeGreaterThan(0); expect(errors).toEqual([]);
  });
  test(`${renderer}: intact shelter holds a finite attempt; hidden occupants cannot renew target memory or cause a mandatory wave`, async ({ page }) => {
    const f = await setup(page, renderer, { guarded: false });
    await tick(page, 15); expect((await snapshot(page)).beasts.actors).toHaveLength(0);
    await animal(page, f); await tick(page, 1); let s = await snapshot(page);
    expect(s.door.condition, JSON.stringify({ door: s.door, structure: s.structure, beast: s.beasts.actors[0] })).toBeLessThan(100); expect(s.door.breached).not.toBe(true);
    expect(s.knowledge.sightings).toHaveLength(0);
    expect(s.events.some(e => e.message.includes('Rimefang original-regional-animal'))).toBe(false);
    const memory = s.beasts.actors[0].rememberedUntil;
    await reload(page, renderer); await tick(page, 20); s = await snapshot(page);
    expect(s.door.breached).not.toBe(true); expect(s.beasts.actors).toHaveLength(1);
    expect(s.beasts.actors[0].rememberedUntil).toBe(memory);
    expect(['roam', 'return']).toContain(s.beasts.actors[0].behavior);
    const held = s.door.condition; await tick(page, 20); expect((await snapshot(page)).door.condition).toBe(held);
    await animal(page, f, { condition: 'none' }); await tick(page, 15); s = await snapshot(page);
    expect(s.door.condition).toBe(held); expect(s.beasts.actors[0].lastTarget).toBeNull(); expect(s.health).toBe(100);
    expect(s.structure.composition).toEqual({ primary: 'wood' });
    // Genuine saved reinforcement must not be scrubbed by the correction to
    // type-specific defaults. It is a different, stronger material input.
    await page.evaluate(() => {
      const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
      s.doors[s.fieldRefuge.site.doorId].materialComposition = { primary: 'wood', reinforcement: 'iron' };
      d.importSurveyExpeditionTestState(s);
    });
    await tick(page, 0); // Persist the explicit material fixture before a real page reload.
    await reload(page, renderer); await animal(page, f); await tick(page, 3); s = await snapshot(page);
    expect(s.structure.composition).toEqual({ primary: 'wood', reinforcement: 'iron' }); expect(s.door.condition).toBe(held);
  });
}
test('an unseen breach during an original detachment withdrawal neither broadcasts damage nor refreshes a received report', async ({ page }) => {
  const f = await setup(page, 'canvas', { condition: 26, priorReport: true });
  await animal(page, f, { away: true });
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey, o = e.fieldForce.operation;
    // A prior withdrawal on the accepted route, not new post rights. These
    // original people keep the local encounter active but cannot see this
    // distant barrier or provide current remote knowledge about it.
    o.phase = 'returning';
    const route = o.plan.route.filter(c => c.x < 30 && c.x > 23);
    e.fieldForce.members.forEach((m, i) => { m.phase = 'returning'; m.actor.mapCell = route[i];
      m.actor.nextMoveAt = s.clock + 20; m.actor.roomId = e.wilderness.roomId; });
    d.importSurveyExpeditionTestState(s);
  });
  const before = await snapshot(page); await tick(page, 1); let s = await snapshot(page);
  expect(s.door.breached).toBe(true); expect(s.force.operation.phase).toBe('returning');
  expect(s.force.report).toEqual(before.force.report);
  expect(s.force.members.every(m => !m.actor.observed['original-regional-animal'])).toBe(true);
  expect(s.events.filter(e => /took .*damage from a creature|struck the door/.test(e.message))).toHaveLength(0);
  await reload(page, 'canvas'); s = await snapshot(page);
  expect(s.door.breached).toBe(true); expect(s.force.report).toEqual(before.force.report);
});
