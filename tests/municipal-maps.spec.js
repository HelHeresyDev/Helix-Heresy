const { test, expect } = require('@playwright/test');
const Maps = require('../municipal-maps');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const Discovery = require('../local-discovery');
const Expeditions = require('../survey-expeditions');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const market = { homeId: 'a' };
  Registry.provision(market, { institutionId: 'registry:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, 0);
  const destination = { id: 'survey:a', cityId: 'a', label: 'Aster Sampling Ground' };
  const discovery = Discovery.create(destination, 0);
  const baseline = Discovery.materialize(discovery, 'world', 'seed');
  const office = market.identityOffices[0];
  return { market, office, destination, discovery, baseline, state: Maps.bind(office, destination, baseline, 0), wallet: { money: 1000 },
    ctx: { alive: true, capable: true, atCounter: true, clerkPresent: true, lineOfSight: true, busy: false, cityId: 'a', placeId: 'survey:a', visitPermission: true, bodyEpoch: 0, returnBooking: { id: 'trip-a', destinationLabel: 'Laboratory departure' } } };
}
const begin = (f, id = 'groundPlan', at = 0) => Maps.request(f.state, f.office, id, f.ctx, f.wallet, at);

test('contacts require an actual available person and never provision staff or grant access', () => {
  const f = fixture(), before = copy(f.office);
  expect(Maps.contactsView(f.state)).toEqual([]);
  for (const key of ['atCounter', 'clerkPresent', 'lineOfSight', 'alive', 'capable']) {
    expect(Maps.meet(f.state, f.office, { ...f.ctx, [key]: false }, 10)).toBe(false);
  }
  f.office.assignment = 'identity-work';
  expect(Maps.meet(f.state, f.office, f.ctx, 10)).toBe(false);
  f.office.assignment = null;
  f.state.accessActive = false;
  expect(Maps.meet(f.state, f.office, f.ctx, 10)).toBe(true);
  expect(f.office).toEqual(before); expect(f.state.accessActive).toBe(false);
  expect(Maps.contactsView(f.state)[0].firstMetAt).toBe(10);
  expect(JSON.stringify(Maps.contactsView(f.state))).not.toMatch(/health|workSeconds|power|archive|potentialPermille/);
});

test('contacts retain dated knowledge through replacement, closure and reload without inheriting familiarity', () => {
  const f = fixture(); f.office.clerk.name = 'Mira';
  Maps.meet(f.state, f.office, f.ctx, 10);
  const original = Maps.contactsView(f.state);
  f.office.clerk.status = 'dead'; f.office.active = false;
  expect(Maps.meet(f.state, f.office, f.ctx, 20)).toBe(false);
  expect(Maps.contactsView(f.state)).toEqual(original);
  f.office.active = true; f.office.clerk = { ...f.office.clerk, id: 'replacement', name: 'Orin', status: 'alive' };
  expect(Maps.contactsView(f.state)).toEqual(original);
  expect(Maps.meet(f.state, f.office, { ...f.ctx, atCounter: false }, 30)).toBe(false);
  Maps.meet(f.state, f.office, f.ctx, 40);
  Maps.meet(f.state, f.office, f.ctx, 50);
  const saved = Expeditions.normalizeState(copy({ mapService: f.state })).mapService;
  const records = Maps.contactsView(saved);
  expect(records).toHaveLength(2); expect(records[0]).toEqual(original[0]);
  expect(records[1].firstMetAt).toBe(40); expect(records[1].lastConfirmedAt).toBe(50);
  records[0].label = 'tampered'; expect(Maps.contactsView(saved)[0].label).toBe('Mira');
  const remote = { ...f.ctx, atCounter: false };
  const reason = Maps.reason(saved, f.office, 'groundPlan', remote);
  f.office.assignment = 'secret-work'; f.office.clerk.status = 'dead';
  expect(Maps.reason(saved, f.office, 'groundPlan', remote)).toBe(reason);
});

test('service conversations freeze personal attribution and preserve copies after revocation', () => {
  const f = fixture(); f.office.clerk.name = 'Mira';
  expect(begin(f)).toBe(true);
  const person = copy(Maps.contactsView(f.state)[0]);
  f.office.clerk.name = 'Changed after request';
  Maps.advance(f.state, f.office, f.ctx, 600);
  expect(f.state.copies[0].suppliedBy).toEqual(person);
  f.state.accessActive = false;
  const saved = Expeditions.normalizeState(copy({ mapService: f.state })).mapService;
  expect(Maps.publicView(saved).copies[0].suppliedBy).toEqual(person);
  expect(Maps.contactsView(saved)[0]).toEqual(person);
});

test('maps reuse the existing institution and cannot create a foreign branch or expose its private archive', () => {
  const f = fixture(), before = copy(f.office);
  expect(Maps.bind(null, f.destination, f.baseline, 0)).toBeNull();
  expect(Maps.bind({ ...f.office, cityId: 'other' }, f.destination, f.baseline, 0)).toBeNull();
  expect(f.office).toEqual(before);
  expect(f.market.identityOffices).toHaveLength(1);
  const view = Maps.publicView(f.state);
  expect(view.copies).toEqual([]);
  expect(JSON.stringify(view)).not.toMatch(/coverage|marker|workSeconds|clerkId|baseline/);
});

test('money cannot override purpose, attendance, revocation, finite resources or withheld products', () => {
  for (const change of ['permission', 'counter', 'clerk', 'power', 'work', 'busy', 'revoked', 'foreign', 'mineral', 'unbooked', 'poor']) {
    const f = fixture(); let id = 'groundPlan';
    if (change === 'permission') f.ctx.visitPermission = false;
    if (change === 'counter') f.ctx.atCounter = false;
    if (change === 'clerk') f.office.clerk.health = 0;
    if (change === 'power') f.office.power = 0;
    if (change === 'work') f.office.workSeconds = 599;
    if (change === 'busy') f.office.assignment = 'identity-work';
    if (change === 'revoked') f.state.accessActive = false;
    if (change === 'foreign') f.ctx.cityId = 'b';
    if (change === 'mineral') id = 'mineralSurvey';
    if (change === 'unbooked') { id = 'returnBrief'; f.ctx.returnBooking = null; }
    if (change === 'poor') f.wallet.money = 0;
    const office = copy(f.office), money = f.wallet.money;
    expect(begin(f, id), change).toBe(false);
    expect(f.office).toEqual(office); expect(f.wallet.money).toBe(money); expect(f.state.copies).toEqual([]);
  }
});

test('copy work shares identity staff, consumes exact finite resources and freezes only the requested archive', () => {
  const f = fixture(), civic = Civic.create(), original = copy(f.state.archive);
  expect(begin(f)).toBe(true);
  expect(Civic.begin(civic, f.office, Civic.preview(civic, f.office, 'Mira'), f.wallet, { ...f.ctx, visibility: 'clear' }, 0)).toBe(false);
  f.state.archive.notes.push('New unrequested information');
  Maps.advance(f.state, f.office, f.ctx, 300);
  expect(f.state.copies).toHaveLength(0); expect(f.office.workSeconds).toBe(14100);
  const saved = Expeditions.normalizeState({ mapService: f.state }).mapService;
  Maps.advance(saved, f.office, f.ctx, 600);
  expect(saved.copies[0].contents).toEqual(original);
  expect(saved.copies[0].sourceDate).toBeNull(); expect(saved.copies[0].issuedAt).toBe(600);
  expect(f.wallet.money).toBe(975); expect(f.office.money).toBe(25); expect(f.office.power).toBe(11); expect(f.office.workSeconds).toBe(13800);
  expect(f.office.assignment).toBeNull();
  expect(Maps.request(saved, f.office, 'groundPlan', f.ctx, f.wallet, 600)).toBe(false);
  expect(saved.copies).toHaveLength(1);
});

test('staff and channel outages cannot backfill work or substitute a new clerk', () => {
  const f = fixture(); begin(f); Maps.advance(f.state, f.office, f.ctx, 100);
  f.office.channelPowered = false; Maps.advance(f.state, f.office, f.ctx, 200);
  expect(f.office.assignment).toBeNull();
  f.office.channelPowered = true; Maps.advance(f.state, f.office, f.ctx, 10000);
  expect(f.state.job.progress).toBe(100);
  const id = f.office.clerk.id; f.office.clerk.id = 'replacement'; Maps.advance(f.state, f.office, f.ctx, 11000);
  expect(f.state.job.progress).toBe(100);
  f.office.clerk.id = id; Maps.advance(f.state, f.office, f.ctx, 12000); Maps.advance(f.state, f.office, f.ctx, 12500);
  expect(f.state.copies).toHaveLength(1); expect(f.office.power).toBe(11);
});

test('leaving, lost permissions and bodily changes interrupt unfinished requests without destroying acquired copies', () => {
  for (const change of ['leave', 'permission', 'body', 'booking']) {
    const f = fixture(); begin(f); Maps.advance(f.state, f.office, f.ctx, 600);
    const acquired = copy(f.state.copies);
    expect(begin(f, 'returnBrief', 600)).toBe(true);
    if (change === 'leave') f.ctx.atCounter = false;
    if (change === 'permission') f.ctx.visitPermission = false;
    if (change === 'body') f.ctx.bodyEpoch++;
    if (change === 'booking') f.ctx.returnBooking.id = 'another-trip';
    Maps.advance(f.state, f.office, f.ctx, 700);
    expect(f.state.job).toBeNull(); expect(f.state.copies).toEqual(acquired); expect(f.office.assignment).toBeNull();
    f.state.accessActive = false;
    expect(Maps.publicView(f.state).copies).toEqual(acquired); expect(f.wallet.money).toBe(960);
  }
});

test('return brief has only booked endpoints and preserves no live or private journey fields', () => {
  const f = fixture(); f.ctx.returnBooking.exactArrivalAt = 777; f.ctx.returnBooking.hiddenThreat = 'secret';
  expect(begin(f, 'returnBrief')).toBe(true); Maps.advance(f.state, f.office, f.ctx, 300);
  const text = JSON.stringify(Maps.publicView(f.state));
  expect(text).not.toMatch(/777|hiddenThreat|secret|marker|potentialPermille/);
  expect(f.state.copies[0].contents.coverage).toEqual({ from: 'Aster Sampling Ground', to: 'Laboratory departure' });
});

test('fractional clocks finish once and diagrams use only the received parcel plan', () => {
  const f = fixture(); const start = 16.123456789;
  expect(begin(f, 'groundPlan', start)).toBe(true);
  Maps.advance(f.state, f.office, f.ctx, start + 600);
  expect(f.state.job).toBeNull(); expect(f.state.copies).toHaveLength(1);
  const diagram = Maps.parcelDiagram(f.state.copies[0]);
  expect(diagram).toContain('V: vehicle rendezvous'); expect(diagram).not.toContain(f.baseline.marker.label);
  expect(Maps.parcelDiagram({ extractId: 'returnBrief' })).toBe('');
  Maps.advance(f.state, f.office, f.ctx, start + 1200);
  expect(f.state.copies).toHaveLength(1);
});
