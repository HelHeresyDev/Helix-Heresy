(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./network-interdiction') : root.HelixNetworkInterdiction);
  if (node) module.exports = api;
  if (root) root.HelixOffensiveMandates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Field) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const id = x => typeof x === 'string' && x.length > 0;
  const time = x => Number.isFinite(x) && x >= 0;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cell = c => c && ['x', 'y', 'z'].every(k => Number.isSafeInteger(c[k]));
  const equalCell = (a, b) => cell(a) && cell(b) && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const HASH = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const REVIEW = 60, DUTY = 14400, RETURN = 600, FEE = 40, RATE = 24 / 3600;
  const SCOPE = 'Separate declared offensive purpose against this named collective government, with the scientist’s opposition to the gods disclosed. Two original field employees only; no defensive-contract upgrade, police powers, army, transport, divine endorsement or city control. This implemented service is paid local preparation/muster, hold, follow and physical withdrawal. Assault and occupation require their own actual opposing-defense/control consumer and are not executable through this agreement.';
  const active = p => p?.contract && !['returned', 'settled'].includes(p.phase);
  const able = a => a?.status === 'alive' && a.health >= 35 && a.workSeconds > 0 && a.foodSeconds > 0
    && a.waterSeconds > 0 && a.physicalControl?.stamina > 1;
  function create(binding, at) {
    return id(binding?.worldId) && id(binding.runId) && time(at)
      ? { ...copy(binding), lastAt: at, posts: [], serial: 0, reports: [] } : null;
  }
  function validTarget(t) {
    return t?.kind === 'collective' && ['cityId', 'charterId', 'authorityId'].every(k => id(t[k]));
  }
  function normalize(s) {
    if (s == null) return null;
    if (!id(s.worldId) || !id(s.runId) || !time(s.lastAt) || !Number.isSafeInteger(s.serial) || s.serial < 0
      || !Array.isArray(s.posts) || !Array.isArray(s.reports)
      || new Set(s.posts.map(p => p?.id)).size !== s.posts.length || s.posts.some(p =>
        !id(p?.id) || !Field.validSource(p.source) || !validTarget(p.target) || p.target.cityId !== p.source.cityId
        || !id(p.layout?.roomId) || !Array.isArray(p.layout.roomIds) || !p.layout.roomIds.includes(p.layout.roomId)
        || !Array.isArray(p.layout.homes) || p.layout.homes.length !== 2 || !p.layout.homes.every(cell)
        || equalCell(...p.layout.homes) || !cell(p.layout.visitor) || !time(p.openedAt) || !Number.isSafeInteger(p.bodyEpoch) || p.bodyEpoch < 0
        || !Array.isArray(p.history) || !['available', 'reviewing', 'refused', 'offered', 'mustering', 'returning', 'stranded', 'returned', 'settled'].includes(p.phase)
        || p.job && (!id(p.job.id) || !time(p.job.at) || !time(p.job.progress) || p.job.progress > REVIEW)
        || p.contract && (!id(p.contract.id) || !time(p.contract.at) || !time(p.contract.escrow) || !time(p.contract.earned)
          || !time(p.contract.refunded) || Math.abs(p.contract.escrow + p.contract.earned + p.contract.refunded - 2 * DUTY * RATE) > 1e-6
          || p.contract.bodyEpoch !== p.bodyEpoch || !same(p.contract.target, p.target)
          || !same(p.contract.memberIds, [1, 2].map(i => `${p.source.id}:${i}`))))) return null;
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, ...copy(to) } : null; }
  function sources(n, f, cityId) {
    if (!bound(n, f) || n.invalid || f.invalid || n.inventories?.mode !== 'original' || n.inventories.invalid || n.inventories.conflict
      || !bound(n, n.inventories)) return [];
    return Field.originalSources(n).filter(src => src.cityId === cityId && n.source.branches.some(b => b.id === src.branchId
      && b.public && b.hostId === b.id && b.allocated && b.networkContinuity && b.lifecycle === 'active'
      && b.charter?.scope?.includes('ownNewContracts')))
      .filter(src => [src.id, `${src.id}:1`, `${src.id}:2`].every(assetId => n.inventories.assets.some(a => a.id === assetId
        && !a.lost && a.ownerId === `branch:${src.branchId}` && a.ledger === 'service'
        && a.external?.service === 'interdiction' && a.external.assetId === assetId)));
  }
  function resolve(s, n, f, p) {
    if (!bound(s, n) || !bound(s, f) || !p || !sources(n, f, p.source.cityId).some(src => same(src, p.source))) return null;
    const u = f.units.find(u => u.id === p.source.id && !u.lost && same(u.source, p.source));
    return u?.actors.length === 2 && u.actors.every((a, i) => a.id === `${u.id}:${i + 1}`)
      && u.offensivePostId === p.id ? u : null;
  }
  const contact = (p, c) => c?.alive && c.capable && c.local && c.near && c.free && c.sourceCurrent
    && c.bodyEpoch === p.bodyEpoch && same(c.target, p.target);
  const office = (n, p, c) => { const a = n?.accounts.find(a => a.id === p.source.branchId && !a.lost);
    return Boolean(a && a.operator === c?.manager && a.terminal === c.terminal); };
  function open(s, n, f, sourceId, target, layout, c, seed, at) {
    if (!bound(s, n) || !bound(s, f) || !validTarget(target) || !c?.alive || !c.capable || !c.atCounter
      || !c.free || !c.sourceCurrent || !c.refusalReceived || !same(c.target, target) || !Number.isSafeInteger(c.bodyEpoch)
      || c.bodyEpoch < 0 || !time(at)) return null;
    const src = sources(n, f, target.cityId).find(src => src.id === sourceId), u = f.units.find(u => u.id === sourceId);
    const old = s.posts.find(p => p.source.id === sourceId);
    if (old) return resolve(s, n, f, old) && same(old.target, target) ? old : null;
    if (!src || !u || u.offensivePostId || u.job || u.deployment && !['returned', 'declined'].includes(u.phase)
      || u.actors.some(a => !able(a) || a.assignment || a.mapCell) || !layout?.roomIds?.includes(layout.roomId)
      || layout.homes?.length !== 2 || !layout.homes.every(cell) || equalCell(...layout.homes) || !cell(layout.visitor)) return null;
    const manager = n.accounts.find(a => a.id === src.branchId && !a.lost)?.operator; if (!manager) return null;
    const p = { id: `${src.id}:offensive-post`, source: copy(src), target: copy(target), layout: copy(layout), bodyEpoch: c.bodyEpoch,
      openedAt: at, phase: 'available', quote: null, job: null, contract: null, orders: {}, history: [], report: null };
    u.offensivePostId = p.id; // The existing owner retains both bodies, including all later wounds/losses.
    manager.offensivePolicy ??= HASH(`${seed}:${manager.id}:declared-regime-change`) % 7 === 0 ? 'refuseRegimeChange' : 'considerBoundedMandate';
    u.actors.forEach((a, i) => {
      a.mapCell = copy(layout.homes[i]); a.roomId = layout.roomId;
      a.offensivePolicy ??= HASH(`${seed}:${a.id}:declared-regime-change`) % 7 === 0 ? 'refuseRegimeChange' : 'considerBoundedMandate';
    });
    s.posts.push(p); return p;
  }
  function report(s, p, u, at, c) {
    const observed = u.actors.filter(a => (c.observedIds || c.heardIds || []).includes(a.id));
    const r = { id: `${p.id}:received:${s.reports.length + 1}`, at, cityId: p.target.cityId, label: p.source.label,
      phase: observed.length === u.actors.length ? p.phase : 'partialLocalContact', terms: copy(p.quote),
      message: observed.length === u.actors.length ? p.message || '' : 'Only personally observed or personally heard original members are described; the rest of the team is not located by this contact.',
      people: observed.map(a => ({ id: a.id, name: a.name, status: a.status, health: a.health })),
      payment: p.contract ? { paid: 2 * FEE + 2 * DUTY * RATE, earned: p.contract.earned, held: p.contract.escrow, refunded: p.contract.refunded } : null,
      scope: SCOPE };
    p.report = r; s.reports.push(copy(r)); return r;
  }
  function review(s, p, n, f, c, at) {
    const u = resolve(s, n, f, p), manager = c?.manager;
    if (!u || !contact(p, c) || !office(n, p, c) || p.contract || p.job || p.refusedAt != null || u.job
      || !time(at) || u.actors.some(a => !able(a) || a.assignment || !c.heardIds?.includes(a.id))
      || !manager || manager.status !== 'alive' || manager.health < 50 || manager.assignment || !Number.isFinite(manager.workSeconds) || manager.workSeconds < REVIEW
      || !Number.isFinite(c.terminal?.powerSeconds) || c.terminal.powerSeconds < REVIEW) return false;
    const jobId = `${p.id}:review:${++s.serial}`;
    p.job = { id: jobId, at, progress: 0, managerId: manager.id }; p.quote = null; p.phase = 'reviewing';
    u.actors.forEach(a => a.assignment = jobId); manager.assignment = jobId; return true;
  }
  function cancel(p, u, c) {
    if (!p?.job) return false;
    for (const a of [...(u?.actors || []), c?.manager].filter(Boolean)) if (a.assignment === p.job.id) a.assignment = null;
    p.job = null; p.phase = 'available'; return true;
  }
  function eligible(p, u, c) {
    return contact(p, c) && c.returnRouteOpen && Number.isFinite(c.returnSeconds) && c.returnSeconds >= 0 && c.returnSeconds <= RETURN
      && u.actors.every(a => able(a) && !a.assignment && c.heardIds?.includes(a.id) && a.workSeconds >= DUTY
        && a.foodSeconds >= DUTY && a.waterSeconds >= DUTY && a.fieldKit?.toolCondition > 0 && a.fieldKit.vestCondition > 0);
  }
  function accept(s, p, n, f, c, expected, wallet, at) {
    const u = resolve(s, n, f, p), q = p?.quote;
    const authentic = q && q.bodyEpoch === p.bodyEpoch && q.sourceId === p.source.id && same(q.target, p.target)
      && same(q.memberIds, u?.actors.map(a => a.id)) && q.seconds === DUTY && q.returnBuffer === RETURN
      && q.feeEach === FEE && q.hourlyEach === RATE * 3600 && q.total === 2 * FEE + 2 * DUTY * RATE && q.scope === SCOPE
      && time(q.at) && q.expiresAt === q.at + 300;
    if (!u || !q || !authentic || !same(q, expected) || !eligible(p, u, c) || p.job || p.contract || !time(at) || at < q.at || at >= q.expiresAt
      || !Number.isFinite(wallet?.money) || wallet.money < q.total) return false;
    wallet.money -= q.total;
    p.contract = { id: `${p.id}:contract:${++s.serial}`, at, bodyEpoch: p.bodyEpoch, target: copy(p.target),
      memberIds: u.actors.map(a => a.id), escrow: 2 * DUTY * RATE, earned: 0, refunded: 0, returnedAt: null };
    u.offensiveMandateId = p.contract.id;
    for (const a of u.actors) { a.assignment = p.contract.id; a.money = (a.money || 0) + FEE; p.orders[a.id] = 'hold'; }
    p.phase = 'mustering'; p.history.push({ at, kind: 'paidOriginalMuster', contractId: p.contract.id, amount: q.total });
    p.quote = null; p.message = 'Original members accepted the disclosed purpose and paid preparation only. No assault or sovereignty was performed.';
    report(s, p, u, at, c); return true;
  }
  function command(s, p, n, f, c, action, at) {
    const u = resolve(s, n, f, p);
    if (!u || !active(p) || !contact(p, c) || !['hold', 'follow', 'withdraw'].includes(action)
      || !['mustering', 'returning', 'stranded'].includes(p.phase) || !time(at)) return false;
    const heard = u.actors.filter(a => able(a) && a.assignment === p.contract.id && c.heardIds?.includes(a.id));
    if (!heard.length || action !== 'withdraw' && (p.phase !== 'mustering' || at >= p.contract.at + DUTY - RETURN)) return false;
    for (const a of heard) p.orders[a.id] = action;
    if (u.actors.filter(a => a.status === 'alive').every(a => p.orders[a.id] === 'withdraw')) p.phase = 'returning';
    p.history.push({ at, kind: 'heardOrder', action, actorIds: heard.map(a => a.id) }); return true;
  }
  function receive(s, p, n, f, c, at) {
    const u = resolve(s, n, f, p); return u && contact(p, c) && !p.job && time(at) ? report(s, p, u, at, c) : null;
  }
  function settle(s, p, n, f, c, wallet, at) {
    const u = resolve(s, n, f, p);
    if (!u || p.phase !== 'returned' || !contact(p, c) || !c.atPost || !Number.isFinite(wallet?.money) || !time(at)) return false;
    wallet.money += p.contract.escrow; p.contract.refunded += p.contract.escrow; p.contract.escrow = 0;
    p.phase = 'settled'; report(s, p, u, at, c); return true;
  }
  function advance(s, n, f, context, to, h) {
    if (!s || !bound(s, n) || !bound(s, f) || !time(to) || to <= s.lastAt || !h.alive()) return false;
    if (!s.posts.some(p => p.job || active(p))) { s.lastAt = to; return false; }
    while (s.lastAt < to && h.alive()) {
      const dt = Math.min(1, to - s.lastAt), at = s.lastAt + dt; s.lastAt = at;
      for (const p of s.posts) {
        if (!p.job && !active(p)) continue;
        const u = resolve(s, n, f, p), c = context(p, u);
        if (!u) { p.message = 'Original owner account unavailable. No substitute people, reserves, authority or refund.'; continue; }
        if (at <= p.openedAt) continue;
        if (p.job) {
          const job = p.job, m = c?.manager;
          if (at <= job.at) continue;
          if (!contact(p, c) || !office(n, p, c) || !c.returnRouteOpen || m?.id !== job.managerId || m.assignment !== job.id || m.workSeconds < dt
            || !Number.isFinite(c.terminal?.powerSeconds) || c.terminal.powerSeconds < dt || m.status !== 'alive' || m.health < 50 || m.lastOperatingWorkAt >= at
            || u.actors.some(a => !able(a) || a.assignment !== job.id || !c.heardIds?.includes(a.id))) continue;
          m.workSeconds -= dt; c.terminal.powerSeconds -= dt;
          m.lastOperatingWorkAt = at;
          for (const a of u.actors) { a.workSeconds -= dt; a.foodSeconds = Math.max(0, a.foodSeconds - dt); a.waterSeconds = Math.max(0, a.waterSeconds - dt); }
          job.progress += dt;
          if (job.progress + 1e-7 >= REVIEW) {
            cancel(p, u, c);
            if (m.offensivePolicy === 'refuseRegimeChange' || u.actors.some(a => a.offensivePolicy === 'refuseRegimeChange')) {
              p.phase = 'refused'; p.refusedAt = at; p.message = 'An original participant refuses declared regime change. Money, defensive employment and repeated requests cannot reroll that decision.';
            } else if (![m, ...u.actors].every(a => a.offensivePolicy === 'considerBoundedMandate')) {
              p.message = 'Original participant disposition is unavailable; missing assent is not a preparation offer.';
            } else if (eligible(p, u, c)) {
              p.phase = 'offered'; p.quote = { at, expiresAt: at + 300, bodyEpoch: p.bodyEpoch, sourceId: p.source.id,
                target: copy(p.target), memberIds: u.actors.map(a => a.id), seconds: DUTY, returnBuffer: RETURN,
                feeEach: FEE, hourlyEach: RATE * 3600, total: 2 * FEE + 2 * DUTY * RATE, scope: SCOPE };
              p.message = 'Both original employees and the original desk operator accepted the exact declared preparation purpose, not obedience by the target government.';
            } else { p.message = 'Original kit, duty, provisions or physical return route cannot support this preparation budget.'; }
            report(s, p, u, at, c);
          }
          continue;
        }
        if (!active(p) || at <= p.contract.at) continue;
        const contract = p.contract;
        if (!c?.sourceCurrent || at >= contract.at + DUTY - RETURN || u.actors.some(a => !able(a) || h.incapacitated(a))) {
          for (const a of u.actors) if (a.status === 'alive') p.orders[a.id] = 'withdraw';
          p.phase = 'returning';
        }
        for (let i = 0; i < u.actors.length; i++) {
          if (!h.alive()) return true;
          const a = u.actors[i]; if (a.status !== 'alive' || a.assignment !== contract.id) continue;
          const pay = Math.min(contract.escrow, dt * RATE);
          contract.escrow -= pay; contract.earned += pay; a.money = (a.money || 0) + pay;
          a.workSeconds = Math.max(0, a.workSeconds - dt); a.foodSeconds = Math.max(0, a.foodSeconds - dt); a.waterSeconds = Math.max(0, a.waterSeconds - dt);
          if (a.fieldAggressorId === 'scientist' && at < a.fieldProvokedUntil) {
            p.orders[a.id] = 'withdraw'; p.phase = 'returning'; p.message = 'Original member withdrew after personally receiving an attack from the employer.';
          }
          if (!able(a) || h.incapacitated(a)) { p.phase = 'stranded'; continue; }
          const order = p.orders[a.id];
          const goal = order === 'withdraw' ? p.layout.homes[i] : order === 'follow' ? h.followGoal(p, a, c) : null;
          if (goal && !equalCell(a.mapCell, goal) && h.move(p, a, goal)) a.physicalControl.stamina = Math.max(0, a.physicalControl.stamina - .1);
        }
        if (u.actors.every((a, i) => a.status === 'dead' || p.orders[a.id] === 'withdraw' && equalCell(a.mapCell, p.layout.homes[i]))) {
          p.phase = 'returned'; contract.returnedAt = at; u.offensiveMandateId = null;
          for (const a of u.actors) if (a.assignment === contract.id) a.assignment = null;
          p.history.push({ at, kind: 'physicalReturn', contractId: contract.id });
        }
      }
    }
    return true;
  }
  return { REVIEW, DUTY, RETURN, FEE, RATE, SCOPE, bound, active, able, validTarget, create, normalize, rebind, sources, resolve,
    open, review, cancel, accept, command, receive, settle, advance, publicView: s => copy(s?.reports || []) };
});
