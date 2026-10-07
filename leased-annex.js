(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLeasedAnnex = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme) {
  'use strict';
  const DAY = 86400, ROOM = 'leasedAssayAnnex', ROAD = 'annexMunicipalWalk', BENCH = 'leased-annex-bench';
  const registry = Theme.createRegistry([{ id: 'localAssayAnnex', kind: 'facilityOffer', compatibility: 'shared',
    label: 'Leased Local Assay Annex', template: 'Finite city-local property lease for manual sealed nonliving sample analysis.', contentTags: ['science', 'survival'] }]);
  const copy = x => JSON.parse(JSON.stringify(x));
  const validRoute = r => Boolean(r?.ok && r.municipal && r.cityId && Number.isFinite(r.distanceKm) && r.distanceKm >= 0 && r.distanceKm <= 5);
  function create(seed, city, route, now = 0, worldTheme = 'madcap') {
    if (!validRoute(route) || city?.id !== route.cityId || !Theme.eligibleDefinitions(registry, { kind: 'facilityOffer', worldTheme }).length) return null;
    let hash = 2166136261;
    for (const c of `${seed}:${city.id}:annex`) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
    const name = ['Mira', 'Soren', 'Ada', 'Tarin'][hash % 4] + ' ' + ['Vale', 'Reed', 'Marsh', 'Stone'][(hash >>> 4) % 4];
    return { property: { id: `assay-annex:${city.id}`, definitionId: 'localAssayAnnex', cityId: city.id, cityName: city.name, name: `${city.name} Local Assay Annex`,
      landlord: { id: `annex-landlord:${hash}`, name, rentReceived: 0, damageReceived: 0 },
      advertisedAt: now, distanceKm: route.distanceKm + .5, areaM2: 48, fixtureIds: [BENCH],
      purpose: 'Manual analysis of sealed nonliving sample portions only. No living procedures, fabrication, extraction or hazardous bulk processing.',
      utilities: 'No electricity, mana, water main, drain, consumables, instruments or staff are included. Bring real supplies; manual bench only.',
      privacy: 'The landlord knows this property, tenant and stated purpose. No secrecy guarantee or unrelated laboratory disclosure; local law still applies.' },
      quote: null, lease: null, nextLease: 1, trip: null, site: null, observation: null, history: [] };
  }
  function normalize(s) {
    if (!s?.property?.id || !s.property.cityId || !s.property.landlord?.id) return null;
    return copy(s);
  }
  function usable(s, now) { return Boolean(s?.lease?.status === 'active' && now < s.lease.endsAt); }
  function request(s, route, now) {
    if (!s || !validRoute(route) || route.cityId !== s.property.cityId || s.lease?.status === 'terminated')
      return { ok: false, reason: 'No supported municipal access to this property, or the lease has been handed back.' };
    const extension = Boolean(s.lease);
    s.quote = { ok: true, propertyId: s.property.id, landlordId: s.property.landlord.id, at: now, expiresAt: now + 300,
      startAt: extension ? Math.max(now, s.lease.endsAt) : now, days: 3, rent: 225, deposit: extension ? 0 : 150,
      total: extension ? 225 : 375, extension, purpose: s.property.purpose, privacy: s.property.privacy, utilities: s.property.utilities,
      termination: 'Three prepaid days; no automatic renewal or debt. Expiry stops work and fresh operating access, not egress or possession retrieval. Early handback retains prepaid rent. Empty the premises physically; deposit is refunded once less up to $150 for damage to the leased bench (missing bench: full deposit). No forced evacuation or remote goods deletion.' };
    return copy(s.quote);
  }
  function sign(s, route, expected, wallet, now, tenant) {
    if (!expected || JSON.stringify(expected) !== JSON.stringify(s?.quote) || now >= expected.expiresAt
      || !validRoute(route) || route.cityId !== s.property.cityId || s.lease?.status === 'terminated')
      return { ok: false, reason: 'Review current exact lease terms before signing.' };
    if (wallet.money < expected.total) return { ok: false, reason: 'Insufficient funds for prepaid rent and refundable deposit.' };
    wallet.money -= expected.total; s.property.landlord.rentReceived += expected.rent;
    if (!expected.extension) s.lease = { id: `annex-lease-${s.nextLease++}`, tenant: String(tenant), status: 'active', signedAt: now,
      startsAt: expected.startAt, endsAt: expected.startAt + 3 * DAY, depositHeld: expected.deposit, settled: false,
      purpose: expected.purpose, termination: expected.termination };
    else { s.lease.endsAt = expected.startAt + 3 * DAY; s.lease.status = 'active'; }
    s.history.push({ at: now, summary: `Signed ${expected.extension ? 'renewal' : 'lease'} with ${s.property.landlord.name}; paid $${expected.rent} rent and $${expected.deposit} deposit. Stated tenant: ${tenant}.` });
    s.quote = null; return { ok: true };
  }
  function expire(s, now) {
    if (!s?.lease || s.lease.status !== 'active' || now < s.lease.endsAt) return false;
    s.lease.status = 'expired'; s.history.push({ at: s.lease.endsAt, summary: 'Prepaid lease expired. No work or automatic renewal; physical goods, occupant, egress and retrieval rights remain.' });
    return true;
  }
  function handBack(s, context, wallet, now) {
    if (!s?.lease || s.lease.settled || context?.atProperty !== true || !context.empty || context.busy)
      return { ok: false, reason: 'Personally empty the premises and finish or cancel work before handback. Goods are never deleted for you.' };
    const damage = Math.min(s.lease.depositHeld, Math.ceil(150 * (1 - Math.max(0, Math.min(100, context.benchCondition || 0)) / 100) - 1e-8));
    const refund = s.lease.depositHeld - damage;
    wallet.money += refund; s.property.landlord.damageReceived += damage;
    s.lease.depositHeld = 0; s.lease.settled = true; s.lease.status = 'terminated'; s.lease.endedAt = now;
    s.history.push({ at: now, summary: `Physical handback: $${refund} deposit refunded; $${damage} retained for leased bench damage; prepaid rent retained.` });
    return { ok: true, refund, damage };
  }
  function startTrip(s, route, direction, now, context) {
    if (!s?.lease || s.trip || !validRoute(route) || route.cityId !== s.property.cityId || !context?.capable || context.busy
      || !['outbound', 'inbound'].includes(direction)) return { ok: false, reason: 'Free, capable scientist, no active work, and a supported local municipal route are required.' };
    if (direction === 'outbound' && s.lease.status === 'terminated') return { ok: false, reason: 'The premises have been handed back.' };
    // Expired leases permit retrieval, never new work. Walking is not a hired vehicle or an internet delivery.
    s.trip = { direction, distanceKm: s.property.distanceKm, positionKm: direction === 'outbound' ? 0 : s.property.distanceKm,
      departedAt: now, lastAt: now, reason: '', paused: false };
    return { ok: true };
  }
  function control(s, action, now) {
    const t = s?.trip; if (!t) return false;
    if (action === 'turn') t.direction = t.direction === 'outbound' ? 'inbound' : 'outbound';
    else if (action === 'pause') t.paused = true;
    else if (action === 'resume') t.paused = false;
    else return false;
    t.lastAt = now; return true;
  }
  function advance(s, route, now, context) {
    if (!s || context?.dead) return { changed: false };
    const expired = expire(s, now), t = s.trip;
    if (!t) return { changed: expired };
    const elapsed = Math.max(0, now - t.lastAt); t.lastAt = now;
    t.reason = t.paused ? 'Walking paused at saved road position.' : !validRoute(route) || route.cityId !== s.property.cityId
      ? 'Municipal support is interrupted; remain at the actual road position.' : !context?.capable ? 'Injury, incapacity or custody prevents walking.' : '';
    if (t.reason) return { changed: expired };
    const speed = Math.max(0, Number(context.speedKph) || 0);
    t.positionKm = Math.max(0, Math.min(t.distanceKm, t.positionKm + (t.direction === 'outbound' ? 1 : -1) * speed * elapsed / 3600));
    const arrived = t.direction === 'outbound' ? t.positionKm >= t.distanceKm - 1e-9 : t.positionKm <= 1e-9;
    if (arrived) {
      const destination = t.direction === 'outbound' ? 'annex' : 'home', reason = context.arrivalReasons?.[destination];
      if (reason) { t.reason = reason; return { changed: expired }; }
      s.trip = null; return { changed: true, destination };
    }
    return { changed: expired || elapsed > 0 };
  }
  function publicView(s, now) {
    if (!s) return null;
    return copy({ property: s.property, quote: s.quote, lease: s.lease, observation: s.observation,
      trip: s.trip, history: s.history, workAccess: usable(s, now) });
  }
  return { DAY, ROOM, ROAD, BENCH, validRoute, create, normalize, usable, request, sign, expire, handBack, startTrip, control, advance, publicView };
});
