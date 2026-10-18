(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFieldEvacuation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CARE_BUDGET = 180;
  const phases = ['approach', 'aid', 'drag', 'load', 'transport', 'unload', 'receiving', 'handedOver', 'ended'];
  const active = e => Boolean(e && !['handedOver', 'ended'].includes(e.phase));
  function valid(e, booking) {
    return Boolean(e && booking?.aidPlan && e.bookingId === booking.id && e.bodyEpoch === booking.bodyEpoch
      && ['scientist', booking.escortId].includes(e.patientId)
      && e.helperId === (e.patientId === 'scientist' ? booking.escortId : 'scientist')
      && phases.includes(e.phase) && Number.isFinite(e.nextAt) && Number.isFinite(e.startedAt));
  }
  function start(booking, patientId, at) {
    if (!booking?.aidPlan || !['scientist', booking.escortId].includes(patientId)) return null;
    return { bookingId: booking.id, bodyEpoch: booking.bodyEpoch, patientId,
      helperId: patientId === 'scientist' ? booking.escortId : 'scientist', phase: 'approach',
      startedAt: at, nextAt: at, work: null, secured: false, reason: 'Original helper approaching the living casualty.' };
  }
  function capacity(bodyKg, gearKg, helperGearKg, stretcherKg = 0) {
    return [bodyKg, gearKg, helperGearKg, stretcherKg].every(Number.isFinite) && bodyKg > 0
      && Math.min(gearKg, helperGearKg, stretcherKg) >= 0
      && bodyKg + gearKg + helperGearKg + stretcherKg <= 180;
  }
  function hold(e, reason, at) {
    e.reason = reason; e.work = null; e.nextAt = at + 1;
  }
  // Hooks move original bodies and consume original supplies. This controller
  // never manufactures an actor, item, medical outcome or transport allocation.
  function advance(e, c, h, at) {
    if (!active(e) || !c.alive || at < e.nextAt) return false;
    if (!c.original || !c.patientAlive) { e.phase = 'ended'; hold(e, 'Original living participants are unavailable; bodies and property remain in place.', at); return true; }
    if (!c.helperCapable || !c.willing) { hold(e, 'Original helper cannot or will not continue; no replacement is supplied.', at); return false; }
    if (e.phase === 'transport') { e.reason = 'Secured original casualty travelling in the paid original van.'; return false; }
    if (c.threatened || !c.capacity) { hold(e, c.threatened ? 'Visible danger interrupts assistance.' : 'Actual body, equipment or helper load exceeds safe assistance capacity.', at); return false; }
    const timed = (key, seconds, finish) => {
      if (!e.work || e.work.key !== key) { e.work = { key, dueAt: at + seconds }; e.nextAt = at + 1; return false; }
      if (at < e.work.dueAt) { e.nextAt = at + 1; return false; }
      if (!finish()) { hold(e, 'Physical handling is obstructed; original people and goods remain in place.', at); return false; }
      e.work = null; e.nextAt = at + 1; return true;
    };
    if (e.phase === 'approach') {
      if (h.adjacent()) { e.phase = 'aid'; e.nextAt = at + 1; }
      else { if (!h.approach()) hold(e, 'The original casualty cannot be reached along the physical ground.', at); else e.nextAt = at + 4; }
    } else if (e.phase === 'aid') {
      if (!h.adjacent()) { e.phase = 'approach'; hold(e, 'Casualty contact lost.', at); }
      else if (!c.injuryId) { e.phase = 'drag'; e.nextAt = at + 1; }
      else if (!c.supplyId) hold(e, 'Appropriate carried first-aid supply is missing; no stabilization or free medicine.', at);
      else if (timed(`${c.injuryId}:${c.supplyId}`, 45, h.stabilize)) e.reason = 'One actual injury stabilized, not healed.';
    } else if (e.phase === 'drag' || e.phase === 'receiving') {
      if (!h.adjacent()) { hold(e, 'Helper separated from the actual casualty.', at); return false; }
      if (e.phase === 'receiving' && h.atReceiving()) {
        if (h.handover()) { e.phase = 'handedOver'; e.handedOverAt = at; e.reason = 'Actual patient accepted by the original single-bed clinic.'; }
        else hold(e, 'Original clinic is occupied or unavailable; patient and supplies remain physically waiting.', at);
      } else if (e.phase === 'drag' && h.atVan()) { e.phase = 'load'; e.nextAt = at + 1; }
      else { if (!h.drag(e.phase === 'receiving')) hold(e, 'Casualty route is physically blocked.', at);
        else { e.nextAt = at + 4; e.reason = e.phase === 'receiving' ? 'Moving the actual casualty toward municipal receiving ground.' : 'Dragging the actual casualty toward the original parked van.'; } }
    } else if (e.phase === 'load') {
      if (!c.stretcherId || !h.adjacent() || !h.atVan()) hold(e, 'Bring an actual folding stretcher and both original people to the parked van.', at);
      else if (timed(`load:${c.stretcherId}`, 30, h.load)) { e.stretcherId = c.stretcherId; e.secured = true; e.phase = 'transport'; }
    } else if (e.phase === 'unload') {
      if (!c.stretcherId || c.stretcherId !== e.stretcherId) hold(e, 'Original secured stretcher is missing.', at);
      else if (timed(`unload:${e.stretcherId}`, 30, h.unload)) { e.secured = false; e.phase = 'receiving'; }
    }
    return true;
  }
  return { CARE_BUDGET, active, valid, start, capacity, hold, advance };
});
