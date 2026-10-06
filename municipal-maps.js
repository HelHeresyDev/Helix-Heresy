(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixMunicipalMaps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const CATALOG = Object.freeze([
    { id: 'groundPlan', label: 'Authorized survey-ground plan', fee: 25, seconds: 600, purpose: 'Municipal sampling visit' },
    { id: 'returnBrief', label: 'Booked return-travel brief', fee: 15, seconds: 300, purpose: 'Return on the existing municipal booking' }
  ]);
  const limits = 'Dated archive copy, not live telemetry. No surrounding terrain, mineral surveys, beast positions, ownership, extraction, construction or onward travel rights.';
  const ready = office => Boolean(office?.active && office.channelPowered && office.clerk?.status === 'alive'
    && office.clerk.health >= 50 && (office.clerk.fatigue || 0) < 80 && office.clerk.locationId === office.id);
  const present = (office, ctx) => Boolean(ctx?.alive && ctx.capable && ctx.atCounter && ctx.clerkPresent && ctx.lineOfSight && ctx.cityId === office?.cityId);

  function bind(office, destination, baseline, at) {
    if (!office?.institutionId || office.cityId !== destination?.cityId || baseline?.placeId !== destination.id) return null;
    // A delegation to the already materialized civic counter, never new staff.
    return { officeId: office.id, institutionId: office.institutionId, cityId: office.cityId,
      contact: { label: office.contact.label, handle: office.contact.handle }, discoveredAt: at, accessActive: true,
      archive: { placeId: destination.id, label: destination.label, source: 'Municipal authorized-site plan', surveyDate: null,
        coverage: { x: baseline.bounds.x, y: baseline.bounds.y, z: baseline.bounds.z, width: baseline.bounds.width, height: baseline.bounds.height },
        notes: ['Authorized sampling parcel only.', 'Rendezvous at local 10,10; civic counter at 17,8.', 'Flagged ground requires on-site inspection.'] },
      copies: [], requests: [], job: null, message: '' };
  }
  function reason(state, office, id, ctx) {
    const item = CATALOG.find(row => row.id === id);
    if (!state || office?.id !== state.officeId || office.institutionId !== state.institutionId || office.cityId !== state.cityId) return 'No discovered municipal provider for this locality.';
    if (!item) return 'This provider withholds wider maps and all material surveys.';
    if (!state.accessActive) return 'Further access has been withdrawn; acquired copies remain yours.';
    if (!ctx?.visitPermission || ctx.placeId !== state.archive.placeId) return 'A current permission for this municipal visit is required; money alone is insufficient.';
    if (id === 'returnBrief' && (!ctx.returnBooking?.id || !ctx.returnBooking?.destinationLabel)) return 'No existing municipal return booking supports this request.';
    if (state.job || office.assignment) return 'The clerk is already assigned to work.';
    if (state.copies.some(row => row.extractId === id)) return 'You already hold this archive extract; no newer edition is offered.';
    if (!ready(office) || !present(office, ctx) || ctx.busy) return 'Attend the counter with a capable available clerk; remote purchase is unavailable.';
    if (office.power < 1 || office.workSeconds < item.seconds) return 'The office lacks finite power or work capacity for this copy.';
    return '';
  }
  function request(state, office, id, ctx, wallet, at) {
    const blocked = reason(state, office, id, ctx);
    if (blocked) { if (state) state.message = blocked; return false; }
    const item = CATALOG.find(row => row.id === id);
    if (!(wallet.money >= item.fee)) { state.message = 'Insufficient funds; no fee or office resource consumed.'; return false; }
    const requestId = `${office.id}:map-request:${state.requests.length + 1}`;
    const contents = id === 'groundPlan' ? copy(state.archive) : {
      source: 'Existing municipal return booking', surveyDate: null,
      coverage: { from: state.archive.label, to: String(ctx.returnBooking.destinationLabel) },
      notes: ['Return via the already booked municipal carrier; meet its vehicle at the survey ground.', 'No corridor terrain map or permission for another destination is included.'],
      bookingId: String(ctx.returnBooking.id)
    };
    state.requests.push({ id: requestId, extractId: id, at, fee: item.fee, purpose: item.purpose, status: 'working' });
    state.job = { id: requestId, extractId: id, clerkId: office.clerk.id, bodyEpoch: ctx.bodyEpoch,
      contents, progress: 0, seconds: item.seconds, lastAt: at, wasReady: true };
    office.assignment = requestId; office.power--; office.money += item.fee; wallet.money -= item.fee;
    state.message = 'Request accepted. Remain at the counter while the clerk prepares the copy. The fee pays for work, not new access rights.';
    return true;
  }
  function release(office, job, at) {
    if (office?.assignment === job.id) { office.assignment = null; office.availableAt = at; }
  }
  function cancel(state, office, at, message = 'Request cancelled. Paid fees and spent work are not refunded; no copy was issued.') {
    const job = state?.job; if (!job) return false;
    release(office, job, at);
    Object.assign(state.requests.find(row => row.id === job.id), { status: 'cancelled', endedAt: at });
    state.job = null; state.message = message; return true;
  }
  function advance(state, office, ctx, at) {
    const job = state?.job; if (!job || at < job.lastAt) return false;
    if (!state.accessActive || !ctx.visitPermission || ctx.placeId !== state.archive.placeId || !ctx.alive || !ctx.capable || !ctx.atCounter || ctx.cityId !== state.cityId || ctx.bodyEpoch !== job.bodyEpoch
      || job.extractId === 'returnBrief' && ctx.returnBooking?.id !== job.contents.bookingId)
      return cancel(state, office, at, 'Attendance or authorization ended. Existing copies remain; this unfinished copy was not issued.');
    const available = office?.id === state.officeId && office.institutionId === state.institutionId && ready(office)
      && present(office, ctx) && office.clerk.id === job.clerkId && !ctx.busy
      && (!office.assignment || office.assignment === job.id) && office.workSeconds > 0;
    if (!available) { release(office, job, at); job.lastAt = at; job.wasReady = false; state.message = 'Copying paused: original clerk, power, access or work capacity unavailable. No work accrues during the interruption.'; return false; }
    office.assignment = job.id;
    const start = Math.max(job.lastAt, office.availableAt || 0);
    const work = job.wasReady ? Math.min(job.seconds - job.progress, Math.max(0, at - start), office.workSeconds) : 0;
    office.workSeconds -= work; job.progress += work; job.lastAt = at; job.wasReady = true;
    if (job.progress + 1e-8 < job.seconds) return false;
    const completedAt = start + work;
    state.copies.push({ id: `${job.id}:copy`, extractId: job.extractId, issuer: copy(state.contact), cityId: state.cityId,
      issuedAt: completedAt, sourceDate: null, contents: copy(job.contents), limitations: limits });
    Object.assign(state.requests.find(row => row.id === job.id), { status: 'completed', endedAt: completedAt });
    release(office, job, completedAt); state.job = null; state.message = 'Dated extract received. Your copy persists; current terrain, threats and resources remain unverified.';
    return true;
  }
  function publicView(state) {
    if (!state) return null;
    return { contact: copy(state.contact), accessActive: state.accessActive, copies: copy(state.copies), message: state.message,
      working: Boolean(state.job), limitations: limits };
  }
  function parcelDiagram(record) {
    if (record?.extractId !== 'groundPlan') return '';
    const bounds = record.contents.coverage;
    const rows = ['Authorized parcel only; blank areas are not surveyed resources.',
      '    ' + Array.from({ length: bounds.width }, (_, i) => String(bounds.x + i).padStart(3)).join('')];
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      rows.push(String(y).padStart(3) + ' ' + Array.from({ length: bounds.width }, (_, i) => {
        const x = bounds.x + i;
        return (x === 10 && y === 10 ? 'V' : x === 17 && y === 8 ? 'C' : '.').padStart(3);
      }).join(''));
    }
    rows.push('V: vehicle rendezvous; C: civic counter. Positions from an undated municipal plan, not live tracking.');
    return rows.join('\n');
  }
  return { CATALOG, bind, reason, request, advance, cancel, publicView, parcelDiagram };
});
