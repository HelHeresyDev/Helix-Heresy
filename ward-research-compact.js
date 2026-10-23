(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./city-defense') : root.HelixCityDefense,
    node ? require('./intercity-compact') : root.HelixIntercityCompact);
  if (node) module.exports = api;
  if (root) root.HelixWardResearchCompact = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Defense, Compact) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const SECONDS = Object.freeze({ authorize: 120, baseline: 120, install: 180, improved: 120,
    negotiate: 120, sign: 60, maintain: 120, charge: 60 });
  const COSTS = Object.freeze({ install: { metalParts: 2, glass: 1, rubber: 1, preparedManaCrystals: 1 },
    maintain: { metalParts: 1, rubber: 1 }, charge: { arcaneFeedstock: 1 } });
  const INTERVAL = 900, CURE = 360, TERM = 3600, FEE = 60, LIFE = 21600;
  const SCOPE = 'One original approach ward only. The scientist openly opposes the gods and promises no worship. '
    + 'A civilian trial grants no command. A separately signed technical compact grants local economical/conservative tuning and maintenance only, '
    + 'not police powers, an office, monopoly, sovereignty, divine endorsement or domination. No defense is disabled on handback.';
  const able = Defense.able;
  const terminal = s => ['completed', 'terminated', 'expired', 'breached'].includes(s?.status);
  function create(front, b, clerkId, binding, at) {
    if (!Defense.validSource(front?.source) || !b?.source?.authority?.id || !clerkId || !binding?.worldId || !binding.runId
      || front.source.cityId !== b.source.cityId || front.source.charterId !== b.source.charterId
      || front.source.institutionId !== b.source.defenseId || front.defenderId !== b.defender.id) return null;
    return { id: `${front.id}:research-compact`, ...copy(binding), source: copy(front.source),
      authorityId: b.source.authority.id, representativeId: b.representative.id, defenderId: b.defender.id, clerkId,
      lastAt: at, serial: 0, status: 'unnegotiated', authorization: null, job: null, partialInstall: null,
      baseline: null, demonstration: null, offer: null, terms: null, cycles: [], escrow: 0, earned: 0,
      paid: 0, refunded: 0, history: [], report: null, refusal: null, message: '' };
  }
  function normalize(s) {
    return Defense.validSource(s?.source) && s.runId && s.worldId && s.authorityId && s.clerkId
      && Array.isArray(s.history) && Array.isArray(s.cycles) && ['escrow', 'earned', 'paid', 'refunded', 'lastAt'].every(k => Number.isFinite(s[k]) && s[k] >= 0)
      ? copy(s) : null;
  }
  function rebind(s, from, to) {
    const v = normalize(s); return v && v.worldId === from?.worldId && v.runId === from?.runId ? { ...v, ...to } : null;
  }
  function note(s, at, kind, text) {
    s.message = text; s.history.push({ at, kind, text }); s.history = s.history.slice(-60);
  }
  function current(s, front, g, c) {
    const b = g?.foreignCivic?.bargain, source = c.source;
    return Boolean(s && front?.id === s.source.installationId && c.authorityCurrent && source
      && c.worldId === s.worldId && c.runId === s.runId && g.cityId === s.source.cityId
      && ['cityId', 'charterId', 'populationSourceId', 'institutionId', 'installationId'].every(k => source[k] === s.source[k])
      && b?.source.authority.id === s.authorityId && b.source.charterId === s.source.charterId
      && b.defender.id === s.defenderId && b.representative.id === s.representativeId && g.clerk.id === s.clerkId);
  }
  function personal(c) { return Boolean(c.alive && c.capable && c.free && c.local && !c.busy && !c.violence); }
  function contact(s, g, c, own = false) {
    const b = g?.foreignCivic?.bargain, id = own && s.job?.id;
    return Boolean(personal(c) && c.atDesk && c.clerkPresent && c.lineOfSight && c.representativePresent
      && [g.clerk, b?.representative].every(able) && !b.job && !g.foreignCivic.accessJob
      && (!g.receptionAssignment || g.receptionAssignment === id)
      && (!b.representative.assignment || b.representative.assignment === id));
  }
  function operator(front, b, c) {
    const a = b?.defender;
    return Boolean(able(a) && !c.operatorIncapacitated && !c.suppressed && !c.otherDuty && a.workSeconds > 0 && a.stamina > 1
      && a.assignment === front.station.duty.id && Defense.same(a.mapCell, front.layout.post)
      && c.structurePresent && c.condition >= 50 && front.station.energy > 0);
  }
  function atWork(s, front, g, c) {
    return personal(c) && c.atStation && c.operatorContact && c.workAccessible
      && operator(front, g.foreignCivic.bargain, c) && !front.pendingPulse;
  }
  function policy(c) { return (c.restrictions || []).find(r => r.id && r.text && r.refusesDeclaredOpposition === true); }
  function witnessedHostility(s, front) {
    return front.reports.some(r => r.actorId === 'scientist' && [s.defenderId, s.representativeId].includes(r.witnessId)
      && ['hostileApproachClaim', 'outerApproachAttack'].includes(r.kind));
  }
  function refuse(s, at, reason) { s.refusal = { at, reason }; note(s, at, 'refusal', reason); return false; }
  function body(s, c) { return s.authorization?.bodyEpoch === c.bodyEpoch; }
  function access(s, bodyEpoch, at) {
    return Boolean(s?.authorization?.bodyEpoch === bodyEpoch && (s.terms
      ? ['active', 'cure', 'suspended'].includes(s.status) && at < s.terms.endsAt
      : !terminal(s) && at < s.authorization.endsAt));
  }
  function egress(s, front, g, task, bodyEpoch, roomForCell) {
    const d = task?.data, token = d?.wardResearchExit, path = d?.mapPath;
    if (!s?.authorization || task?.type !== 'scientistMove' || !token || token.compactId !== s.id
      || token.authorizationId !== s.authorization.id || token.bodyEpoch !== bodyEpoch || s.authorization.bodyEpoch !== bodyEpoch
      || s.worldId !== front?.worldId || s.runId !== front?.runId || front.id !== s.source.installationId
      || g.cityId !== s.source.cityId || d.fromRoomId !== front.layout.roomId || d.toRoomId !== g.checkpointRoomId
      || !Defense.same(d.toCell, { x: 10, y: 7, z: g.z }) || task.createdAt < s.authorization.at
      || !Array.isArray(path) || path.length < 2 || !Defense.same(path[0], d.fromCell) || !Defense.same(path.at(-1), d.toCell)) return false;
    let outside = false;
    for (const cell of path) {
      const room = roomForCell(cell);
      if (room === g.checkpointRoomId) outside = true;
      else if (room !== front.layout.roomId || outside) return false;
    }
    return roomForCell(path[0]) === front.layout.roomId && outside;
  }
  function rights(s, front, g, c, at) {
    return Boolean(s?.status === 'active' && s.terms && at < s.terms.endsAt && body(s, c)
      && current(s, front, g, c) && operator(front, g.foreignCivic.bargain, c)
      && front.station.efficiency?.certified && front.station.efficiency.remainingSeconds > 0);
  }
  function ownItem(i, key, qty, claim = '') {
    return Boolean(i && i.key === key && i.section === 'resources' && i.carriedBy === 'scientist' && Number.isInteger(i.quantity)
      && i.quantity >= qty && (!i.reservedTaskId || i.reservedTaskId === claim) && !i.cityOwnerId && !i.civicCustody
      && !i.containerId && !i.fixtureId && !i.carryTaskId && !i.chemicalBatch && !i.biology && !i.contents?.length
      && !i.tags?.some(t => /contaminated|stolen/i.test(t)));
  }
  function savedToolClaim(front, g, stacks) {
    const s = front?.scientificCompact, j = s?.job;
    if (!normalize(s) || !j || !['install', 'maintain'].includes(j.kind) || terminal(s)
      || !current(s, front, g, { authorityCurrent: true, source: front.source, worldId: front.worldId, runId: front.runId })
      || j.bodyEpoch !== s.authorization?.bodyEpoch || !Defense.same(j.cell, front.layout.service)
      || j.seconds !== SECONDS[j.kind] || !Number.isFinite(j.progress) || j.progress < 0 || j.progress > j.seconds
      || j.inputs?.length !== Object.keys(COSTS[j.kind]).length) return null;
    for (const [key, quantity] of Object.entries(COSTS[j.kind])) {
      const x = j.inputs.find(x => x.key === key && x.quantity === quantity), i = x && stacks.find(i => i.id === x.id);
      if (!ownItem(i, key, quantity, j.id) || i.reservedTaskId !== j.id || i.quantity !== x.originalQuantity) return null;
    }
    const item = stacks.find(i => i.toolInstanceId === j.toolId && i.key === 'masonryHammer' && i.quantity === 1
      && i.reservedTaskId === j.id && i.carriedBy === 'scientist' && !i.cityOwnerId && !i.civicCustody && !i.containerId && !i.fixtureId);
    return item ? { jobId: j.id, toolId: j.toolId } : null;
  }
  function begin(s, g, c, kind, at, stacks, tools, extra = {}) {
    if (s.job || !SECONDS[kind]) return false;
    const costs = COSTS[kind] || {}, inputs = [];
    for (const [key, quantity] of Object.entries(costs)) {
      const item = stacks.find(i => ownItem(i, key, quantity)); if (!item) return false;
      inputs.push({ id: item.id, key, quantity, originalQuantity: item.quantity });
    }
    const tool = ['install', 'maintain'].includes(kind) && tools.find(t => t.key === 'masonryHammer' && t.stack?.quantity === 1
      && t.stack.carriedBy === 'scientist' && !t.stack.reservedTaskId && !t.stack.cityOwnerId && !t.stack.civicCustody
      && t.tool?.carriedBy === 'scientist' && !t.tool.reservedTaskId && t.tool.current >= 1);
    if (['install', 'maintain'].includes(kind) && !tool) return false;
    const desk = ['authorize', 'negotiate', 'sign'].includes(kind), b = g.foreignCivic.bargain;
    if (desk && Math.min(g.receptionWorkSeconds, g.powerSeconds, b.representative.workSeconds) < SECONDS[kind]) return false;
    const id = `${s.id}:work:${++s.serial}`;
    s.job = { id, kind, progress: kind === 'install' ? s.partialInstall?.progress || 0 : 0, lastAt: at,
      seconds: SECONDS[kind], bodyEpoch: c.bodyEpoch, cell: copy(c.cell), condition: c.condition,
      inputs, toolId: tool?.tool?.id || null, desk, ...copy(extra) };
    for (const x of inputs) stacks.find(i => i.id === x.id).reservedTaskId = id;
    if (tool) { tool.stack.reservedTaskId = id; tool.tool.reservedTaskId = id; }
    if (desk) { g.receptionAssignment = id; b.representative.assignment = id; }
    if (kind === 'improved') g.outerApproach.station.efficiency.enabled = true;
    s.refusal = null; return true;
  }
  function release(s, front, g, stacks, tools, at, reason = '') {
    const j = s.job; if (!j) return false;
    if (j.kind === 'install') s.partialInstall = { progress: j.progress, bodyEpoch: j.bodyEpoch, cell: copy(j.cell) };
    if (j.kind === 'improved' && !front.station.efficiency?.certified) front.station.efficiency.enabled = false;
    for (const i of stacks) if (i.reservedTaskId === j.id) i.reservedTaskId = '';
    for (const t of tools) {
      if (t.tool?.reservedTaskId === j.id) t.tool.reservedTaskId = '';
      if (t.stack?.reservedTaskId === j.id) t.stack.reservedTaskId = '';
    }
    if (g.receptionAssignment === j.id) g.receptionAssignment = null;
    if (g.foreignCivic.bargain.representative.assignment === j.id) g.foreignCivic.bargain.representative.assignment = null;
    s.job = null; if (reason) note(s, at, 'interrupted', reason); return true;
  }
  function consentReason(s, front, g, c, at) {
    if (!current(s, front, g, c) || !contact(s, g, c) || c.excluded || !c.visitorPermit) return 'Attend the original civic desk with lawful visitor access, the original representative and available shared duty.';
    if (policy(c)) return policy(c).text;
    if (witnessedHostility(s, front) || c.violence || front.hostileUntil > at)
      return 'The original city declines discretionary technical cooperation after original-party witnessed hostility or an actual current contest; no automatic crime or divine verdict.';
    return '';
  }
  function action(s, front, g, market, c, kind, expected, at, stacks = [], tools = [], wallet = null) {
    if (!s || !c.alive) return false;
    if (kind === 'cancel') return Boolean(body(s, c) || s.job?.bodyEpoch === c.bodyEpoch)
      && release(s, front, g, stacks, tools, at, 'Unfinished attendance interrupted; partial fitting work and all spent time, energy and wear remain.');
    if (kind === 'report') return receive(s, front, g, c, at);
    if (kind === 'collect') {
      if (!body(s, c) || !contact(s, g, c) || !Number.isFinite(wallet?.money) || s.earned <= 0) return false;
      wallet.money += s.earned; s.paid += s.earned; s.earned = 0; note(s, at, 'payment', 'Original earned technical-service payment collected personally, once.'); return true;
    }
    if (market?.id !== s.source.cityId) return false;
    if (kind === 'terminate') {
      if (!body(s, c) || !contact(s, g, c) || !s.terms || terminal(s) || s.job) return false;
      return end(s, market, at, 'terminated', 'Personal safe handback: technical privileges end, original guard and city-owned fitting remain.');
    }
    if (kind === 'authorize') {
      const reason = consentReason(s, front, g, c, at);
      if (reason) return refuse(s, at, reason);
      if (s.authorization || !c.researched || front.station.efficiency) return refuse(s, at, 'Research the coupling first. An existing city fitting is an actual alternative, not an invented shortage.');
      const defender = g.foreignCivic.bargain.defender;
      if (!c.defenderPresent || !able(defender) || c.operatorIncapacitated || c.suppressed || c.otherDuty
        || defender.workSeconds < 780 || defender.stamina < 20) return refuse(s, at, 'The original operator cannot spare the actual trial and return margin from existing duties and bodily endurance. No replacement or replenishment is supplied.');
      return begin(s, g, c, kind, at, stacks, tools, { policy: JSON.stringify(c.restrictions || []) });
    }
    if (!body(s, c) || !current(s, front, g, c) || !s.authorization) return false;
    if (['baseline', 'install', 'improved', 'maintain', 'charge'].includes(kind)) {
      if (!atWork(s, front, g, c) || c.excluded || !c.researched || s.job || s.status === 'suspended'
        || terminal(s) || !s.terms && at >= s.authorization.endsAt) return false;
      if (kind === 'baseline' && (s.baseline || front.station.efficiency)) return false;
      if (kind === 'install' && (!s.baseline || front.station.efficiency || s.partialInstall
        && (s.partialInstall.bodyEpoch !== c.bodyEpoch || !Defense.same(s.partialInstall.cell, c.cell)))) return false;
      if (kind === 'improved' && (!front.station.efficiency || s.demonstration || c.condition !== s.baseline.condition)) return false;
      if (kind === 'maintain' && (!s.terms || !['active', 'cure'].includes(s.status))) return false;
      const cycle = s.cycles.find(r => r.fulfilledAt == null);
      if (kind === 'maintain' && (!cycle || at < cycle.dueAt || at + SECONDS.maintain >= cycle.dueAt + CURE)) return false;
      if (kind === 'charge' && (s.terms ? !rights(s, front, g, c, at) : false)) return false;
      if (kind === 'charge' && front.station.energy > Defense.CAPACITY - 21600) return false;
      return begin(s, g, c, kind, at, stacks, tools, { startEnergy: front.station.energy,
        startCombat: front.station.combatSpent, startStandby: front.station.standbySpent, cycleId: cycle?.id || null });
    }
    if (['economical', 'conservative'].includes(kind)) {
      if (!rights(s, front, g, c, at) || !atWork(s, front, g, c) || s.job) return false;
      front.station.efficiency.enabled = kind === 'economical';
      note(s, at, 'tuning', `Exercised actual local technical authority: ${kind} mode. No coverage, reserve or defender capacity created.`); return true;
    }
    if (kind === 'negotiate' || kind === 'sign') {
      const reason = consentReason(s, front, g, c, at);
      if (reason) return refuse(s, at, reason);
      const fitting = front.station.efficiency;
      const dutyNeeded = INTERVAL * 2 + SECONDS.maintain + 60 + SECONDS[kind] + (kind === 'negotiate' ? SECONDS.sign : 0);
      if (s.terms || !s.demonstration || !fitting?.certified || fitting.remainingSeconds <= TERM || !operator(front, g.foreignCivic.bargain, c)
        || g.foreignCivic.bargain.defender.workSeconds < dutyNeeded
        || !Number.isFinite(market?.treasury) || market.treasury < 1000 + FEE * 2 || c.condition !== s.demonstration.condition)
        return refuse(s, at, 'The original city needs a demonstrated saving, enough original operator duty for both services and a return margin, a maintained installation and 120 spare marks above its protected reserve. No signature creates those resources.');
      if (kind === 'sign' && (!s.offer || at >= s.offer.expiresAt || JSON.stringify(s.offer) !== JSON.stringify(expected)
        || s.offer.bodyEpoch !== c.bodyEpoch || s.offer.policy !== JSON.stringify(c.restrictions || []))) return false;
      return begin(s, g, c, kind, at, stacks, tools, { quote: kind === 'sign' ? s.offer : null, policy: JSON.stringify(c.restrictions || []) });
    }
    return false;
  }
  function end(s, market, at, status, reason) {
    if (!s.terms || terminal(s) || market?.id !== s.source.cityId || !Number.isFinite(market?.treasury)) return false;
    s.status = status; s.endedAt = at; market.treasury += s.escrow; s.refunded += s.escrow; s.escrow = 0;
    note(s, at, 'handback', `${reason} Unearned escrow returned once; earned local pay remains collectible. No remote dismantling or sabotage.`); return true;
  }
  function receive(s, front, g, c, at) {
    if (!contact(s, g, c) && !(personal(c) && c.atStation && c.operatorContact)) return false;
    s.report = { at, sourceId: s.id, cityId: s.source.cityId, status: s.status, authorization: copy(s.authorization),
      terms: copy(s.terms), baseline: copy(s.baseline), demonstration: copy(s.demonstration), cycles: copy(s.cycles),
      earned: s.earned, paid: s.paid, history: copy(s.history), refusal: copy(s.refusal),
      installation: c.atStation && c.structureVisible ? { condition: c.condition, energy: front.station.energy,
        fitting: copy(front.station.efficiency || null) } : null, scope: SCOPE };
    return true;
  }
  function advance(s, front, g, market, c, at, stacks = [], tools = [], hooks = {}) {
    if (!s || !c.alive || at <= s.lastAt || !Number.isFinite(at) || market?.id !== s.source.cityId) return false;
    const elapsed = at - s.lastAt; s.lastAt = at;
    const b = g.foreignCivic.bargain, fitting = front.station.efficiency;
    const supported = current(s, front, g, c) && operator(front, b, c) && fitting?.certified && fitting.remainingSeconds > 0 && !policy(c) && !c.excluded;
    if (s.terms && !terminal(s)) {
      const state = Compact.installmentState(s.cycles, at, CURE);
      if (!current(s, front, g, c) || policy(c) || c.excluded || witnessedHostility(s, front) || c.violence || front.hostileUntil > at)
        end(s, market, at, 'terminated', 'Original authority, access or consensual cooperation no longer supports technical rights.');
      else if (state === 'completed') end(s, market, at, 'completed', 'Both original maintenance obligations were performed; the bounded compact has completed.');
      else if (state === 'breached' || at >= s.terms.endsAt) end(s, market,
        Math.min(s.cycles.find(r => r.fulfilledAt == null)?.dueAt + CURE || Infinity, s.terms.endsAt), state === 'breached' ? 'breached' : 'expired',
        'The disclosed service deadline or finite term elapsed; obstruction is not inferred to be deliberate refusal or a crime.');
      else s.status = !supported ? 'suspended' : state;
    }
    const j = s.job; if (!j) return true;
    const desk = j.desk, source = current(s, front, g, c), items = j.inputs.map(x => ({ x, i: stacks.find(i => i.id === x.id) }));
    const t = j.toolId && tools.find(t => t.tool?.id === j.toolId);
    const valid = source && j.bodyEpoch === c.bodyEpoch && (desk ? contact(s, g, c, true) : atWork(s, front, g, c))
      && !policy(c) && !c.excluded && !witnessedHostility(s, front) && !c.violence && !(front.hostileUntil > at)
      && Defense.same(c.cell, j.cell) && (desk || c.condition === j.condition)
      && items.every(({ x, i }) => ownItem(i, x.key, x.quantity, j.id) && i.quantity === x.originalQuantity && i.reservedTaskId === j.id)
      && (!j.toolId || t && t.stack.reservedTaskId === j.id && t.tool.reservedTaskId === j.id
        && t.stack.carriedBy === 'scientist' && t.tool.carriedBy === 'scientist' && t.tool.current >= 1)
      && (j.kind !== 'authorize' || c.visitorPermit && c.defenderPresent && c.researched)
      && (!['baseline', 'improved'].includes(j.kind) || front.station.combatSpent === j.startCombat)
      && (!['negotiate', 'sign'].includes(j.kind) || supported && c.visitorPermit
        && c.condition === s.demonstration?.condition && at < s.authorization.endsAt
        && b.defender.workSeconds >= INTERVAL * 2 + SECONDS.maintain + 60 + (j.kind === 'negotiate' ? SECONDS.sign : 0)
        && j.policy === JSON.stringify(c.restrictions || []) && market?.treasury >= 1000 + FEE * 2)
      && (j.kind !== 'sign' || at < j.quote.expiresAt)
      && (j.kind !== 'charge' || front.station.energy <= Defense.CAPACITY - 21600)
      && (j.kind !== 'maintain' || ['active', 'cure'].includes(s.status))
      && (desk || s.terms ? !terminal(s) : at < s.authorization.endsAt);
    if (!valid || elapsed > 2) {
      release(s, front, g, stacks, tools, at, 'Physical attendance, exact original inputs/tool, consent, test conditions or capacity changed. Spent resources remain; no absent-work backfill.'); return true;
    }
    const work = Math.min(elapsed, j.seconds - j.progress, desk ? g.receptionWorkSeconds : Infinity,
      desk ? g.powerSeconds : Infinity, desk ? b.representative.workSeconds : Infinity);
    if (work <= 0) { release(s, front, g, stacks, tools, at, 'Original shared duty or terminal power exhausted.'); return true; }
    if (hooks.spend && !hooks.spend(work / 120)) { release(s, front, g, stacks, tools, at, 'Scientist needs actual recovery.'); return true; }
    j.progress += work; j.lastAt = at;
    if (desk) { g.receptionWorkSeconds -= work; g.powerSeconds -= work; b.representative.workSeconds -= work; }
    if (j.progress + 1e-7 < j.seconds) return true;
    for (const { x, i } of items) { i.quantity -= x.quantity; if (i.knownQuantity != null) i.knownQuantity = Math.min(i.knownQuantity, i.quantity); }
    if (t) t.tool.current = Math.max(0, t.tool.current - 1);
    const kind = j.kind;
    if (kind === 'authorize') {
      s.authorization = { id: j.id, at, endsAt: at + 3600, bodyEpoch: c.bodyEpoch, authorityId: s.authorityId,
        installationId: front.id, scope: SCOPE, policy: j.policy };
      note(s, at, 'trialConsent', 'Original city and operator accepted one civilian trial at their existing ward; no office or political submission.');
    } else if (kind === 'baseline' || kind === 'improved') {
      const measured = { at, seconds: j.seconds, energySpent: front.station.standbySpent - j.startStandby,
        condition: c.condition, operatorId: s.defenderId, installationId: front.id };
      if (kind === 'baseline') { s.baseline = measured; note(s, at, 'baseline', `Personally measured ${measured.energySpent.toFixed(2)} reserve over ${j.seconds} seconds of original operation.`); }
      else {
        const saving = 1 - measured.energySpent / s.baseline.energySpent;
        if (saving >= .1 && measured.energySpent > 0) {
          s.demonstration = { ...measured, saving, baselineAt: s.baseline.at };
          fitting.certified = true; fitting.proofId = j.id;
          note(s, at, 'demonstrated', `Actual paired test demonstrated ${(saving * 100).toFixed(1)}% lower standby draw under the same operator and structure condition; not whole-city safety.`);
        } else note(s, at, 'failedTrial', 'The actual paired readings did not demonstrate the required saving. No technical rights or payment earned.');
      }
    } else if (kind === 'install') {
      front.station.efficiency = { id: `${j.id}:original-fitting`, installationId: front.id, cityOwnerId: g.cityId,
        installedAt: at, remainingSeconds: LIFE, enabled: false, certified: false, inputs: copy(j.inputs) };
      s.partialInstall = null; note(s, at, 'installed', 'Original carried materials incorporated into a city-owned prototype; one hammer condition spent. No energy or protection created.');
    } else if (kind === 'negotiate') {
      s.offer = { id: j.id, at, expiresAt: at + 600, bodyEpoch: c.bodyEpoch, authorityId: s.authorityId,
        installationId: front.id, proofAt: s.demonstration.at, policy: j.policy, duration: TERM, interval: INTERVAL,
        cure: CURE, installments: 2, fee: FEE, costs: copy(COSTS.maintain), scope: SCOPE };
      note(s, at, 'offer', 'Demonstrated savings support a finite technical-authority offer, not an ordinary commodity sale or sovereign handover.');
    } else if (kind === 'sign') {
      market.treasury -= FEE * 2; s.escrow += FEE * 2; s.terms = { ...copy(j.quote), signedAt: at, endsAt: at + TERM };
      s.cycles = [1, 2].map(n => ({ id: `${j.id}:service:${n}`, dueAt: at + n * INTERVAL, fulfilledAt: null })); s.status = 'active';
      note(s, at, 'signed', 'City reserved 120 actual treasury marks. Local tuning rights begin; two material-backed maintenance obligations remain unpaid until performed.');
    } else if (kind === 'maintain') {
      const r = s.cycles.find(r => r.id === j.cycleId); r.fulfilledAt = at; r.inputs = copy(j.inputs);
      fitting.remainingSeconds = LIFE; s.escrow -= FEE; s.earned += FEE;
      note(s, at, 'performance', 'Original parts and rubber incorporated during attended upkeep. Sixty marks earned in the local account, not remotely credited.');
    } else if (kind === 'charge') {
      front.station.energy += 21600; front.station.charged = (front.station.charged || 0) + 21600;
      note(s, at, 'charge', 'One carried feedstock incorporated into 21600 finite station reserve. No personal mana restored.');
    }
    release(s, front, g, stacks, tools, at);
    if (kind === 'install') s.partialInstall = null;
    if (kind === 'maintain') {
      const installment = Compact.installmentState(s.cycles, at, CURE);
      if (installment === 'completed') end(s, market, at, 'completed', 'Both finite service obligations performed; safe handback.');
      else s.status = installment; // Actual timely remedy restores rights now, not one heartbeat later.
    }
    return true;
  }
  return { SCOPE, SECONDS, COSTS, INTERVAL, CURE, TERM, FEE, LIFE, create, normalize, rebind, current, access, egress,
    personal, contact, operator, atWork, rights, consentReason, savedToolClaim, action, release, receive, advance };
});
