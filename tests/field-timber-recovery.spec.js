const { test, expect } = require('@playwright/test');
const Builder = require('../field-builder');
const Timber = require('../fallen-timber');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(from = 0) {
  const context = { worldId: 'world', siteId: 'wild', seed: 'recovery', truth: { potentialPermille: { timberFiber: 1000 }, surfaceAccessibilityPermille: 1000 } };
  const baseline = { worldId: 'world', placeId: 'wild', bounds: { x: 1, y: 1 }, cells: Array.from({ length: 30 }, (_, n) => ({ x: 1 + n % 6, y: 1 + Math.floor(n / 6), z: 22 })) };
  const site = Timber.create(context, baseline, 'field', () => true), node = site.nodes[0];
  Object.assign(node, { remaining: 1, stackId: 'original-trunk', effort: from, inspected: { at: 0, workable: true } });
  const trunk = { id: node.stackId, key: 'fallenTrunk', section: 'resources', quantity: 1, unitMassKg: 11, unitVolumeL: 26,
    cell: copy(node.cell), roomId: 'field', reservedTaskId: Timber.sourceClaim(node), sourceLabels: ['original woodland'], materialComposition: { primary: 'wood' } };
  const cell = { ...node.cell, x: node.cell.x - 1 }, city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100 };
  const institution = { id: 'works:b', capacityBand: 'functional' }, e = { source: { cityId: 'b', populationSourceId: city.assetId, worksId: institution.id },
    entry: cell, roomId: 'ground', wilderness: { roomId: 'field', gate: cell } };
  const backing = Builder.source(city, institution, null, e), s = Builder.create(backing, e, 0);
  const tool = { id: 'saw', current: 40, carriedBy: '', reservedTaskId: '' }, stack = { id: 'saw-stack', key: 'handSaw', quantity: 1,
    toolInstanceId: tool.id, carriedBy: '', reservedTaskId: '' };
  const signature = Timber.trunkSignature(node, trunk), offer = { operation: 'recoverTimber', site: { worldId: 'world', siteId: 'wild', roomId: 'field' },
    part: Builder.recoveryPart(node), nodeId: node.id, sourceStackId: node.stackId, sourceRemaining: 1, sourceSignature: signature, targetKey: signature,
    from, workCell: cell, inputs: [], tools: [{ key: 'handSaw', toolId: tool.id, stackId: stack.id, condition: 40, cell }] };
  const c = { source: backing, alive: true, capable: true, originalBody: true, custody: false, originalTrip: true, bodyEpoch: 1,
    visitId: 'visit', tripId: 'trip', near: true, busy: false, atGround: true, routeOk: true, toolsReturned: true, hazards: [] };
  return { site, node, trunk, stacks: [trunk], tools: [{ key: 'handSaw', stack, tool }], s, offer, c, wallet: { money: 500 } };
}
function hire(f) {
  const q = Builder.review(f.s, f.c, f.offer, 0); expect(q).toMatchObject({ upfront: 88, seconds: 7200 });
  expect(Builder.hire(f.s, f.c, f.offer, q, f.wallet, 0, (o, id) => {
    f.node.commissionClaim = id; for (const x of [f.tools[0].tool, f.tools[0].stack]) Object.assign(x, { carriedBy: f.s.actor.id, reservedTaskId: id });
    return { tools: copy(o.tools), inputs: [] };
  })).toBe(true);
  f.s.phase = 'onSite'; f.s.contract.startedAt = 1; f.s.actor.mapCell = copy(f.offer.workCell); f.s.actor.roomId = 'field';
}
function context(f, extra = {}) {
  const k = f.s.contract, cut = k.recovery.stage === 'cut', log = k.recovery.log;
  return { ...f.c, wilderness: true, controlled: false, worldId: 'world', siteId: 'wild', roomId: 'field', free: true,
    actorId: f.s.actor.id, employmentAuthorized: Builder.control(f.s, f.c), claimId: k.id,
    commission: { operation: 'recoverTimber', action: cut ? 'cut' : 'saw', nodeId: f.node.id, inputId: cut ? '' : log.id,
      partId: f.offer.part.id, targetKey: cut ? f.offer.sourceSignature : log.signature, orderKey: f.offer.targetKey, toolId: 'saw', toolStackId: 'saw-stack' },
    groundPresent: true, inputAccessible: true, reachable: true, visible: true, threatened: false, busy: false, atHead: true,
    cell: f.offer.workCell, workCell: f.offer.workCell, staminaCost: cut ? 6 : 10, stamina: 100, seconds: cut ? 600 : 1200, ...extra };
}
function start(f, now = 2) {
  const c = context(f), cut = c.commission.action === 'cut';
  const p = Timber.plan(f.site, cut ? f.node : null, cut ? 'cut' : 'saw', c, f.tools, f.stacks,
    cut ? null : f.stacks.find(i => i.id === f.s.contract.recovery.log.id)); expect(p).toBeTruthy();
  f.s.job = Timber.begin(p, Builder.claimId(f.s), now, f.tools, f.stacks); return f.s.job;
}
function progress(f, now) { Timber.advance(f.site, f.s.job, context(f), f.tools, f.stacks, f.s.job.lastAt + 1);
  Timber.advance(f.site, f.s.job, context(f), f.tools, f.stacks, now); }
function cut(f) {
  const j = f.s.job; progress(f, j.lastAt + j.required + 2);
  const log = { ...copy(f.trunk), id: 'actual-cut-log', key: 'fieldLog', cell: copy(f.offer.workCell), reservedTaskId: '', unitMassKg: 11, unitVolumeL: 26 };
  f.stacks.push(log);
  expect(Timber.finish(f.site, j, context(f), f.tools, f.stacks, j.lastAt, [{ id: log.id, key: 'fieldLog', quantity: 1 }])).toBeTruthy();
  expect(Builder.complete(f.s, j.lastAt)).toBe(false);
  expect(Builder.cutToSaw(f.s, { id: log.id, signature: Timber.logSignature(log), cell: log.cell }, j.lastAt)).toBe(true);
  log.reservedTaskId = f.s.contract.id; f.node.commissionClaim = '';
  for (const x of [f.tools[0].tool, f.tools[0].stack]) x.reservedTaskId = f.s.contract.id;
  return log;
}
test('recovery terms name one original portion, forbid mixed/batched orders and account for retained cutting without discounting sawing', () => {
  const f = fixture(.5); expect(Builder.validOrder(f.offer)).toBe(true); expect(Builder.toolWear(f.offer, 'handSaw')).toBe(10);
  for (const change of [{ components: [f.offer] }, { sourceRemaining: 0 }, { sourceStackId: '' }, { targetKey: 'other' }, { from: 1 },
    { part: { ...f.offer.part, seconds: 1 } }, { inputs: [{ stackId: 'free-log' }] }]) expect(Builder.validOrder({ ...f.offer, ...change })).toBeFalsy();
  expect(Builder.order([f.offer, f.offer])).toBeNull(); hire(f); expect(f.wallet.money).toBe(412);
  const j = start(f); expect(j.required).toBe(300); expect(j.wear).toBe(2); cut(f); const saw = start(f, 1000);
  expect(saw.required).toBe(1200); expect(saw.wear).toBe(8); expect(f.s.contract.startedAt).toBe(1);
});
test('cutting creates one bound intermediate, depletes only one finite portion and completes exactly one private recovery', () => {
  const f = fixture(); hire(f); const known = Builder.publicView(f.s), timberKnown = Timber.publicView(f.site); start(f); const log = cut(f);
  expect(f.node.remaining).toBe(0); expect(f.trunk.quantity).toBe(0); expect(log.quantity).toBe(1); expect(Builder.validRecovery(f.s)).toBe(true);
  expect(Builder.cutToSaw(f.s, { id: log.id, signature: Timber.logSignature(log), cell: log.cell }, 700)).toBe(false);
  start(f, 700); progress(f, 1902); const j = f.s.job, outputs = [{ id: 'lumber', key: 'lumber', quantity: 2 }, { id: 'offcut', key: 'woodDebris', quantity: 1 }];
  expect(Timber.finish(f.site, j, context(f), f.tools, f.stacks, 1902, outputs)).toBeTruthy(); expect(Builder.complete(f.s, 1902)).toBe(true);
  expect(log.quantity).toBe(0); expect(f.tools[0].tool.current).toBe(28); expect(f.s.contract.startedAt).toBe(1);
  expect(f.s.contract.completed).toHaveLength(1); expect(f.s.contract.completed[0]).toMatchObject({ operation: 'recoverTimber', inputId: log.id, nodeId: f.node.id, outputs });
  expect(Builder.complete(f.s, 1903)).toBe(false); expect(Timber.finish(f.site, j, context(f), f.tools, f.stacks, 1903, outputs)).toBeNull();
  expect(Builder.publicView(f.s)).toEqual(known); expect(Timber.publicView(f.site)).toEqual(timberKnown);
});
for (const stage of ['cut', 'saw']) test(`${stage} stage survives a save and pauses without backfill on unsupported work or self-care`, () => {
  let f = fixture(); hire(f); start(f); if (stage === 'saw') { cut(f); start(f, 700); }
  progress(f, f.s.job.lastAt + 51); const progressBefore = f.s.job.progress;
  f = copy(f); f.node = f.site.nodes[0]; f.trunk = f.stacks.find(i => i.id === 'original-trunk');
  expect(Builder.validRecovery(f.s)).toBe(true); expect(Timber.reason(f.site, f.s.job, context(f), f.tools, f.stacks)).toBe('');
  for (const changed of [{ groundPresent: false }, { atHead: false }, { threatened: true }, { capable: false }, { bodyEpoch: 2 }, { employmentAuthorized: false }]) {
    Timber.advance(f.site, f.s.job, context(f, changed), f.tools, f.stacks, f.s.job.lastAt + 1000);
    Timber.advance(f.site, f.s.job, context(f), f.tools, f.stacks, f.s.job.lastAt + 1); expect(f.s.job.progress).toBe(progressBefore);
  }
});
test('only the inspected reserved trunk portion is authorized; a personal task, changed source or extraction scope cannot bypass it', () => {
  const f = fixture(); hire(f); const c = context(f);
  for (const extra of [{ controlled: true }, { claimId: 'other' }, { commission: { ...c.commission, nodeId: 'other' } },
    { commission: { ...c.commission, action: 'saw' } }, { commission: { ...c.commission, operation: 'saw' } }])
    expect(Timber.plan(f.site, f.node, 'cut', { ...c, ...extra }, f.tools, f.stacks)).toBeNull();
  expect(Timber.plan(f.site, f.node, 'cut', { ...c, actorId: 'scientist', claimId: '' }, f.tools, f.stacks)).toBeNull();
  const j = start(f); progress(f, 53); f.trunk.sourceLabels.push('altered');
  expect(Timber.reason(f.site, j, context(f), f.tools, f.stacks)).toContain('original inspected fallen trunk');
  Timber.advance(f.site, j, context(f), f.tools, f.stacks, 1000); expect(j.progress).toBe(50);
});
test('an unrelated log or forged transition cannot replace the intermediate, and a consumed trunk is irrelevant to its later sawing', () => {
  const f = fixture(); hire(f); start(f);
  expect(Builder.cutToSaw(f.s, { id: 'invented', signature: 'fake', cell: f.offer.workCell }, 10)).toBe(false);
  const log = cut(f), saved = copy(f.s);
  for (const alter of [s => { s.contract.recovery.log.id = 'substitute'; }, s => { s.contract.recovery.cutReceipt.taskId = 'other'; },
    s => { s.contract.recovery.cutReceipt.actorId = 'replacement'; }, s => { s.contract.recovery.log.cell.x++; }]) {
    const s = copy(saved); alter(s); expect(Builder.validRecovery(s)).toBe(false);
  }
  f.site.nodes = []; const c = context(f); expect(Timber.plan(f.site, null, 'saw', c, f.tools, f.stacks, log)).toBeTruthy();
  const other = { ...log, id: 'other-log' }; expect(Timber.plan(f.site, null, 'saw', c, f.tools, [...f.stacks, other], other)).toBeNull();
});
for (const stage of ['cut', 'saw']) test(`cancelling ${stage} preserves actual intermediate state, partial effort and spent wear without creating final goods`, () => {
  const f = fixture(); hire(f); start(f); let log;
  if (stage === 'saw') { log = cut(f); start(f, 700); }
  progress(f, f.s.job.lastAt + 51); const wear = f.tools[0].tool.current;
  expect(Timber.cancel(f.s.job, f.tools, f.stacks, f.s.job.lastAt)).toBe(true);
  expect(f.tools[0].tool.current).toBe(wear); expect(f.s.contract.completed).toEqual([]);
  if (stage === 'cut') { expect(f.node.remaining).toBe(1); expect(f.node.effort).toBeGreaterThan(0); expect(f.site.receipts).toEqual([]); }
  else { expect(f.node.remaining).toBe(0); expect(log.quantity).toBe(1); expect(log.reservedTaskId).toBe(''); expect(f.site.sawEffort[log.id].fraction).toBeGreaterThan(0); }
});
