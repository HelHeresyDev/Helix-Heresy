const { test, expect } = require('@playwright/test');
const Stone = require('../surface-stone');
const Builder = require('../field-builder');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const cell = { x: 27, y: 13, z: 22 }, workCell = { ...cell, x: 26 };
  const world = { worldId: 'world', siteId: 'wild', seed: 'stone', truth: { potentialPermille: { constructionStone: 1000 },
    typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } };
  const site = Stone.create(world, { worldId: 'world', placeId: 'wild', rocks: [cell] }), node = site.nodes[0];
  node.inspected = { at: 0, workable: true, bodyEpoch: 1 };
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100 }, institution = { id: 'works:b', capacityBand: 'functional' };
  const e = { source: { cityId: 'b', populationSourceId: city.assetId, worksId: institution.id }, entry: workCell, roomId: 'ground',
    wilderness: { roomId: 'field', gate: workCell } };
  const source = Builder.source(city, institution, null, e), s = Builder.create(source, e, 0);
  const tools = Object.keys(Stone.WEAR).map(key => ({ key, tool: { id: `tool-${key}`, current: 50, carriedBy: '', reservedTaskId: '' },
    stack: { id: `stack-${key}`, key, quantity: 1, toolInstanceId: `tool-${key}`, carriedBy: '', reservedTaskId: '', roomId: 'field', cell: workCell } }));
  const offer = { operation: 'recoverStone', site: { worldId: 'world', siteId: 'wild', roomId: 'field' }, nodeId: node.id, targetKey: Stone.targetKey(node),
    from: 0, part: Builder.stonePart(node), workCell, inputs: [], tools: tools.map(t => ({ key: t.key, toolId: t.tool.id, stackId: t.stack.id, condition: 50, cell: workCell })) };
  const c = { source, alive: true, capable: true, originalBody: true, originalTrip: true, custody: false, near: true, busy: false,
    atGround: true, routeOk: true, toolsReturned: true, bodyEpoch: 1, visitId: 'visit', tripId: 'trip', hazards: [], site: offer.site };
  return { site, node, tools, s, offer, c, wallet: { money: 500 } };
}
function hire(f) {
  f.offer.from = Stone.effort(f.node); f.offer.tools.forEach(t => { t.condition = f.tools.find(x => x.tool.id === t.toolId).tool.current; });
  const q = Builder.review(f.s, f.c, f.offer, 0); expect(q).toMatchObject({ upfront: 88, seconds: 7200 });
  expect(Builder.hire(f.s, f.c, f.offer, q, f.wallet, 0, (o, id) => {
    f.node.commissionClaim = id;
    for (const t of f.tools) for (const object of [t.tool, t.stack]) Object.assign(object, { carriedBy: f.s.actor.id, reservedTaskId: id });
    return { inputs: [], tools: copy(o.tools) };
  })).toBe(true);
  f.s.phase = 'onSite'; f.s.contract.startedAt = 1; f.s.actor.roomId = 'field'; f.s.actor.mapCell = copy(f.offer.workCell);
}
function context(f, extra = {}) {
  return { ...f.c, ...f.offer.site, actorId: f.s.actor.id, employmentAuthorized: Builder.control(f.s, f.c), claimId: f.s.contract.id,
    commission: { operation: 'recoverStone', nodeId: f.node.id, partId: f.offer.part.id, targetKey: f.offer.targetKey, tools: f.offer.tools },
    wilderness: true, controlled: false, free: true, facePresent: true, reachable: true, visible: true, atHead: true,
    cell: f.offer.workCell, workCell: f.offer.workCell, seconds: 900, staminaCost: 8, stamina: 100, threatened: false, ...extra };
}
function start(f, at = 2) {
  const plan = Stone.plan(f.site, f.node, 'recover', context(f), f.tools); expect(plan).toBeTruthy();
  f.s.job = Stone.begin(plan, Builder.claimId(f.s), at, f.tools, f.site); return f.s.job;
}
function work(f, seconds) {
  const j = f.s.job; Stone.advance(f.site, j, context(f), f.tools, j.lastAt + 1);
  Stone.advance(f.site, j, context(f), f.tools, j.lastAt + seconds);
}
test('one-block terms bind two distinct original tools and a face, never a batch, mixed order or hidden reserve total', () => {
  const f = fixture(); expect(Builder.validOrder(f.offer)).toBe(true);
  for (const wrong of [{ components: [f.offer] }, { nodeId: '' }, { targetKey: '' }, { remaining: 3 }, { sourceRemaining: 3 },
    { part: { ...f.offer.part, seconds: 1 } }, { from: 1 }, { tools: [f.offer.tools[0], f.offer.tools[0]] }, { inputs: [{ quantity: 1 }] }])
    expect(Builder.validOrder({ ...f.offer, ...wrong })).toBeFalsy();
  expect(Builder.order([f.offer, f.offer])).toBeNull();
  const key = Stone.targetKey(f.node); f.node.remaining = 99; expect(Stone.targetKey(f.node)).toBe(key);
  const q = Builder.review(f.s, f.c, f.offer, 0);
  expect(JSON.stringify(q)).not.toMatch(/"(remaining|sourceRemaining|potentialPermille|typicalDepth)":/);
  expect(Builder.hire(f.s, f.c, { ...f.offer, workCell: { ...f.offer.workCell, x: 25 } }, q, f.wallet, 1, () => ({}))).toBe(false);
  expect(f.wallet.money).toBe(500); expect(f.s.actor.skills.materialsScience).toBeUndefined();
});
test('personal partial dressing can transfer to delegated work and back without losing effort or duplicating wear', () => {
  const f = fixture();
  for (const t of f.tools) for (const o of [t.tool, t.stack]) o.carriedBy = 'scientist';
  const personal = { ...f.c, ...f.offer.site, wilderness: true, controlled: false, free: true, facePresent: true,
    reachable: true, visible: true, atHead: true, cell: f.offer.workCell, workCell: f.offer.workCell, seconds: 900, staminaCost: 8, stamina: 100 };
  let j = Stone.begin(Stone.plan(f.site, f.node, 'recover', personal, f.tools), 'personal-one', 0, f.tools, f.site);
  Stone.advance(f.site, j, personal, f.tools, 1); Stone.advance(f.site, j, personal, f.tools, 451);
  expect(Stone.cancel(j, f.tools, 451, f.site)).toBe(true); expect(Stone.effort(f.node)).toBe(.5);
  hire(f); j = start(f); expect(j.required).toBe(450); expect(j.staminaCost).toBe(4); expect(j.tools.map(t => t.wear)).toEqual([2, 3]);
  work(f, 225); expect(Stone.effort(f.node)).toBe(.75); Stone.cancel(j, f.tools, j.lastAt, f.site);
  for (const t of f.tools) for (const o of [t.tool, t.stack]) o.carriedBy = 'scientist';
  const resumed = Stone.begin(Stone.plan(f.site, f.node, 'recover', personal, f.tools), 'personal-two', 1000, f.tools, f.site);
  expect(resumed.required).toBe(225); expect(resumed.staminaCost).toBe(2);
  Stone.advance(f.site, resumed, personal, f.tools, 1001); Stone.advance(f.site, resumed, personal, f.tools, 1226);
  expect(Stone.finish(f.site, resumed, personal, f.tools, 1226, 'actual-block')).toBeTruthy();
  expect(f.tools.map(t => t.tool.current)).toEqual([46, 44]); expect(Stone.effort(f.node)).toBe(0);
});
test('saved delegated work pauses without backfill, completes once, depletes one portion and keeps private outcomes dated', () => {
  let f = fixture(); hire(f); const initial = f.node.remaining, known = Builder.publicView(f.s), stoneKnown = Stone.publicView(f.site);
  start(f); work(f, 450); f = copy(f); f.node = f.site.nodes[0]; expect(Stone.reason(f.site, f.s.job, context(f), f.tools)).toBe('');
  const progress = f.s.job.progress;
  for (const changed of [{ facePresent: false }, { atHead: false }, { threatened: true }, { bodyEpoch: 2 }, { employmentAuthorized: false }]) {
    Stone.advance(f.site, f.s.job, context(f, changed), f.tools, f.s.job.lastAt + 1000);
    Stone.advance(f.site, f.s.job, context(f), f.tools, f.s.job.lastAt + 1); expect(f.s.job.progress).toBe(progress);
  }
  work(f, 450); const now = f.s.job.lastAt;
  expect(Stone.finish(f.site, f.s.job, context(f), f.tools, now, 'actual-block')).toBeTruthy(); expect(Builder.complete(f.s, now)).toBe(true);
  expect(f.node.remaining).toBe(initial - 1); expect(f.node.commissionClaim).toBe(''); expect(f.tools.map(t => t.tool.current)).toEqual([46, 44]);
  expect(f.s.contract.startedAt).toBe(1); expect(f.s.contract.completed[0]).toMatchObject({ operation: 'recoverStone', outputId: 'actual-block', quantity: 1 });
  expect(Builder.publicView(f.s)).toEqual(known); expect(Stone.publicView(f.site)).toEqual(stoneKnown);
  expect(Builder.complete(f.s, now + 1)).toBe(false); expect(Stone.finish(f.site, f.s.job, context(f), f.tools, now + 1, 'duplicate')).toBeNull();
});
test('the exact face/portion and exclusive claim prevent concurrent personal work and source/portion substitution', () => {
  const f = fixture(); hire(f); start(f); work(f, 225); const j = f.s.job;
  expect(Stone.plan(f.site, f.node, 'recover', { ...context(f), actorId: 'scientist', claimId: '' }, f.tools)).toBeNull();
  f.node.portion = 1; expect(Stone.reason(f.site, j, context(f), f.tools)).toContain('original face'); expect(Stone.effort(f.node)).toBe(0);
  f.node.portion = 0; Stone.observeFace(f.node, false); Stone.observeFace(f.node, true);
  expect(Stone.effort(f.node)).toBe(0); expect(Stone.reason(f.site, j, context(f), f.tools)).toContain('original face');
});
test('named original carried hammer and chisel, worker authority and unoccupied-ground scope remain mandatory', () => {
  const f = fixture(); hire(f); const c = context(f);
  for (const wrong of [{ controlled: true }, { wilderness: false }, { claimId: 'other' }, { actorId: 'replacement' }, { employmentAuthorized: false },
    { commission: { ...c.commission, nodeId: 'other' } }, { commission: { ...c.commission, operation: 'build' } },
    { commission: { ...c.commission, tools: [f.offer.tools[0]] } }])
    expect(Stone.plan(f.site, f.node, 'recover', { ...c, ...wrong }, f.tools)).toBeNull();
  expect(Stone.plan(f.site, f.node, 'inspect', c, f.tools)).toBeNull(); const j = start(f); work(f, 100);
  f.tools[1].tool.carriedBy = 'other'; expect(Stone.reason(f.site, j, context(f), f.tools)).toContain('original carried hammer and chisel');
});
test('completion requires one actual matching worker receipt; changed faces stop arrival/care and death freezes the original clock', () => {
  const f = fixture(); hire(f); const j = start(f); j.progress = j.required; j.status = 'completed';
  j.receipt = { actorId: f.s.actor.id, taskId: j.taskId, nodeId: f.node.id, siteId: 'wild', worldId: 'world', quantity: 1 };
  expect(Builder.complete(f.s, 1000)).toBe(false); j.receipt.outputId = 'real-output'; j.receipt.actorId = 'replacement'; expect(Builder.complete(f.s, 1000)).toBe(false);
  j.status = 'working'; let released = 0;
  const hooks = { targetsValid: () => false, cancel: j => Stone.cancel(j, f.tools, 100, f.site), release: () => released++, adjacent: () => false, move: () => {} };
  f.s.phase = 'arriving'; f.c.care = true; Builder.advance(f.s, f.c, hooks, 100);
  expect(f.s.phase).toBe('returning'); expect(f.s.contract.completed).toEqual([]); expect(released).toBeGreaterThan(0);
  const frozen = copy(f.s); Builder.advance(f.s, { ...f.c, alive: false }, hooks, 200); expect(f.s).toEqual(frozen);
});
