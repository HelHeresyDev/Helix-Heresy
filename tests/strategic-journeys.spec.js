// @ts-check
const { test, expect } = require('@playwright/test');
const Journeys = require('../strategic-journeys');

function networkState() {
  return Journeys.defaultState({
    clock: 0,
    network: {
      homeDestinationId: 'site:lab',
      nearestSettlementDestinationId: 'city:a',
      destinations: [
        { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Helix Laboratory', cellId: 'cell:9', supportComponentId: 'component:one', known: true, reachable: true, localDistanceKm: 28, routeContinuity: 'degraded', dangerBand: 'high', jurisdiction: { kind: 'facilityConvoyOrAgreementOnly' } },
        { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'cell:1', supportComponentId: 'component:one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } },
        { id: 'city:b', kind: 'fortifiedCity', cityId: 'b', label: 'Bastion', cellId: 'cell:2', supportComponentId: 'component:one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'b' } },
        { id: 'city:c', kind: 'fortifiedCity', cityId: 'c', label: 'Cairn', cellId: 'cell:3', supportComponentId: 'component:two', known: true, reachable: false, jurisdiction: { kind: 'city', cityId: 'c' } }
      ],
      routes: [
        { id: 'corridor:ab', corridorId: 'ab', endpointCityIds: ['a', 'b'], continuity: 'intermittent', supportCapable: true, cellPath: ['cell:1', 'cell:4', 'cell:2'], distanceKm: 92 },
        { id: 'corridor:bc', corridorId: 'bc', endpointCityIds: ['b', 'c'], continuity: 'closed', supportCapable: false, cellPath: ['cell:2', 'cell:5', 'cell:3'], distanceKm: 84 }
      ]
    }
  });
}

test('plans only supported physical routes and keeps future transport modes gated', () => {
  const state = networkState();
  const supported = Journeys.routePlan(state, 'site:lab', 'city:b', 'hiredFreightRoad');
  expect(supported.ok).toBe(true);
  expect(supported.legs.map((leg) => leg.kind)).toEqual(['localApproach', 'supportedCorridor']);
  expect(supported.legs[1].cellPath).toEqual(['cell:1', 'cell:4', 'cell:2']);

  expect(Journeys.routePlan(state, 'site:lab', 'city:c', 'hiredFreightRoad')).toMatchObject({ ok: false, reason: 'No supported route connects these destinations.' });
  expect(Journeys.routePlan(state, 'site:lab', 'city:b', 'hiredAircraft')).toMatchObject({ ok: false, reason: expect.stringContaining('requires a provider or owned asset') });
  expect(Journeys.routePlan(state, 'city:b', 'site:lab', 'hiredFreightRoad').legs[0].cellPath).toEqual(['cell:2', 'cell:4', 'cell:1']);
  state.destinations[0].routeContinuity = 'none';
  expect(Journeys.routePlan(state, 'site:lab', 'city:a', 'hiredFreightRoad').ok).toBe(false);
});

test('saves passenger and freight contracts while exposing only an arrival window', () => {
  const created = Journeys.createJourney(networkState(), {
    seed: 'scheduled-freight', clock: 0, purpose: 'lawfulPurchaseDelivery', label: 'Reagent delivery',
    subject: { kind: 'commodityConsignment', id: 'legal-consignment-1' },
    originId: 'city:a', destinationId: 'site:lab', modeId: 'hiredFreightRoad', passengers: 1, cargo: 40, vehicleCount: 2,
    requestedArrivalAt: 8 * 3600
  });
  expect(created.reason).toBe('');
  expect(created.journey.capacity).toEqual({ passengers: 1, cargo: 40, vehicleCount: 2 });
  expect(created.journey.route.legs).toHaveLength(1);
  expect(created.journey.exactArrivalAt).toBe(8 * 3600);
  expect(created.journey.arrivalWindow.start).toBeLessThan(created.journey.arrivalWindow.end);
  expect(Journeys.journeyForSubject(created.state, 'commodityConsignment', 'legal-consignment-1')?.id).toBe(created.journey.id);

  const publicRecord = Journeys.publicJourney(created.journey, 0);
  expect(publicRecord.exactArrivalAt).toBeUndefined();
  expect(publicRecord.route.legs[0].plannedStartAt).toBeUndefined();
  expect(publicRecord.route.legs[0].interruption).toBeNull();
  expect(publicRecord.route.legs[0].durationSeconds).toBeUndefined();
  expect(Journeys.nextPublicEvent(created.state, 0).time).toBe(created.journey.arrivalWindow.start);
  expect(Journeys.nextPublicEvent(created.state, created.journey.arrivalWindow.start).time).toBe(created.journey.arrivalWindow.end);
  expect(Journeys.normalizeState(JSON.parse(JSON.stringify(created.state)))).toEqual(created.state);
  expect(Journeys.createJourney(networkState(), { originId: 'city:a', destinationId: 'site:lab', modeId: 'hiredFreightRoad', cargo: 25 }).reason).toContain('capacity');
});

test('deterministic disruptions delay, divert, or strand without deleting people or cargo', () => {
  let created;
  for (let index = 0; index < 500; index += 1) {
    created = Journeys.createJourney(networkState(), {
      seed: `danger-${index}`, clock: 0, purpose: 'siteVisit', subject: { kind: 'siteVisit', id: 'visit-1' },
      originId: 'city:a', destinationId: 'site:lab', modeId: 'hiredFreightRoad', passengers: 2, cargo: 12,
      departureDelaySeconds: 0, dangerBand: 'extreme'
    });
    if (created.journey.route.legs.some((leg) => leg.interruption)) break;
  }
  const before = created.journey;
  const interruption = before.route.legs.find((leg) => leg.interruption)?.interruption;
  expect(interruption).toBeTruthy();
  const after = Journeys.advance(created.state, before.exactArrivalAt + 24 * 3600);
  const journey = after.state.journeys[0];
  expect(journey.capacity).toEqual({ passengers: 2, cargo: 12, vehicleCount: 1 });
  expect(journey.history.some((entry) => ['routeDelay', 'checkpointHold', 'vehicleFault', 'beastDiversion', 'stranding'].includes(entry.action))).toBe(true);
  expect(['arrived', 'stranded']).toContain(journey.status);
  expect(journey.history.map((entry) => entry.summary).join(' ')).not.toMatch(/killed|destroyed|deleted/i);
});

test('cancellation is remote only before departure and becomes a physical return afterward', () => {
  const scheduled = Journeys.createJourney(networkState(), {
    seed: 'cancel-before', clock: 0, originId: 'city:a', destinationId: 'site:lab', modeId: 'hiredPassengerRoad', passengers: 1, departureDelaySeconds: 3600
  });
  const cancelled = Journeys.cancelJourney(scheduled.state, scheduled.journey.id, 120);
  expect(cancelled.journey).toMatchObject({ status: 'cancelled', cancellation: { outcome: 'cancelledBeforeDeparture' } });

  const departed = Journeys.createJourney(networkState(), {
    seed: 'cancel-after', clock: 0, originId: 'city:a', destinationId: 'site:lab', modeId: 'hiredPassengerRoad', passengers: 1, departureDelaySeconds: 0
  });
  const returning = Journeys.cancelJourney(departed.state, departed.journey.id, 120);
  expect(returning.journey).toMatchObject({ status: 'returning', cancellation: { outcome: 'physicalReturnRequired' } });
  const completed = Journeys.advance(returning.state, returning.journey.exactArrivalAt);
  expect(completed.state.journeys[0].status).toBe('returned');
  expect(completed.state.journeys[0].history.at(-1).action).toBe('returned');
  expect(Journeys.cancelJourney(completed.state, departed.journey.id, 86400).reason).toBeTruthy();
});

test('destination directories preserve canonical corridor distance and never modify the reusable world', () => {
  const map = {
    publicPlayableSettlementDirectory: {
      cityRows: ['a', 'b'].map((cityId) => ({ cityId, name: cityId, cellId: `cell:${cityId}`, physicalJurisdictionExists: true })),
      currentSupportComponents: [{ id: 'component:one', cityIds: ['a', 'b'] }],
      routeRows: [{ corridorId: 'ab', endpointCityIds: ['a', 'b'], continuity: 'operational', supportCapable: true }]
    },
    routeGraph: { routes: [{ id: 'ab', lengthKm: 137, cellPath: ['cell:a', 'cell:between', 'cell:b'] }] }
  };
  const before = JSON.stringify(map);
  const state = Journeys.defaultState({ strategicMap: map, startingSite: { strategicLocation: { id: 'lab', nearestSettlement: { cityId: 'a' }, distance: { practicalTravelKm: 19 }, access: { routeContinuity: 'localApproach' } } } });
  const journey = Journeys.createJourney(state, { originId: 'site:lab', destinationId: 'city:b', passengers: 1 });
  expect(journey.journey.route.legs.map((leg) => leg.distanceKm)).toEqual([19, 137]);
  Journeys.advance(journey.state, 86400);
  expect(JSON.stringify(map)).toBe(before);
  expect(state.journeys).toHaveLength(0);
});

test('interrupted travel is invariant to clock chunking and reloads', () => {
  const booked = Journeys.createJourney(networkState(), { seed: 'timesteps', originId: 'site:lab', destinationId: 'city:b', modeId: 'hiredFreightRoad', passengers: 1, cargo: 10, departureDelaySeconds: 0 });
  const horizon = 86400;
  const single = Journeys.advance(booked.state, horizon).state;
  let stepped = booked.state;
  for (let at = 60; at <= horizon; at += 60) stepped = Journeys.advance(JSON.parse(JSON.stringify(stepped)), at).state;
  expect(stepped).toEqual(single);
});

test('stranding cannot arrive until recovery and a hold remains visible until it ends', () => {
  const booked = Journeys.createJourney(networkState(), { seed: 'controlled', originId: 'city:a', destinationId: 'site:lab', modeId: 'hiredFreightRoad', passengers: 1, cargo: 10, departureDelaySeconds: 0 });
  const leg = booked.state.journeys[0].route.legs[0];
  leg.interruption = { kind: 'stranding', triggerFraction: 0.5, delaySeconds: 3600, revealed: false, revealedAt: null, resolved: false, summary: '' };
  const stranded = Journeys.advance(booked.state, 86400).state;
  expect(stranded.journeys[0].status).toBe('stranded');
  expect(Journeys.nextEvent(stranded, 86400)).toBeNull();
  const recovered = Journeys.recoverStrandedJourney(stranded, booked.journey.id, 86400);
  expect(Journeys.advance(recovered.state, recovered.journey.exactArrivalAt).state.journeys[0]).toMatchObject({ status: 'arrived', capacity: { cargo: 10, passengers: 1 } });
  leg.interruption.kind = 'checkpointHold';
  const held = Journeys.advance(booked.state, Math.ceil(leg.durationSeconds / 2)).state;
  expect(held.journeys[0].status).toBe('held');
  expect(Journeys.advance(held, 86400).state.journeys[0].status).toBe('arrived');
});
