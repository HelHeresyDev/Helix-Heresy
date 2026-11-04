const { test, expect } = require('@playwright/test');
const { snap, act, tick, walk, prepare, finish } = require('./helpers/divine-submission-visit');
test.setTimeout(1200000);
const reign = p => p.evaluate(() => window.helixHeresyDebug.divineReignSnapshot());
const access = (p, kind, id) => p.evaluate(({ kind, id }) => window.helixHeresyDebug.divineWayfindingAction(kind, id), { kind, id });
async function finishHeld(p) {
  const r = await reign(p); if (r.access.job) await tick(p, r.access.job.seconds - r.access.job.progress);
}
async function reload(p) { await p.reload(); await p.locator('#loadLastSaveBtn').click(); await p.locator('[data-workspace-tab="visits"]').click(); }
async function ready(p, index = 0) {
  for (let n = 0; n < 6 && !(await snap(p)).contexts[index].context.combatReady; n++) await tick(p);
  expect((await snap(p)).contexts[index].context.combatReady).toBe(true);
}
async function approach(p, id, roomId) {
  const s = await snap(p), a = s.saved.bodies.find(a => a.id === id).mapCell;
  const cell = [{ ...a, x: a.x + 1 }, { ...a, y: a.y - 1 }, { ...a, x: a.x - 1 }, { ...a, y: a.y + 1 }]
    .find(c => c.x >= 8 && c.x <= 19 && c.y >= 8 && c.y <= 17
      && !s.saved.bodies.some(b => b.mapCell.x === c.x && b.mapCell.y === c.y && b.mapCell.z === c.z));
  expect(cell).toBeTruthy(); await walk(p, cell, roomId);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: supplied discovery, actual remote divine supremacy, continued reign and saved consequences`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  // Original depleted reserve is a prior finite source input, never a mid-fight
  // refill or injected wound. Actual ordinary force demonstrates penetration;
  // the researched, supplied resonant finisher supplies present lethal leverage.
  const id = await prepare(page, renderer, 'protectFollowers', renderer === 'dom', true, true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  let s = await snap(page); const original = s.owners.originals;
  expect(s.known).toEqual([]); expect((await reign(page)).saved.achievedAt).toBeNull();
  expect(await access(page, 'review')).toBe(true); expect((await reign(page)).campaign.divineRule).toBeNull();
  const stock = s.stacks.reduce((n, i) => n + i.quantity, 0), mana = s.mana;
  await page.locator('[data-divine-wayfinding-action="scan"]').click(); await tick(page, 10);
  if (renderer === 'canvas') { await reload(page); expect((await reign(page)).access.job.progress).toBe(10); }
  await finishHeld(page);
  let r = await reign(page); expect(r.access.traces).toHaveLength(1); expect((await snap(page)).known).toEqual([]);
  expect(JSON.stringify(r.access)).not.toContain('god:');
  expect((await snap(page)).stacks.reduce((n, i) => n + i.quantity, 0)).toBe(stock - 1);
  const trace = r.access.traces[0].id;
  // Finishing a held cast resumes prior laboratory orders. Complete any real
  // packing/movement before beginning another stationary procedure.
  await finish(page);
  expect(await access(page, 'outbound', trace)).toBe(true);
  await tick(page, 4); const partial = (await reign(page)).access.job;
  if (renderer === 'dom') { await reload(page); expect((await reign(page)).access.job).toEqual(partial); }
  await finishHeld(page);
  r = await reign(page); s = await snap(page);
  expect(r.access.away).toBe(true); expect(s.mana).toBeLessThan(mana - 10);
  const roomId = s.contexts[0].context.roomId, z = s.cell.z;
  expect(roomId).toMatch(/^divine-visited-ground-/); expect(s.saved.bodies[0].roomId).toBe(roomId);
  expect(s.saved.bodies[0].health).toBe(2000); expect(s.saved.bodies[0].stamina).toBe(550);
  await walk(page, { x: 10, y: 15, z }, roomId);
  console.info(`${renderer}: measured holy-site arrival and ordinary physical walking completed`);
  const ids = s.saved.bodies.map(a => a.id);
  for (const actorId of ids) { expect(await act(page, 'examine', actorId)).toBe(true); await tick(page, 120); }
  s = await snap(page); expect(s.saved.bodies.every(a => a.identified)).toBe(true);
  console.info(`${renderer}: original individuals personally examined`);
  await approach(page, id, roomId);
  expect(await act(page, 'strike', id)).toBe(true);
  expect(await act(page, 'guard', id)).toBe(true); await tick(page, 2); await ready(page);
  expect(await act(page, 'demand', id), JSON.stringify((await snap(page)).contexts)).toBe(true);
  expect((await snap(page)).saved.bodies[0].submission.status).toBe('accepted');
  console.info(`${renderer}: real force and present lethal capability obtained submission`);
  if (renderer === 'dom') {
    expect((await reign(page)).saved.achievedAt).toBeNull(); // The other original was not dropped.
    const other = ids[1];
    await approach(page, other, roomId);
    expect(await act(page, 'strike', other)).toBe(true); expect(await act(page, 'guard', other)).toBe(true); await tick(page, 2); await ready(page, 1);
    expect(await act(page, 'demand', other)).toBe(true);
    expect((await snap(page)).saved.bodies[1].submission.status).toBe('refused');
    expect(await act(page, 'demand', other)).toBe(false);
    let fired = false;
    for (let n = 0; n < 30; n++) {
      s = await snap(page); const observed = s.known.find(a => a.id === other);
      if (s.contexts[1].context.combatReady && observed?.pending?.releaseAt - s.clock >= 2.99) {
        expect(await act(page, 'resonance', other)).toBe(true); fired = true; await tick(page, 3); break;
      }
      await tick(page);
    }
    expect(fired).toBe(true); expect((await snap(page)).saved.bodies[1].death).toBeTruthy();
  }
  r = await reign(page); expect(r.saved.current).toBe(true); expect(r.saved.achievedAt).not.toBeNull();
  expect(r.saved.recognizedAt).toBeNull();
  expect(await access(page, 'review')).toBe(true);
  const historical = (await reign(page)).campaign.divineRule; expect(historical).toBeTruthy();
  expect(await access(page, 'return')).toBe(true); await finishHeld(page);
  expect((await reign(page)).access.away).toBe(false);
  if (renderer === 'dom') {
    await finish(page);
    expect(await access(page, 'pack')).toBe(true); await finish(page);
    // The original mana pool must recover through real elapsed simulation;
    // there is no test refill and no fresh divine reserve on either side.
    const manaNow = (await snap(page)).mana;
    if (manaNow < 60) await tick(page, Math.ceil((60 - manaNow) * 600) + 60);
    expect((await snap(page)).mana).toBeGreaterThanOrEqual(60);
    await finish(page);
    expect(await access(page, 'outbound', trace)).toBe(true); await finishHeld(page);
    s = await snap(page);
    await approach(page, id, roomId);
    expect(await act(page, 'strike', id)).toBe(true); expect((await snap(page)).saved.bodies[0].submission.status).toBe('rebelled');
    expect(await act(page, 'guard', id)).toBe(true); await tick(page, 2); await ready(page);
    expect((await reign(page)).saved.current).toBe(false);
    expect(await access(page, 'review')).toBe(true); expect((await reign(page)).public.knownLoss).toBe(true);
    expect(await act(page, 'demand', id), JSON.stringify((await snap(page)).contexts)).toBe(true);
    expect((await reign(page)).saved.current).toBe(true); expect((await reign(page)).campaign.divineRule).toEqual(historical);
    const before = await reign(page), bodies = (await snap(page)).saved.bodies;
    const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
    await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-divine-reign.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click();
    expect((await reign(page)).saved.achievedAt).toBe(before.saved.achievedAt); expect((await snap(page)).saved.bodies).toEqual(bodies);
    expect((await reign(page)).campaign.divineRule).toEqual(historical);
  } else { await reload(page); expect((await reign(page)).campaign.divineRule).toEqual(historical); }
  s = await snap(page); r = await reign(page); const frozen = { saved: s.saved, owners: s.owners, reign: r.saved, campaign: r.campaign, clock: s.clock };
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceTestRunTime(1000); });
  s = await snap(page); r = await reign(page);
  expect({ saved: s.saved, owners: s.owners, reign: r.saved, campaign: r.campaign, clock: s.clock }).toEqual(frozen);
  expect(await access(page, 'review')).toBe(false); expect(s.owners.originals).toEqual(original);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
