const { test, expect } = require('@playwright/test');
const { snap, act, tick, walk, prepare } = require('./helpers/divine-submission-visit');
test.setTimeout(600000);
function errorsFor(page) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept()); return errors;
}
async function demand(page, id) {
  const button = page.locator(`[data-divine-body-action="demand"][data-actor-id="${id}"]`);
  const s = await snap(page); expect(await button.isEnabled(), JSON.stringify(s.contexts)).toBe(true); await button.click();
  return snap(page);
}
test('dom: actual submission, broken terms, fresh physical enforcement, saved/imported continuity and final-death freeze', async ({ page }) => {
  // A stronger original body and finite prior stock, not repaired injuries:
  // the first real wound must leave enough health for later conscious assent.
  const errors = errorsFor(page), id = await prepare(page, 'dom', 'protectFollowers', false, true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  let s = await demand(page, id); expect(s.saved.bodies[0].submission.status).toBe('accepted');
  const healthAfterDemonstration = s.saved.bodies[0].health;
  const original = s.owners.originals, faithful = s.owners.records[0].god.worshipSources;
  expect(await act(page, 'hold', id)).toBe(true);
  const before = (await snap(page)).saved.bodies[0];
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snap(page)).saved.bodies[0]).toEqual(before);
  // Its original ward and retaliation already spent this source's reserve.
  // The separate Canvas case proves useful finite service before exhaustion.
  s = await snap(page);
  expect(s.owners.records[0].god.power.reserve).toBe(0); expect(s.saved.bodies[0].submission.status).toBe('accepted');
  expect(await act(page, 'protect', id)).toBe(false);
  // Walk to the original actor's current adjacent ground and actually strike.
  const cell = s.saved.bodies[0].mapCell;
  await walk(page, { x: cell.x === 19 ? 18 : cell.x + 1, y: cell.y, z: cell.z });
  // Declaring the attack breaks the terms before its real physical release.
  // Only the actual resulting new wound can support reassertion afterward.
  expect(await act(page, 'strike', id)).toBe(true); await tick(page);
  s = await snap(page); expect(s.saved.bodies[0].submission.status).toBe('rebelled');
  expect(await act(page, 'hold', id)).toBe(false);
  expect(s.saved.bodies[0].lastDamage.serial).toBeGreaterThan(s.saved.bodies[0].submission.forceSerial);
  expect(await act(page, 'guard', id)).toBe(true);
  for (let n = 0; n < 5 && !(await snap(page)).contexts[0].context.combatReady; n++) await tick(page);
  s = await demand(page, id); expect(s.saved.bodies[0].submission.status).toBe('accepted');
  expect(s.saved.bodies[0].submission.history.filter(r => r.kind === 'accepted')).toHaveLength(2);
  expect(s.saved.bodies[0].health).toBeLessThan(healthAfterDemonstration); expect(s.injuries.some(i => i.actorId === id)).toBe(true);
  const saved = s.saved, owners = s.owners;
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-submission.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.saved.bodies).toEqual(saved.bodies); expect(s.owners.records).toEqual(owners.records);
  expect(s.owners.originals).toEqual(original); expect(s.owners.records[0].god.worshipSources).toEqual(faithful);
  const frozen = { saved: s.saved, owners: s.owners, stacks: s.stacks, clock: s.clock };
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceTestRunTime(1000); });
  s = await snap(page); expect({ saved: s.saved, owners: s.owners, stacks: s.stacks, clock: s.clock }).toEqual(frozen);
  expect(await act(page, 'release', id)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
test('canvas: submitted original supplies actual finite protection against a physically approaching original opponent', async ({ page }) => {
  const errors = errorsFor(page), id = await prepare(page, 'canvas', 'protectFollowers', true);
  let s = await demand(page, id); expect(s.saved.bodies[0].submission.status).toBe('accepted');
  const other = s.saved.bodies[1].id, initialReserve = s.owners.records[0].god.power.reserve;
  // The original descended individual is already present, not spawned as a
  // reward or an encounter outcome. Ordinary provocation and AI cause the hit.
  expect(await act(page, 'lash', other)).toBe(true); await tick(page);
  expect(await act(page, 'protect', id)).toBe(true);
  expect(await act(page, 'guard', id)).toBe(true);
  for (let n = 0; n < 45; n++) {
    await tick(page); s = await snap(page);
    if (s.saved.bodies[0].submission.command.status === 'unavailable') break;
  }
  s = await snap(page); const body = s.saved.bodies[0], duty = body.submission.command;
  expect(duty.absorbed, JSON.stringify({ bodies: s.saved.bodies, contexts: s.contexts, health: s.health })).toBeGreaterThan(0);
  expect(duty.status).toBe('unavailable'); expect(s.owners.records[0].god.power.reserve).toBe(0);
  expect(body.stamina).toBeLessThan(body.maxStamina); expect(body.health).toBe(200); expect(s.health).toBeGreaterThan(0);
  expect(initialReserve).toBeGreaterThan(0); expect(await act(page, 'protect', id)).toBe(false);
  const snapshot = (await snap(page)).saved.bodies[0].submission;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snap(page)).saved.bodies[0].submission).toEqual(snapshot);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
test('canvas: original independent refusal survives reload and unchanged repeated demands', async ({ page }) => {
  const errors = errorsFor(page), id = await prepare(page, 'canvas', 'opposeRivals');
  let s = await demand(page, id); expect(s.saved.bodies[0].submission.status).toBe('refused');
  const history = s.saved.bodies[0].submission.history;
  expect(await act(page, 'demand', id)).toBe(false); expect(await act(page, 'protect', id)).toBe(false);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.saved.bodies[0].submission.history).toEqual(history);
  expect(await act(page, 'demand', id)).toBe(false); expect(s.saved.bodies[0].health).toBe(200);
  expect(errors).toEqual([]);
});
