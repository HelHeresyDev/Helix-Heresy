(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCarrierBriefings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const SECONDS = 30;
  const present = ctx => Boolean(ctx?.alive && ctx.capable && ctx.atVehicle && ctx.lineOfSight);
  const driverAvailable = carrier => Boolean(carrier?.driver?.id && carrier.driver.status === 'alive'
    && carrier.driver.health >= 50 && (carrier.driver.fatigue || 0) < 80);
  function reason(carrier, ctx) {
    if (!carrier?.contract || carrier.contract.returnToBase) return 'An active municipal passenger booking is required.';
    if (!['laboratory', 'field'].includes(carrier.location) || carrier.journeyId) return 'Wait for the vehicle to park at your boarding point.';
    if (!present(ctx) || ctx.location !== carrier.location || ctx.cityId !== carrier.cityId) return 'Meet the driver at the parked vehicle with a clear line of sight.';
    if (!driverAvailable(carrier)) return 'The driver is unavailable for a conversation.';
    if (carrier.briefingState?.job || ctx.busy) return 'Finish the current work or conversation first.';
    if (!ctx.destination?.id || !ctx.destination.label || !ctx.boardingPoint || !ctx.returnPoint) return 'The booked passenger instructions are unavailable.';
    return '';
  }
  function reportsFor(carrier, journeys, at) {
    const reports = [];
    for (const journey of journeys || []) {
      const belongs = carrier.contract.passengerJourneyIds?.includes(journey.id)
        || journey.subject?.kind === 'municipalCarrier' && journey.subject.id === carrier.contract.id;
      if (!belongs) continue;
      for (const leg of journey.route?.legs || []) {
        const report = leg.interruption;
        if (!report?.revealed || !Number.isFinite(report.revealedAt) || report.revealedAt > at || !report.summary) continue;
        reports.push({ journeyId: String(journey.id), source: 'Disclosed carrier journey event',
          reportedAt: report.revealedAt, text: String(report.summary) });
      }
    }
    return reports;
  }
  function begin(carrier, ctx, journeys, at) {
    const blocked = reason(carrier, ctx);
    if (blocked) return false;
    const state = carrier.briefingState ||= { contacts: [], copies: [], job: null, nextNumber: 1, message: '' };
    let contact = state.contacts.find(row => row.personId === carrier.driver.id);
    if (!contact) { contact = { personId: carrier.driver.id, firstMetAt: at }; state.contacts.push(contact); }
    Object.assign(contact, { label: carrier.driver.name || 'Municipal duty driver (name not supplied)',
      institutionId: carrier.institutionId, institutionLabel: carrier.label, cityId: carrier.cityId,
      role: 'Municipal survey driver', lastConfirmedAt: at, location: ctx.location,
      meetingPoint: String(ctx.location === 'field' ? ctx.returnPoint : ctx.boardingPoint),
      source: 'In-person conversation at the booked vehicle' });
    state.job = { id: `${carrier.contract.id}:briefing:${state.nextNumber++}`, bookingId: carrier.contract.id,
      personId: carrier.driver.id, location: carrier.location, bodyEpoch: ctx.bodyEpoch,
      startedAt: at, lastAt: at, progress: 0,
      contents: { suppliedBy: copy(contact), destination: { id: String(ctx.destination.id), label: String(ctx.destination.label) },
        boardingPoint: String(ctx.boardingPoint), returnPoint: String(ctx.returnPoint),
        passengerSeats: carrier.vehicle.passengerSeats, cargoCapacity: carrier.vehicle.cargoCapacity,
        standingInstructions: [
          'Basic passenger briefing is included in the paid municipal fare.',
          'Return to the waiting vehicle at the authorized survey ground. There is no abandonment deadline.',
          'Only this booked municipal visit and its return are covered; wider routes and other customers are withheld.',
          'Cancellation before departure disembarks at the origin. Once underway, return requires physical travel.',
          'Rescue requires a separately available crew, vehicle and supplies; automatic recovery is unavailable.',
          'Cargo limits use 10 kg / 20 L crate-equivalents. Personal carrying limits still apply.',
          'Travel permission comes from the current booking and local authorization. This copy grants no ownership, extraction or construction rights.'
        ], reports: reportsFor(carrier, journeys, at) } };
    state.message = 'The driver is giving a 30-second passenger briefing. Stay at the parked vehicle.';
    return true;
  }
  function cancel(carrier, message = 'Conversation interrupted; no new briefing copy was received.') {
    const state = carrier?.briefingState;
    if (!state?.job) return false;
    state.job = null; state.message = message; return true;
  }
  function advance(carrier, ctx, at) {
    const state = carrier?.briefingState, job = state?.job;
    if (!job || at < job.lastAt) return false;
    if (carrier.contract?.id !== job.bookingId || carrier.contract.returnToBase || carrier.journeyId
      || carrier.driver.id !== job.personId || !driverAvailable(carrier) || !present(ctx) || ctx.busy
      || carrier.location !== job.location || ctx.location !== job.location || ctx.cityId !== carrier.cityId || ctx.bodyEpoch !== job.bodyEpoch)
      return cancel(carrier);
    const work = Math.min(SECONDS - job.progress, Math.max(0, at - job.lastAt));
    job.progress += work; job.lastAt = at;
    if (job.progress + 1e-8 < SECONDS) return false;
    state.copies.push({ id: job.id, bookingId: job.bookingId, receivedAt: job.startedAt + SECONDS,
      conversationStartedAt: job.startedAt, ...copy(job.contents) });
    state.job = null; state.message = 'Passenger briefing received. Its dated reports and instructions remain in your records.';
    return true;
  }
  function publicView(carrier) {
    const state = carrier?.briefingState;
    return { contacts: copy(state?.contacts || []), copies: copy(state?.copies || []), working: Boolean(state?.job), message: state?.message || '' };
  }
  return { SECONDS, reason, begin, reportsFor, advance, cancel, publicView };
});
