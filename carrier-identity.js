(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCarrierIdentity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue ?? 0) < 80;
  function provisionDriver(driver) {
    if (driver.civicPreferences) return;
    let n = 0; for (const c of driver.id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
    driver.appearance = { face: ['angular', 'round', 'oval'][n % 3], eyes: ['brown', 'gray', 'green'][Math.floor(n / 3) % 3],
      hair: ['dark', 'auburn', 'fair'][Math.floor(n / 9) % 3], mark: ['left brow scar', 'right cheek mole', 'freckled cheeks'][Math.floor(n / 27) % 3] };
    driver.civicPreferences = { registrationConsent: true, presentationConsent: true, verificationConsent: true };
  }
  function provision(state, institution, at, cityId = state.homeId) {
    if (!institution?.active || !institution.institutionId || institution.cityId !== cityId || !(institution.localDistanceKm > 0)) return;
    state.identityOffices ||= [];
    if (state.identityOffices.some(o => o.institutionId === institution.institutionId)) return;
    const id = `${institution.institutionId}:civil-records`;
    state.identityOffices.push({ id, cityId: institution.cityId, institutionId: institution.institutionId, openedAt: at, active: true,
      contact: { handle: `${id}:verification`, label: `${institution.name || institution.institutionId} civil records` },
      route: { id: `${id}:depot-road`, distanceKm: institution.localDistanceKm, open: true },
      clerk: { id: `${id}:clerk`, locationId: id, status: 'alive', health: 100 },
      channelPowered: true, power: 12, workSeconds: 14400, money: 0, fee: 20, assignment: null, records: [], availableAt: at });
  }
  const ready = o => o?.active && o.channelPowered && able(o.clerk) && o.clerk.locationId === o.id;
  function preview(state, op) {
    const office = state.identityOffices?.find(o => o.cityId === op?.sourceId && ready(o) && o.route.open);
    const driver = op?.crew.find(able);
    if (!office || !driver?.appearance || !driver.civicPreferences || driver.civicDocument || op.identityTrip || op.assignment
      || op.carrierService?.assignment || op.location !== op.sourceId || op.biological) return null;
    return { operatorId: op.id, officeId: office.id, driverName: driver.name, registeredName: driver.name,
      description: copy(driver.appearance), fee: office.fee, roundTripKm: office.route.distanceKm * 2, workSeconds: 1800,
      terms: 'Carrier pays fee and fuel. Physical visit required. Driver may refuse. New local registration, not verified birth history, account ownership or permission to trade. Later gate presentation remains the driver’s choice.' };
  }
  function request(state, op, quote, at) {
    if (!quote || !same(quote, preview(state, op))) return false;
    const driver = op.crew.find(able), office = state.identityOffices.find(o => o.id === quote.officeId);
    if (!driver.civicPreferences.registrationConsent) { op.identityMessage = 'Driver declined registration. No adverse inference or compulsory travel.'; return false; }
    if (office.assignment || office.power < 1 || office.workSeconds < 1800 || op.money < office.fee || op.fuelKm < quote.roundTripKm || op.provisions < 1 || op.condition < 50 + quote.roundTripKm * .02) return false;
    op.identityTrip = { id: `${op.id}:registration:${at}`, officeId: office.id, driverId: driver.id, quote: copy(quote), phase: 'outbound',
      distanceKm: office.route.distanceKm, positionKm: 0, progress: 0, paid: false, lastAt: at, wasReady: true };
    op.identityMessage = 'Driver accepted the physical registration visit; no identity document has been issued.'; op.lastAt = at; return true;
  }
  function travel(state, op, at) {
    const t = op.identityTrip; if (!t || at < t.lastAt) return;
    const office = state.identityOffices?.find(o => o.id === t.officeId), driver = op.crew.find(p => p.id === t.driverId);
    let cursor = t.lastAt, seconds = at - cursor; t.lastAt = at; op.lastAt = at;
    while (seconds > 0) {
      if (!able(driver) || op.condition < 50 || op.provisions <= 0 || !office) {
        if (office?.assignment === t.id) { office.assignment = null; office.availableAt = at; }
        t.wasReady = false; break;
      }
      if (t.phase === 'registering') {
        const available = ready(office) && (!office.assignment || office.assignment === t.id) && office.workSeconds > 0
          && (t.paid || office.power > 0 && op.money >= t.quote.fee) && op.location === office.id;
        if (!available) { if (office.assignment === t.id) office.assignment = null; t.wasReady = false; break; }
        if (!t.paid) { op.money -= t.quote.fee; office.money += t.quote.fee; office.power--; t.paid = true; }
        office.assignment = t.id;
        if (!t.wasReady) { t.wasReady = true; break; }
        const start = Math.max(cursor, office.availableAt), work = Math.min(1800 - t.progress, Math.max(0, at - start), office.workSeconds, op.provisions * 28800);
        t.progress += work; office.workSeconds -= work; op.provisions = Math.max(0, op.provisions - work / 28800);
        seconds = Math.max(0, at - start - work); cursor = start + work;
        if (t.progress < 1800) break;
        const document = { number: `${office.id}:document:${office.records.length + 1}`, issuer: copy(office.contact), cityId: office.cityId,
          registeredName: t.quote.registeredName, description: copy(driver.appearance), issuedAt: cursor, expiresAt: cursor + 31536000,
          scope: 'Prospective local civic registration following physical attendance; no verified birth history or account linkage.' };
        office.records.push({ document: copy(document), status: 'active', registeredAt: cursor });
        driver.civicDocument = copy(document); office.assignment = null; office.availableAt = cursor;
        t.phase = 'returning'; op.identityMessage = 'Registered in person. Returning to the depot; registration does not prove past conduct.'; continue;
      }
      if (!office.route.open || op.fuelKm <= 0) { t.wasReady = false; break; }
      if (!t.wasReady) { t.wasReady = true; break; }
      const remaining = t.phase === 'outbound' ? t.distanceKm - t.positionKm : t.positionKm;
      const moved = Math.min(remaining, seconds / 180, op.fuelKm, op.provisions * 160, Math.max(0, (op.condition - 50) / .02), Math.max(0, (80 - driver.fatigue) / .04));
      if (moved <= 0) break;
      op.fuelKm -= moved; op.condition -= moved * .02; driver.fatigue += moved * .04;
      const elapsed = moved * 180; op.provisions = Math.max(0, op.provisions - elapsed / 28800); seconds -= elapsed; cursor += elapsed;
      t.positionKm += t.phase === 'outbound' ? moved : -moved;
      op.location = `${office.route.id}:${t.positionKm.toFixed(2)}km`;
      if (moved + 1e-8 < remaining) break;
      if (t.phase === 'outbound') { t.phase = 'registering'; op.location = office.id; }
      else { op.location = op.sourceId; op.identityTrip = null; op.identityMessage = 'Registration visit completed; driver back at the depot.'; break; }
    }
  }
  function start(state, gate, sh, op, at) {
    const i = sh.inspection, driver = op.crew.find(able), person = i.personObservations?.[0];
    if (!person || i.identityPresentation || sh.living) return;
    // This is an observation now, not a lookup of the private crew ID in an old case.
    if (!driver?.civicDocument || !driver.civicPreferences?.presentationConsent) {
      i.identityPresentation = { at, result: 'notPresented', limit: 'No voluntary identity document presented. No adverse inference.' }; return;
    }
    i.identityPresentation = { at, result: 'presented', document: copy(driver.civicDocument), observedDescription: copy(driver.appearance || {}),
      visibility: gate.identityVisibility || 'clear', personObservationId: person.id, verificationConsent: driver.civicPreferences.verificationConsent === true };
    gate.identityDesk ||= { channelPowered: true, power: 6, workSeconds: 7200 };
    i.identityJob = { id: `${sh.id}:identity:1`, lastAt: at, deadlineAt: i.reviewAt, progress: 0, paid: false, wasReady: true };
  }
  function finish(gate, sh, office, at, issuerResult) {
    const i = sh.inspection, p = i.identityPresentation, j = i.identityJob;
    const keys = ['face', 'eyes', 'hair', 'mark'];
    const observed = p.observedDescription, described = p.document.description || {};
    const appearance = p.visibility !== 'clear' || keys.some(k => !observed[k] || !described[k]) ? 'ambiguous'
      : keys.every(k => observed[k] === described[k]) ? 'consistent' : 'mismatch';
    const result = issuerResult === 'confirmed' && appearance === 'consistent' ? 'supported'
      : appearance === 'mismatch' || ['alteredDocument', 'withdrawn'].includes(issuerResult) ? 'mismatch'
        : issuerResult === 'expired' ? 'expired' : appearance === 'ambiguous' ? 'ambiguous' : 'unavailable';
    i.identityChecks ||= [];
    i.identityChecks.push({ id: j.id, at, presentedAt: p.at, personObservationId: p.personObservationId, result,
      document: copy(p.document), issuerResult, appearance, observerId: i.officerId,
      sourceGroups: [p.document.issuer?.handle || 'unverified issuer', i.officerId], jurisdiction: `${p.document.cityId} issuer; observation at ${gate.cityId}`,
      supersedes: i.identityChecks.at(-1)?.id || null,
      limit: 'Description consistency is bounded support, not certain identity. This gate event only; no retrospective identification, account linkage, sale, knowledge, scientist attribution, citizenship or arrest authority.' });
    if (office?.assignment === j.id) { office.assignment = null; office.availableAt = at; }
    if (gate.identityDesk?.assignment === j.id) { gate.identityDesk.assignment = null; gate.identityDesk.availableAt = at; }
    i.identityJob = null;
  }
  function tick(state, gate, sh, at) {
    const i = sh.inspection, j = i?.identityJob; if (!j || at < j.lastAt) return;
    const p = i.identityPresentation, office = state.identityOffices?.find(o => o.contact.handle === p.document.issuer?.handle && o.cityId === p.document.cityId);
    const desk = gate.identityDesk, readyNow = p.verificationConsent && ready(office) && gate.active && gate.jurisdiction === 'city'
      && able(gate.officer) && gate.officer.id === i.officerId && (!gate.assignment || gate.assignment === sh.id)
      && !gate.criminalIntake?.referrals.some(r => r.investigation?.status === 'working' && r.investigation.job?.kind === 'officer' && r.investigation.job.wasReady)
      && desk?.channelPowered && desk.workSeconds > 0 && office.workSeconds > 0
      && (!desk.assignment || desk.assignment === j.id)
      && (!office.assignment || office.assignment === j.id) && (j.paid || desk.power > 0 && office.power > 0);
    if (!readyNow) {
      if (office?.assignment === j.id) { office.assignment = null; office.availableAt = at; }
      if (desk?.assignment === j.id) { desk.assignment = null; desk.availableAt = at; }
      j.wasReady = false; j.lastAt = at;
      if (at >= j.deadlineAt) finish(gate, sh, office, at, p.verificationConsent ? 'unavailable' : 'notConsented');
      return;
    }
    if (!j.paid) { desk.power--; office.power--; j.paid = true; }
    office.assignment = j.id;
    desk.assignment = j.id;
    const end = Math.min(at, j.deadlineAt), begin = Math.max(j.lastAt, office.availableAt, desk.availableAt || 0);
    const work = j.wasReady ? Math.min(600 - j.progress, Math.max(0, end - begin), desk.workSeconds, office.workSeconds) : 0;
    desk.workSeconds -= work; office.workSeconds -= work; j.progress += work; j.wasReady = true; j.lastAt = at;
    if (j.progress >= 600) {
      const doc = p.document, record = office.records.find(r => r.document.number === doc.number);
      const status = !record ? 'notOnFile' : !same(record.document, doc) ? 'alteredDocument' : record.status === 'withdrawn' ? 'withdrawn' : record.status !== 'active' ? 'revoked'
        : doc.issuedAt > p.at ? 'notYetValid' : doc.expiresAt <= p.at ? 'expired' : 'confirmed';
      finish(gate, sh, office, begin + work, status);
    } else if (at >= j.deadlineAt) finish(gate, sh, office, at, 'unavailable');
  }
  function recheck(state, sh, at) {
    const i = sh?.inspection, gate = state.checkpoints?.find(g => g.id === i?.gateId);
    if (!gate || !i.identityChecks?.length || i.identityJob || !i.identityPresentation.verificationConsent) return false;
    i.identityJob = { id: `${sh.id}:identity:${i.identityChecks.length + 1}`, lastAt: at, deadlineAt: at + 1800, progress: 0, paid: false, wasReady: true };
    tick(state, gate, sh, at); return true;
  }
  function advance(state, at) {
    for (const op of state.operators) travel(state, op, at);
    for (const sh of state.shipments) {
      // Initial checks run on the physical gate clock; only requested later rechecks run here.
      if (sh.inspection?.identityChecks?.length && sh.inspection.identityJob) {
        const gate = state.checkpoints?.find(g => g.id === sh.inspection.gateId); if (gate) tick(state, gate, sh, at);
      }
    }
  }
  return { provisionDriver, provision, preview, request, advance, start, tick, recheck };
});
