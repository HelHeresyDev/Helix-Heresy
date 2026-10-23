(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFoundingWorks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => v == null ? null : JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const TERM = 72 * 3600, FEE = 1200, DUTY = 8 * 3600, WAGE = 6 / 3600, COUNT = 4;
  const INVESTIGATIONS = Object.freeze({ stone: 1800, water: 1800, ground: 900 });
  const LIMITS = 'One original founding construction compound, not an operational city, sovereignty, a producing quarry/farm/spring, divine endorsement or permanent safety. Actual people, freight, materials, wages, partial works and losses persist. City founding is optional.';
  function hash(id) { let n = 2166136261; for (const c of String(id)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; }
  // Stronger consent than the advance loan; neither payment nor repeated review rerolls it.
  const willing = id => hash(`${id}:founding-commitment`) % 3 === 0;
  function layout(origin) {
    const cell = (x, y, dz = 0) => ({ x: origin.x + x, y: origin.y + y, z: origin.z + dz });
    const parts = [], gate = cell(-2, 1);
    for (let y = -2; y <= 4; y++) for (let x = -2; x <= 4; x++) {
      if (x !== -2 && x !== 4 && y !== -2 && y !== 4) continue;
      const door = x === -2 && y === 1;
      const corner = (x === -2 || x === 4) && (y === -2 || y === 4);
      parts.push({ id: `perimeter:${x}:${y}`, kind: door ? 'gate' : 'wall', cell: cell(x, y),
        // Corner courses need a genuinely adjacent exterior work position;
        // completed neighboring walls must not make the last corner unreachable.
        work: corner ? cell(x === -2 ? x - 1 : x + 1, y) : cell(x === -2 ? -1 : x === 4 ? 3 : x, y === -2 ? -1 : y === 4 ? 3 : y),
        costs: door ? { lumber: 8, metalParts: 4 } : { stoneBlocks: 32, metalParts: 2 }, seconds: door ? 1800 : 3600 });
    }
    const beds = [-1, 0, 1, 2].map(x => cell(x, 3));
    beds.forEach((c, i) => {
      parts.push({ id: `bed-floor:${i}`, kind: 'floor', cell: c, work: c, costs: { stoneBlocks: 2 }, seconds: 600 });
      parts.push({ id: `bed-roof:${i}`, kind: 'roof', cell: { ...c, z: c.z + 1 }, work: c, costs: { lumber: 6, cloth: 2 }, seconds: 900 });
    });
    parts.push({ id: 'supply-store', kind: 'store', cell: cell(3, 0), work: cell(2, 0), costs: { lumber: 8, metalParts: 4 }, seconds: 1200 });
    return { origin: copy(origin), gate, beds, staging: cell(1, 0), parts };
  }
  function totals(parts) { const out = {}; for (const p of parts) for (const [k, v] of Object.entries(p.costs)) out[k] = (out[k] || 0) + v; return out; }
  function create(binding, expedition, source) {
    if (!binding?.worldId || !binding.runId || !expedition?.camp || expedition.demonstratedAt == null
      || expedition.worldId !== binding.worldId || expedition.runId !== binding.runId || !source?.populationSourceId
      || !Number.isInteger(source.population) || source.population < COUNT + 8) return null;
    return { ...copy(binding), id: `${expedition.id}:works`, projectId: expedition.id, siteId: expedition.plan.siteId,
      source: copy(source), plan: copy(expedition.plan), layout: null, phase: 'assessment', investigations: {},
      job: null, quote: null, agreement: null, people: [], ledger: { allocated: 0, departed: [], returned: [], deaths: [] },
      parts: {}, lastAt: 0, milestoneAt: null, report: null, reason: '', history: [] };
  }
  function normalize(s) { return s?.id && s.worldId && s.runId && s.source?.populationSourceId && s.plan?.route?.length
    && Array.isArray(s.people) && new Set(s.people.map(p => p.actor?.id)).size === s.people.length
    && s.people.every(p => p.actor?.id && Number.isFinite(p.actor.health) && Number.isFinite(p.duty) && p.duty >= 0 && p.duty <= DUTY
      && Number.isFinite(p.earned) && p.earned >= 0 && p.earned <= DUTY * WAGE + 1e-6)
    && ['assessment', 'muster', 'outward', 'works', 'returning', 'abandoned', 'closed'].includes(s.phase)
    && s.people.length <= COUNT && s.ledger && ['departed', 'returned', 'deaths'].every(k => Array.isArray(s.ledger[k]))
    && Number.isFinite(s.lastAt) && s.parts && s.investigations && Array.isArray(s.history)
    && (!s.layout || same(s.layout, layout(s.plan.origin)))
    && (!s.agreement || s.layout && s.people.length === COUNT && Number.isFinite(s.agreement.endsAt))
    && (!s.job || s.job.claims?.toolId && Number.isFinite(s.job.progress) && s.job.progress >= 0
      && Number.isFinite(s.job.seconds) && s.job.seconds > 0 && s.job.progress <= s.job.seconds) ? copy(s) : null; }
  const bound = (s, c) => Boolean(s && c && s.worldId === c.worldId && s.runId === c.runId);
  const active = s => Boolean(s?.agreement && !['closed', 'abandoned'].includes(s.phase));
  const able = a => Boolean(a?.status === 'alive' && a.health >= 35 && (a.needs?.exertion || 0) < 80 && (a.needs?.thirst || 0) < 70 && (a.needs?.hunger || 0) < 85);
  function population(s, cityId, baseline) {
    if (!Number.isFinite(baseline)) return null;
    if (!s || s.source.cityId !== cityId) return { residents: baseline, availableLabor: baseline, away: 0, assigned: 0 };
    const away = s.ledger.departed.filter(id => !s.ledger.returned.includes(id)).length;
    const localDeaths = s.people.filter(p => p.actor.status === 'dead' && !s.ledger.departed.includes(p.actor.id)).length;
    const assigned = s.people.filter(p => p.phase === 'muster' && p.actor.status === 'alive').length;
    const residents = Math.max(0, baseline - away - localDeaths);
    return { residents, availableLabor: Math.max(0, residents - assigned), away, assigned };
  }
  function local(s, c) { return bound(s, c) && c.alive && c.free && c.capable && !c.busy && c.bodyEpoch != null; }
  function note(s, at, kind, text) { s.reason = text; s.history.push({ at, kind, text }); }
  // This is a scoped local test, NOT disclosure of all strategic resource truth.
  // No inventory is generated. Ground area comes only from personally observed natural tiles.
  function measurement(kind, context, groundCells, at) {
    if (!context?.truth || !context.siteId || !Number.isFinite(groundCells)) return null;
    const t = context.truth, n = hash(`${context.seed}:${context.siteId}:${kind}`) / 0xffffffff;
    const access = Math.max(0, Math.min(1, Number(t.surfaceAccessibilityPermille || 0) / 1000));
    const potential = key => Math.max(0, Math.min(1, Number(t.potentialPermille?.[key] || 0) / 1000));
    if (kind === 'stone') return { at, kind, siteId: context.siteId,
      estimatedStoneTonnes: Math.floor(potential('constructionStone') ** 2 * access * (12000 + n * 12000)),
      qualification: 'Bounded engineering estimate beneath the original exposed face; not proven recoverable reserves, extraction rights or stock.' };
    if (kind === 'water') return { at, kind, siteId: context.siteId,
      testLitresPerDay: Math.floor(potential('freshWater') ** 2 * access * (6000 + n * 18000)),
      qualification: 'Short local flow test, not seasonal security, drinking-water treatment or an installed supply.' };
    if (kind === 'ground') return { at, kind, siteId: context.siteId,
      testedSquareMetres: groundCells, cultivableSquareMetres: Math.floor(groundCells * potential('biologicalProductivity') * .8),
      qualification: 'Personally observed local natural ground only. No surrounding hectares or food production inferred.' };
    return null;
  }
  function beginInvestigation(s, c, kind, claims, captured, pay, at) {
    if (!local(s, c) || c.workFit === false || !c.atCamp || !c.safe || !c.campIntact || !c.sourceCurrent || s.job || s.agreement || s.investigations[kind]
      || !INVESTIGATIONS[kind] || captured?.kind !== kind || captured.siteId !== s.siteId || !claims?.toolId || !pay()) return false;
    s.job = { kind: 'investigation', investigation: kind, seconds: INVESTIGATIONS[kind], progress: 0, lastAt: at,
      attended: false, running: true, claims: copy(claims), captured: copy(captured), bodyEpoch: c.bodyEpoch, wear: 0 };
    s.lastAt = at;
    note(s, at, 'investigation', `Started ${kind} assessment with original equipment and spent test energy. Pausing does not refund inputs.`); return true;
  }
  function registerLayout(s, c, proposed, at) {
    if (!local(s, c) || !c.atCamp || !c.safe || !c.layoutClear || !c.supportRoute || !c.campIntact || s.layout || s.job || s.agreement
      || !same(proposed, layout(s.plan.origin))) return false;
    s.layout = copy(proposed); note(s, at, 'layout', 'Personally laid out original defensive construction compound and retained a known walking/support gate. This is not city ownership.'); return true;
  }
  function reviewReason(s, a, c) {
    if (!local(s, c) || !c.atCounter || !c.protectorAtHome || !c.sourceCurrent || !c.representativePresent || !c.advanceReturned || !c.routeOpen
      || !c.campIntact || !s.layout || s.job || s.agreement || s.people.length) return 'Meet the original people after physical advance return, with an intact original camp, measured site, clear works layout and practical support route.';
    if (!s.investigations.stone || !s.investigations.water || !s.investigations.ground) return 'Complete and receive all three actual site assessments first.';
    if (s.investigations.stone.estimatedStoneTonnes < 6000 || s.investigations.water.testLitresPerDay < 6000
      || s.investigations.ground.cultivableSquareMetres < 4) return 'The original measured site cannot support this resource-purpose founding proposal; no deposit or fertile land is added to rescue it.';
    if (!willing(a?.id) || c.protectorWilling === false || !able(a) || ![a.workSeconds, a.stamina, a.wardMana].every(Number.isFinite)
      || a.assignment || c.competingDuty || c.protectorIncapacitated || a.magicSuppressed || a.suppressionActive || a.workSeconds < c.returnReserve + 300
      || a.stamina < 40 || a.wardMana < 36 || !a.exceptionalCapabilities?.includes('city-scale ward defense')) return 'The same original exceptional protector declines or lacks the finite means for a longer independent founding commitment. No replacement or divine approval.';
    if (!Number.isFinite(c.availablePopulation) || c.availablePopulation < COUNT + 8 || !c.musterClear || !c.returnAdmission
      || !Array.isArray(c.musterCells) || c.musterCells.length !== COUNT || new Set(c.musterCells.map(cell => JSON.stringify(cell))).size !== COUNT)
      return 'Four genuine source residents, their clear muster positions and a scoped physical return agreement are required; no population grant.';
    return '';
  }
  function review(s, a, c, at) {
    s.quote = null; s.reason = reviewReason(s, a, c); if (s.reason) return null;
    return s.quote = { at, expiresAt: at + 120, actorId: a.id, sourceKey: s.source.sourceKey, bodyEpoch: c.bodyEpoch,
      fee: FEE, wageEscrow: COUNT * DUTY * WAGE, term: TERM, residents: COUNT, duties: DUTY,
      returnAdmission: copy(c.returnAdmission), musterCells: copy(c.musterCells), costs: totals(s.layout.parts),
      scope: 'One voluntary three-day founding protection commitment; original civic defense loses this person. Four source residents voluntarily migrate for eight paid construction hours each. Local food is insufficient: actual imported provisions are necessary. No allegiance, patron blessing or operational city.' };
  }
  function accept(s, a, c, expected, wallet, at) {
    const q = s.quote;
    if (!q || reviewReason(s, a, c) || !same(expected, q) || at < q.at || at >= q.expiresAt || c.bodyEpoch !== q.bodyEpoch
      || a.id !== q.actorId || !same(c.musterCells, q.musterCells) || !Number.isFinite(wallet?.money) || wallet.money < q.fee + q.wageEscrow) return false;
    wallet.money -= q.fee + q.wageEscrow; a.money = (a.money || 0) + q.fee; a.assignment = s.id;
    s.agreement = { ...copy(q), acceptedAt: at, endsAt: at + TERM }; s.quote = null; s.phase = 'muster'; s.lastAt = at;
    s.ledger.allocated = COUNT;
    s.people = c.musterCells.map((cell, i) => ({ phase: 'muster', willing: true, duty: DUTY, earned: 0, settled: false, kitId: null,
      actor: { id: `${s.source.populationSourceId}:founding-resident:${i}`, name: ['Mira Flint', 'Teren Vale', 'Sella Moss', 'Oren Pike'][i],
        actorKind: 'surfaceWorker', role: 'Consenting founding construction resident', present: true, status: 'alive', health: 100, maxHealth: 100,
        roomId: s.plan.home.roomId, mapCell: copy(cell), home: copy(cell), stamina: 100, fatigue: 0, skills: { fabrication: 35, striking: 8, guarding: 8, evasion: 10 },
        needs: { lastAt: at, hunger: 0, thirst: 0, exertion: 0, exposure: 0, harmRemainder: 0 }, assignment: s.id } }));
    note(s, at, 'agreement', 'Original protector committed for three days; same person unavailable to civic defense. Four identified source residents agreed to migrate, not yet departed or available at the works.'); return true;
  }
  function depart(s, a, c, provisions, at) {
    if (!active(s) || s.phase !== 'muster' || !local(s, c) || at >= s.agreement.endsAt || c.bodyEpoch !== s.agreement.bodyEpoch
      || !c.atCounter || !c.sourceCurrent || !c.routeOpen || !c.protectorAtHome
      || a.assignment !== s.id || !able(a) || !c.partySupplied || !Array.isArray(provisions) || provisions.length !== COUNT
      || new Set(provisions).size !== COUNT || s.people.some(p => !able(p.actor) || !p.willing)) return false;
    s.people.forEach((p, i) => { p.phase = 'outward'; p.kitId = provisions[i]; s.ledger.departed.push(p.actor.id); });
    s.phase = 'outward'; note(s, at, 'departure', 'Four original residents physically departed the source population with their own provisions and kits. Travel, needs and possessions remain real.'); return true;
  }
  function beginPart(s, c, id, claims, pay, at) {
    const p = s.layout?.parts.find(p => p.id === id);
    if (!local(s, c) || c.workFit === false || !active(s) || at >= s.agreement.endsAt || c.bodyEpoch !== s.agreement.bodyEpoch
      || s.phase !== 'works' || s.job || !p || s.parts[id] || !c.atCamp || !c.safe || !c.campIntact
      || !c.protectorPresent || !c.targetClear || !c.routeOpen || !c.supplied || !claims?.toolId || !pay()) return false;
    s.parts[id] = { startedAt: at, progress: 0, completeAt: null, physicalId: null };
    s.job = { kind: 'construction', partId: id, seconds: p.seconds, progress: 0, lastAt: at, attended: false,
      running: true, claims: copy(claims), bodyEpoch: c.bodyEpoch, wear: 0 };
    s.lastAt = at;
    note(s, at, 'construction', `Original ${id} materials incorporated into unfinished works; no cancellation refund.`); return true;
  }
  function interrupt(s, at, reason) {
    if (!active(s) || s.phase === 'returning') return false;
    s.phase = 'returning'; if (s.job) { s.job.running = false; s.job.attended = false; }
    for (const p of s.people) if (p.actor.status !== 'dead' && p.phase !== 'returned') p.phase = 'returning';
    note(s, at, 'withdrawal', reason); return true;
  }
  function advance(s, a, c, h, at) {
    if (!bound(s, c) || !c.alive || !Number.isFinite(at) || at <= s.lastAt) return false;
    const dt = at - s.lastAt; s.lastAt = at;
    // No private clock-gap catch-up for travel, labor, care, protection or inspections.
    if (dt > 2) { if (s.job) { s.job.lastAt = at; s.job.attended = false; } return false; }
    if (active(s)) {
      for (const p of s.people) if (p.actor.status === 'dead' && !s.ledger.deaths.includes(p.actor.id)) { s.ledger.deaths.push(p.actor.id); p.phase = 'dead'; }
      if (at >= s.agreement.endsAt || s.ledger.deaths.length || !c.sourceCurrent || !a || a.id !== s.agreement.actorId || a.assignment !== s.id
        || !able(a) || c.protectorIncapacitated || a.magicSuppressed || a.suppressionActive || a.wardMana < 12 || a.stamina < 15
        || !a.exceptionalCapabilities?.includes('city-scale ward defense') || !Number.isFinite(a.workSeconds)
        || a.workSeconds <= (c.returnReserve || 0) + 1 || c.bodyEpoch !== s.agreement.bodyEpoch || !c.campIntact)
        interrupt(s, at, 'Original protection, camp, recognition or finite commitment failed. Living people withdraw physically; property, wages and losses persist.');
      if (s.phase === 'outward' || s.phase === 'returning') {
        if (s.phase === 'outward' && !c.routeOpen) s.reason = 'Physical route obstructed; no arrival, replacement or labor credit.';
        else h.travel(s.phase === 'returning', dt);
        if (s.phase === 'outward' && c.arrived()) { s.phase = 'works'; s.people.forEach(p => { p.phase = 'resident'; }); note(s, at, 'arrival', 'Same original people arrived with actual possessions and needs. No operational city declared.'); }
        if (s.phase === 'returning' && c.returned()) {
          if (a?.assignment === s.id) a.assignment = null;
          s.phase = 'abandoned'; note(s, at, 'returned', 'Surviving original people physically returned. Unfinished works, corpses and spent resources remain. Unused construction wages require personal settlement.');
        }
      }
    }
    const j = s.job; if (!j) return true;
    const ready = local(s, c) && c.workFit !== false && c.jobAttendance !== false && j.running && c.safe && c.atCamp && c.campIntact && c.toolCurrent && c.bodyEpoch === j.bodyEpoch
      && (j.kind === 'investigation' ? c.sourceCurrent : s.phase === 'works' && c.protectorPresent && c.routeOpen && c.supplied && c.originalPart);
    j.lastAt = at;
    if (!ready || !j.attended) { j.attended = Boolean(ready); return true; }
    // Foreman attendance is paid before allocating any worker labor/wages.
    // Failed effort cannot charge workers for a second which never happened.
    if (!h.effort(j.kind === 'investigation' ? dt / 600 : dt / 900)) { j.attended = false; return true; }
    const work = Math.min(j.seconds - j.progress, j.kind === 'investigation' ? dt : h.labor(dt));
    if (work <= 0) return true;
    j.progress += work;
    const due = Math.floor(j.progress / j.seconds * 2) - j.wear;
    if (due > 0) { h.wear(due); j.wear += due; }
    if (j.kind === 'construction') {
      s.parts[j.partId].progress = j.progress;
      h.install(s.layout.parts.find(p => p.id === j.partId), s.parts[j.partId], work / j.seconds, at);
    }
    if (j.progress >= j.seconds) {
      if (j.kind === 'investigation') s.investigations[j.investigation] = { ...copy(j.captured), at };
      else s.parts[j.partId].completeAt = at;
      h.release(); s.job = null;
      note(s, at, 'workCompleted', j.kind === 'investigation' ? `Personally completed ${j.investigation} assessment. Limits and deficits retained.` : `Original ${j.partId} construction completed; current damage remains authoritative.`);
    }
    return true;
  }
  function milestone(s, c, at) {
    if (!local(s, c) || s.phase !== 'works' || at >= s.agreement.endsAt || c.bodyEpoch !== s.agreement.bodyEpoch
      || !c.atCamp || !c.safe || !c.protectorPresent || !c.supplied || !c.routeOpen
      || !c.physicalWorksIntact || s.job || s.people.some(p => p.phase !== 'resident' || !able(p.actor))
      || s.layout.parts.some(p => s.parts[p.id]?.completeAt == null)) return false;
    s.milestoneAt ??= at; note(s, at, 'milestone', 'Original four-person migration and supplied defensive compound completed. Historical construction milestone, not city viability, permanent safety or sovereignty.'); return true;
  }
  function settle(s, c, wallet) {
    if (!local(s, c) || !Number.isFinite(wallet?.money) || !c.atCounter || !c.returnAdmission || !['abandoned', 'closed'].includes(s.phase)) return false;
    let changed = false;
    for (const p of s.people) if (p.phase === 'returned' && !p.settled) {
      wallet.money += Math.max(0, DUTY * WAGE - p.earned); p.settled = true; changed = true;
    }
    return changed;
  }
  function absorb(s, a, c, hit, at) {
    const none = { damage: hit.amount, absorbed: 0 };
    if (!bound(s, c) || !active(s) || s.phase !== 'works' || !c.alive || !c.sourceCurrent || !c.protectorPresent || !c.lineOfEffect
      || !c.hostileBeast || !Number.isFinite(hit.amount) || hit.amount <= 0 || at >= s.agreement.endsAt
      || a?.assignment !== s.id || a.id !== s.agreement.actorId || !able(a) || c.incapacitated || a.magicSuppressed || a.suppressionActive
      || a.wardMana < 2 || a.workSeconds <= (c.returnReserve || 0) + 1
      || !['scientist', ...s.people.filter(p => p.phase === 'resident' && p.actor.status === 'alive').map(p => p.actor.id)].includes(hit.targetId)
      || (hit.damageTypes || []).some(t => /soul|psychic|divine/i.test(t))) return none;
    const absorbed = Math.min(6, hit.amount, a.wardMana / 2);
    a.wardMana -= absorbed * 2; a.workSeconds--;
    return { damage: hit.amount - absorbed, absorbed };
  }
  function receive(s, c, a, at) {
    if (!local(s, c) || !(c.atCamp || c.atCounter)) return false;
    s.report = { at, siteId: s.siteId, investigations: copy(s.investigations),
      agreement: copy(s.agreement), milestoneAt: s.milestoneAt, location: c.atCamp ? 'Original camp personally inspected' : 'Original municipal counter',
      people: s.people.filter(p => c.observedIds.includes(p.actor.id)).map(p => ({ id: p.actor.id, name: p.actor.name, phase: p.phase,
        health: p.actor.health, duty: p.duty, earned: p.earned })),
      protector: c.observedIds.includes(a?.id) ? { id: a.id, health: a.health, mana: a.wardMana, assignment: a.assignment } : null,
      parts: c.atCamp ? copy(c.observedParts) : null,
      population: c.atCounter ? { allocated: s.ledger.allocated, departed: s.ledger.departed.length, receivedReturns: s.ledger.returned.length } : null,
      limits: LIMITS };
    return true;
  }
  function rebind(s, from, to) { s = normalize(s); if (!bound(s, from)) return null;
    Object.assign(s, copy(to)); s.plan.worldId = to.worldId; return s; }
  return { TERM, FEE, DUTY, WAGE, COUNT, INVESTIGATIONS, LIMITS, willing, layout, totals, create, normalize, bound, active, able, population, absorb,
    measurement, beginInvestigation, registerLayout, reviewReason, review, accept, depart, beginPart, interrupt, advance, milestone, settle, receive, rebind };
});
