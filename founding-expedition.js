(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFoundingExpedition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const FEE = 240, TERM = 21600, BUILD = 660, WATCH = 600;
  const LIMITS = 'One prospective stone-resource founding camp, not a city, land title, migration, new deposit or divine endorsement. Original city protector and scientist walk the personally known boundary route with their own supplies. A six-hour voluntary municipal release costs 240 marks, earned on departure; no replacements or automatic refund. Two original sleeping kits, three lumber, one metal part, an actual hammer and eleven attended construction minutes establish a temporary camp. Ten supported minutes and actual shared provisions demonstrate only the advance camp. City-scale resources, protecting commitment, food, population, routes and institutions remain separate later work.';
  function willing(id) { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) % 7 === 0; }
  function create(b) { return b?.worldId && b.runId ? { ...copy(b), id: `${b.runId}:founding-expedition`, plan: null,
    phase: 'planning', quote: null, agreement: null, job: null, camp: null, lastAt: 0, continuityFrom: null,
    demonstratedAt: null, mealAt: null, care: null, report: null, history: [], reason: '' } : null; }
  function normalize(s) { return s?.id && s.worldId && s.runId && Array.isArray(s.history)
    && ['planning', 'outward', 'camp', 'returning', 'returned', 'fatality'].includes(s.phase) && Number.isFinite(s.lastAt) ? copy(s) : null; }
  const active = s => Boolean(s?.agreement && !['returned', 'fatality'].includes(s.phase));
  const bound = (s, c) => Boolean(s && s.worldId === c.worldId && s.runId === c.runId);
  function inspectionReason(s, c, plan, now) {
    if (!bound(s, c)) return 'This project belongs to a different world or run.';
    if (!c.alive || !c.free || !c.capable || c.busy) return 'Personally inspect while alive, free, capable and without conflicting work.';
    if (active(s) || s.camp || s.job) return 'The original expedition or partial property already exists; it cannot be replaced by another registration.';
    if (!c.inspectedSite) return 'Choose a personally observed clear plot near an inspected workable face and received water/growing reconnaissance, with a connected known return route.';
    if (!plan?.siteId || !plan.stoneNodeId || !plan.observationIds?.length) return 'The inspected source or received evidence is incomplete.';
    if (!Array.isArray(plan.route) || plan.route.length < 2) return 'The connected walking route is incomplete.';
    if (!Number.isFinite(now)) return 'No valid observation time is available.';
    return '';
  }
  function inspect(s, c, plan, now) {
    const why = inspectionReason(s, c, plan, now); if (why) { if (s) s.reason = why; return false; }
    s.plan = copy(plan); s.quote = null; s.lastAt = now;
    s.history.push({ at: now, kind: 'site', text: 'Personally inspected a provisional stone-resource camp plot and known boundary walking route. Water/growing indicators are not a city food or water supply.' }); return true;
  }
  function refusal(s, a, c) {
    if (!bound(s, c) || !s.plan || !c.planCurrent || !c.sourceCurrent) return 'Original inspected site, route and municipal source are required.';
    if (!c.alive || !c.free || !c.capable || c.busy || !c.personalMuster || !c.representativePresent) return 'Personally meet the original representative and protector, capable and free of conflicting work.';
    if (active(s) || s.camp || s.phase === 'fatality') return 'The original expedition/property cannot be replaced by a fresh founding project.';
    if (!a || !c.protectorWilling || !willing(a.id)) return 'This original protector retains city duties and declines a heretical independent foundation. No replacement or divine consent is supplied.';
    if (![a.health, a.workSeconds, a.stamina, a.wardMana].every(Number.isFinite)
      || a.assignment || c.competingDuty || c.incapacitated || a.status === 'dead' || a.health < 70 || a.fatigue >= 65
      || a.workSeconds < BUILD + WATCH + 60 || a.stamina < 40 || a.wardMana < 24) return 'The original protector is assigned, wounded, exhausted or lacks finite work/personal reserves.';
    if (!c.provisions || !c.kits || !c.routeOpen) return 'Personally supply the original protector and scientist with separate sleeping kits, food and water, and preserve the inspected walking route.';
    return '';
  }
  function review(s, a, c, now) {
    if (!s) return null;
    s.quote = null; s.reason = refusal(s, a, c); if (s.reason) return null;
    return s.quote = { at: now, expiresAt: now + 120, actorId: a.id, bodyEpoch: c.bodyEpoch,
      sourceId: c.sourceId, representativeId: c.representativeId, plan: copy(s.plan), fee: FEE, term: TERM, scope: LIMITS };
  }
  function accept(s, a, c, expected, wallet, now) {
    const q = s?.quote;
    if (!q || refusal(s, a, c) || !same(q, expected) || now < q.at || now >= q.expiresAt || q.bodyEpoch !== c.bodyEpoch
      || q.actorId !== a.id || q.sourceId !== c.sourceId || q.representativeId !== c.representativeId
      || !same(q.plan, s.plan) || !Number.isFinite(wallet?.money) || wallet.money < FEE) return false;
    wallet.money -= FEE; a.money = (a.money || 0) + FEE; a.assignment = s.id;
    s.agreement = { ...copy(q), acceptedAt: now, endsAt: now + TERM }; s.quote = null; s.phase = 'outward';
    s.lastAt = now; s.bodyEpoch = c.bodyEpoch; s.reason = 'Original protector released for one bounded accompanied advance expedition; absent from original civic duties.';
    s.history.push({ at: now, kind: 'release', text: s.reason }); return true;
  }
  function withdraw(s, now, reason) {
    if (!active(s)) return false;
    s.phase = 'returning'; if (s.job) { s.job.running = false; s.job.attended = false; }
    s.continuityFrom = null; s.reason = reason; s.history.push({ at: now, kind: 'withdrawal', text: reason }); return true;
  }
  function beginBuild(s, c, claims, now) {
    if (!bound(s, c) || !c.alive || !c.capable || !c.free || c.busy || s.phase !== 'camp' || !c.atWork || !c.protectorAtPost
      || !c.planCurrent || !c.sourceCurrent || !c.groundSafe || !claims || s.camp || s.job) return false;
    s.job = { claims: copy(claims), progress: 0, lastAt: now, running: true, attended: false, wear: 0 };
    return true;
  }
  function progress(s, a, c, h, now) {
    const j = s.job; if (!j || !Number.isFinite(now) || now <= j.lastAt) return;
    const dt = now - j.lastAt; j.lastAt = now;
    const ready = dt <= 2 && !c.busy && !c.incapacitated && j.running && s.phase === 'camp' && c.alive && c.free && c.capable && c.bodyEpoch === s.bodyEpoch
      && c.atWork && c.protectorAtPost && c.planCurrent && c.sourceCurrent && c.groundSafe && c.buildClaimsCurrent && a.workSeconds > 0;
    if (!ready || !j.attended) { j.attended = Boolean(ready); return; }
    const work = Math.min(dt, BUILD - j.progress, a.workSeconds);
    if (!h.work(work)) { j.attended = false; return; }
    j.progress += work; a.workSeconds -= work;
    const due = Math.floor(j.progress / BUILD * 2) - j.wear;
    if (due > 0) { h.wear(due); j.wear += due; }
    if (j.progress >= BUILD && h.finish()) {
      s.camp = { crateId: j.claims.crateId, kitIds: copy(j.claims.kitIds), completedAt: now };
      s.job = null; s.reason = 'Actual temporary founding camp built. No city, permanent protection, inhabitants or local production granted.';
      s.history.push({ at: now, kind: 'camp', text: s.reason });
    }
  }
  function shareMeal(s, c, h, now) {
    if (!bound(s, c) || s.phase !== 'camp' || !s.camp || s.mealAt != null || !c.alive || !c.free || !c.capable
      || c.bodyEpoch !== s.bodyEpoch || !c.atWork || !c.protectorAtPost || !c.campIntact || !c.groundSafe || !h()) return false;
    s.mealAt = now; s.continuityFrom = null; return true;
  }
  function advance(s, a, c, h, now) {
    if (!active(s) || !bound(s, c) || !c.alive || !Number.isFinite(now) || now <= s.lastAt) return false;
    // Runtime calls this on a one-second shared heartbeat. No bulk travel or
    // physical work backfill is inferred from a saved wall-clock gap.
    const dt = now - s.lastAt; s.lastAt = now;
    if (!a || a.id !== s.agreement.actorId || a.assignment !== s.id) {
      s.reason = 'Original person/assignment unavailable; no substitute or backfilled work.';
      s.continuityFrom = null; if (s.job) { s.job.attended = false; s.job.lastAt = now; } return false;
    }
    if (a.status === 'dead' || a.health <= 0) {
      s.phase = 'fatality'; s.continuityFrom = null;
      if (s.job) { s.job.running = false; s.job.attended = false; s.job.lastAt = now; }
      s.reason = 'Original protector died; actual property, injuries and spent fee persist.'; return true;
    }
    if (c.bodyEpoch !== s.bodyEpoch || !c.sourceCurrent || !c.planCurrent || now >= s.agreement.endsAt || a.health < 35
      || a.workSeconds <= (c.returnReserve || 0) || a.stamina <= 5 || a.needs?.hunger >= 85 || a.needs?.thirst >= 70)
      if (s.phase !== 'returning') withdraw(s, now, 'Original commitment, support, body recognition or finite reserves ended; physical withdrawal only.');
    if (c.incapacitated) { s.reason = 'Original protector incapacitated; no movement, replacement, refund or rescue.'; s.continuityFrom = null; if (s.job) { s.job.attended = false; s.job.lastAt = now; } return false; }
    if (s.phase === 'returning') {
      if (c.atHome) { s.phase = 'returned'; a.assignment = null; s.history.push({ at: now, kind: 'returned', text: 'Same protector physically returned with remaining personal goods and condition. Camp property remains at its actual site.' }); }
      else h.move(s.plan.home.cell, now, true);
    } else if (s.phase === 'outward') {
      if (c.protectorAtPost) { s.phase = 'camp'; s.reason = 'Original advance party reached the prospective plot; construction still needs actual materials and attendance.'; }
      else if (c.accompanied && c.routeOpen && c.groundSafe) h.move(s.plan.post, now, false);
      else s.reason = 'Waiting for personal accompaniment, an unobstructed known route and safe movement; no remote march.';
    }
    progress(s, a, c, h, now);
    const supported = dt <= 2 && c.alive && c.free && c.capable && !c.busy && c.bodyEpoch === s.bodyEpoch && s.phase === 'camp' && s.camp && s.mealAt != null && c.atWork && c.protectorAtPost
      && c.campIntact && c.groundSafe && c.planCurrent && c.sourceCurrent && a.stamina >= 20 && a.wardMana >= 12;
    if (!supported) s.continuityFrom = null;
    else {
      s.continuityFrom ??= now;
      a.workSeconds = Math.max(0, a.workSeconds - dt); a.stamina = Math.max(0, a.stamina - dt / 120);
      if (s.demonstratedAt == null && now - s.continuityFrom >= WATCH) {
        s.demonstratedAt = now; s.history.push({ at: now, kind: 'demonstrated', text: 'Ten actual supported minutes with the original advance party and consumed provisions. Temporary founding camp only, not a viable city or permanent guardian commitment.' });
      }
    }
    return true;
  }
  function receive(s, c, now) {
    if (!bound(s, c) || !c.alive || !c.capable || !(c.atWork || c.personalMuster)) return false;
    const observedOriginal = c.protectorAtPost || Boolean(c.protectorAccount) || c.personalMuster;
    s.report = { at: now, phase: observedOriginal ? s.phase : 'camp inspected; absent protector unverified', purpose: 'Prospective construction-stone resource foundation',
      protector: copy(c.protectorAccount || null), endsAt: s.agreement?.endsAt ?? null,
      demonstratedAt: c.atWork ? s.demonstratedAt : null, camp: c.atWork ? copy(s.camp) : null, campIntact: c.atWork ? Boolean(c.campIntact) : null,
      reason: c.atWork ? observedOriginal ? s.reason : 'Personally inspected the camp plot. The absent original protector and unseen route remain unverified.'
        : 'Personally received original municipal agreement/return account. Unseen camp condition remains unverified.' };
    return true;
  }
  function rebind(value, from, to) {
    const s = normalize(value); if (!s || s.worldId !== from?.worldId || s.runId !== from?.runId) return null;
    s.worldId = to.worldId; s.runId = to.runId;
    if (s.plan?.worldId === from.worldId) s.plan.worldId = to.worldId;
    if (s.agreement?.plan?.worldId === from.worldId) s.agreement.plan.worldId = to.worldId;
    if (s.quote?.plan?.worldId === from.worldId) s.quote.plan.worldId = to.worldId;
    return s;
  }
  return { FEE, TERM, BUILD, WATCH, LIMITS, willing, create, normalize, active, bound, inspect, inspectionReason, refusal, review, accept, withdraw, beginBuild, progress, shareMeal, advance, receive, rebind };
});
