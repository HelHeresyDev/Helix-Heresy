(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HelixForeignLodging = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PRICE = 20, CHECK_IN = 60, STAY = 8 * 3600;
  const copy = x => JSON.parse(JSON.stringify(x));
  const able = a => a?.status === 'alive' && Number.isFinite(a.health) && a.health >= 50 && (a.fatigue || 0) < 80;
  function publish(g, source, at) {
    if (g?.visitorLodging) return g.visitorLodging;
    if (!g?.materialized || !g.visitorAdmission || !source || source.cityId !== g.cityId || source.currentPopulation < 2
      || source.physicalCondition === 'ruined' || !source.currentAuthority || source.administrationId !== g.institutionId
      || source.lawId !== g.visitorAdmission.rule.lawId || !['functional', 'strong', 'regionalHub'].includes(source.capacityBand)) return null;
    return g.visitorLodging = { rule: { id: `${g.id}:lodging-rule`, cityId: g.cityId, authorityId: g.institutionId,
      lawId: source.lawId, publishedAt: at, price: PRICE, checkInSeconds: CHECK_IN, staySeconds: STAY,
      scope: 'Visitor annex and one guest berth only. No trading extension, residence, employment, research, immunity, supplies or transport.' },
      berth: { id: `${g.id}:guest-berth`, roomId: g.annexRoomId, cell: { x: 19, y: 6, z: g.z }, condition: 100, reservedBy: null },
      job: null, stays: [], history: [], serial: 0, observation: null, money: 0, message: '' };
  }
  function excluded(g, c) {
    return (c.bans || []).some(b => b.status === 'active' && (b.cityId === g.cityId
      || b.recognizedBy?.some(r => r.cityId === g.cityId && r.localOrderId && r.institutionId && r.status === 'active')));
  }
  function permission(g, epoch, visitId, at) {
    return g?.visitorLodging?.stays.find(p => p.bodyEpoch === epoch && p.visitId === visitId && p.issuedAt <= at
      && at < p.expiresAt && p.releasedAt == null && g.visitorLodging.berth?.reservedBy === p.id) || null;
  }
  function sourceReady(g, c) {
    const s = g?.visitorLodging;
    return Boolean(s && c.sourceCurrent && c.authorityCurrent && c.accommodationIntact && s.berth?.condition >= 50
      && s.rule.cityId === g.cityId && s.rule.authorityId === g.institutionId && s.rule.lawId === g.visitorAdmission?.rule.lawId
      && s.berth.roomId === g.annexRoomId && !excluded(g, c));
  }
  function attendance(g, c, j = null) {
    return sourceReady(g, c) && c.alive && c.capable && c.local && c.atDesk && c.clerkPresent && c.lineOfSight
      && !c.otherBusy && able(g.clerk) && g.receptionWorkSeconds > 0 && g.powerSeconds > 0
      && (!g.receptionAssignment || g.receptionAssignment === j?.id) && !g.visitorAdmission.job
      && (!j || g.clerk.id === j.clerkId);
  }
  function quote(g, c, at) {
    const s = g?.visitorLodging, p = c.visitorPermit;
    if (!s || !s.berth || s.job || s.berth.reservedBy || !attendance(g, c) || g.receptionWorkSeconds < CHECK_IN || g.powerSeconds < CHECK_IN
      || !p || p.cityId !== g.cityId || p.bodyEpoch !== c.bodyEpoch || p.visitId !== c.visitId || p.issuedAt > at || p.expiresAt <= at + CHECK_IN) return null;
    return { ruleId: s.rule.id, cityId: g.cityId, authorityId: g.institutionId, lawId: s.rule.lawId,
      clerkId: g.clerk.id, berthId: s.berth.id, berthCondition: s.berth.condition, roomId: s.berth.roomId, cell: copy(s.berth.cell),
      bodyEpoch: c.bodyEpoch, visitId: c.visitId, visitorPermitId: p.id, visitorExpiresAt: p.expiresAt,
      total: PRICE, checkInSeconds: CHECK_IN, staySeconds: STAY, scope: s.rule.scope, quotedAt: at, expiresAt: at + 60 };
  }
  function begin(g, c, expected, wallet, at) {
    if (!expected || !Number.isFinite(expected.quotedAt) || expected.quotedAt > at || at >= expected.expiresAt || !Number.isFinite(wallet.money)) return false;
    const q = quote(g, c, at);
    if (!q || JSON.stringify({ ...q, quotedAt: expected.quotedAt, expiresAt: expected.expiresAt }) !== JSON.stringify(expected) || wallet.money < PRICE) return false;
    const s = g.visitorLodging, id = `${g.id}:lodging:${++s.serial}`;
    wallet.money -= PRICE; s.berth.reservedBy = id; g.receptionAssignment = id;
    s.job = { id, quote: copy(expected), clerkId: g.clerk.id, bodyEpoch: c.bodyEpoch, visitId: c.visitId,
      berthId: s.berth.id, progress: 0, lastAt: at, ready: true, escrow: PRICE };
    s.message = 'One original guest berth reserved; $20 held in escrow. One attended minute of check-in remains. No lodging permission or rest yet.'; return true;
  }
  function cancel(g, c, wallet, at) {
    const s = g?.visitorLodging, j = s?.job;
    if (!j || !c.alive || !c.local || j.bodyEpoch !== c.bodyEpoch || !Number.isFinite(wallet.money)) return false;
    wallet.money += j.escrow;
    s.history.push({ id: j.id, at, kind: 'cancelled', progress: j.progress, refund: j.escrow }); j.escrow = 0;
    if (g.receptionAssignment === j.id) g.receptionAssignment = null;
    if (s.berth?.reservedBy === j.id) s.berth.reservedBy = null;
    s.job = null; s.message = 'Unfinished check-in canceled: full $20 escrow refunded once. Actual clerk work and terminal power remain spent.'; return true;
  }
  function advance(g, c, at) {
    const s = g?.visitorLodging; if (!s || !c.alive) return false;
    let changed = false;
    for (const p of s.stays) if (p.releasedAt == null && at >= p.expiresAt) {
      p.releasedAt = p.expiresAt;
      if (s.berth?.reservedBy === p.id) s.berth.reservedBy = null;
      s.history.push({ id: p.id, at: p.expiresAt, kind: 'expired', refund: 0 });
      s.message = 'Eight-hour lodging permission expired. No new berth rest or entry is authorized; departure remains possible without automatic eviction, arrest or confiscation.';
      changed = true;
    }
    const j = s.job; if (!j) return changed;
    const dt = Math.max(0, at - j.lastAt), previousAt = j.lastAt; j.lastAt = Math.max(at, j.lastAt); if (!dt) return changed;
    const originalPermit = g.visitorAdmission.permits.find(p => p.id === j.quote.visitorPermitId && p.cityId === g.cityId
      && p.bodyEpoch === j.bodyEpoch && p.visitId === j.visitId && p.expiresAt === j.quote.visitorExpiresAt);
    if (j.bodyEpoch !== c.bodyEpoch || j.visitId !== c.visitId || !attendance(g, c, j) || s.berth.id !== j.berthId
      || s.berth.reservedBy !== j.id || JSON.stringify(s.berth.cell) !== JSON.stringify(j.quote.cell)
      || !originalPermit) {
      j.ready = false; s.message = 'Original check-in attendance, visitor approval, people, berth or authority unavailable. Escrow and partial work remain; cancel locally for the full refund.'; return true;
    }
    if (!j.ready) { j.ready = true; return true; }
    const seconds = Math.max(0, Math.min(dt, CHECK_IN - j.progress, g.receptionWorkSeconds, g.powerSeconds, j.quote.visitorExpiresAt - previousAt));
    j.progress += seconds; g.receptionWorkSeconds -= seconds; g.powerSeconds -= seconds;
    const completedAt = previousAt + seconds;
    if (j.progress < CHECK_IN || completedAt >= j.quote.visitorExpiresAt) return changed || seconds > 0;
    const p = { id: j.id, cityId: g.cityId, bodyEpoch: j.bodyEpoch, visitId: j.visitId, berthId: j.berthId,
      clerkId: j.clerkId, ruleId: j.quote.ruleId, issuedAt: completedAt, expiresAt: completedAt + STAY,
      scope: 'visitorAnnexAndGuestBerthOnly', price: PRICE, releasedAt: null };
    s.stays.push(p); s.money += j.escrow; j.escrow = 0;
    s.history.push({ id: j.id, at: completedAt, kind: 'checkedIn', clerkSeconds: j.progress, price: PRICE });
    if (g.receptionAssignment === j.id) g.receptionAssignment = null;
    s.job = null; s.message = 'Eight-hour lodging permit issued after actual check-in. Walk to the original berth and use ordinary rest; food, water and return transport remain separate.';
    // A coarse update cannot extend a stay by dating completion at the end of the update.
    if (at >= p.expiresAt) { p.releasedAt = p.expiresAt; s.berth.reservedBy = null;
      s.history.push({ id: p.id, at: p.expiresAt, kind: 'expired', refund: 0 });
      s.message = 'Lodging stay already expired after its actual check-in completion; no renewed permission or refund.'; }
    return true;
  }
  function restReason(g, c, at, seconds = 0, stayId = null) {
    const p = permission(g, c.bodyEpoch, c.visitId, at), s = g?.visitorLodging;
    if (!c.alive || !c.capable || !c.local || !c.atBerth || !sourceReady(g, c) || !p || stayId && p.id !== stayId
      || p.berthId !== s.berth.id || seconds > 0 && seconds >= p.expiresAt - at)
      return 'Physically occupy the original usable berth with matching current-body lodging permission and enough paid time. Food, water and treatment are separate.';
    return '';
  }
  function observe(g, c, at) {
    const s = g?.visitorLodging;
    if (!s || !c.alive || !c.local || !(c.atDesk && c.clerkPresent && c.lineOfSight && able(g.clerk) || c.atBerth)) return s?.observation || null;
    const p = permission(g, c.bodyEpoch, c.visitId, at);
    s.observation = { at, cityId: g.cityId, bodyEpoch: c.bodyEpoch, visitId: c.visitId, rule: copy(s.rule),
      message: s.message, berthId: s.berth?.id || null, condition: s.berth?.condition ?? null, permit: p && copy(p),
      checkIn: s.job?.bodyEpoch === c.bodyEpoch && s.job?.visitId === c.visitId ? { progress: s.job.progress, seconds: CHECK_IN } : null };
    return s.observation;
  }
  function nextEvent(g, c, at) {
    const s = g?.visitorLodging; if (!s || !c.alive || !c.local) return null;
    const j = s.job, p = permission(g, c.bodyEpoch, c.visitId, at);
    if (j && j.bodyEpoch === c.bodyEpoch && j.visitId === c.visitId && attendance(g, c, j) && c.visitorPermit?.id === j.quote.visitorPermitId)
      return { time: at + (j.ready ? Math.max(1, Math.min(CHECK_IN - j.progress, g.receptionWorkSeconds, g.powerSeconds)) : 1), label: 'Attended lodging check-in', type: 'travel' };
    return p && { time: p.expiresAt, label: 'Guest-berth lodging expiry', type: 'travel' };
  }
  return { PRICE, CHECK_IN, STAY, publish, quote, begin, cancel, advance, permission, sourceReady, restReason, observe, nextEvent };
});
