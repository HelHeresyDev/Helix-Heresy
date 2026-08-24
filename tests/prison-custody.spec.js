// @ts-check
const { test, expect } = require('@playwright/test');
const Prison = require('../prison-custody.js');
const Trial = require('../trial-sentencing.js');

function committed(months = 6) {
  return Prison.commit(Prison.defaultState(), { seed: 'iron-world', clock: 1000, caseId: 'case-1', orderId: 'order-1', jailStayId: 'jail-1', docket: 'CR-0042', incarcerationMonths: months, roomIds: ['statePrisonHousing'], labSnapshot: { money: 1200 } });
}

test('finite prison intake creates a crowded deterministic physical population and a bounded sentence', () => {
  const first = committed(500); const second = committed(500);
  expect(first.created).toBe(true);
  expect(first.stay).toMatchObject({ status: 'active', facility: { capacity: 9, occupied: 9, strategicCapacity: 240, strategicPopulation: 268 }, sentence: { months: 120, maximumMonths: 120 }, suppressor: { suppressionActive: true }, plan: { assignmentId: 'infrastructureSorting', priorityId: 'assignment' } });
  expect(first.stay.actors.filter((actor) => actor.role === 'prisoner')).toHaveLength(8);
  expect(first.stay.actors.filter((actor) => actor.role !== 'prisoner')).toHaveLength(5);
  expect(first.stay.actors.map((actor) => actor.name)).toEqual(second.stay.actors.map((actor) => actor.name));
  expect(new Set(first.stay.actors.map((actor) => actor.name)).size).toBe(first.stay.actors.length);
  expect(Prison.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('daily routines produce prison-only wages, practice, participation, and causal relationship history', () => {
  let { state, stay } = committed();
  state = Prison.setPlan(state, stay.id, { assignmentId: 'recordsProgram', priorityId: 'assignment' }, 1100).state;
  const advanced = Prison.advance(state, 1000 + 2 * Prison.DAY);
  expect(advanced.stay.assignment).toMatchObject({ daysCompleted: 2, wages: 8, skillPractice: 2, participationRecord: 4 });
  expect(advanced.stay.property.prisonWages).toBe(8);
  const actor = advanced.stay.actors.find((entry) => entry.role === 'prisoner');
  const interaction = Prison.interact(advanced.state, stay.id, actor.id, 'favor', 1000 + 2 * Prison.DAY + 1);
  const relationship = interaction.stay.relationships.find((entry) => entry.actorId === actor.id);
  expect(relationship.history.at(-1)).toMatchObject({ delta: 5, reason: expect.stringContaining(actor.name) });
  expect(relationship.band).toBe(Prison.relationshipBand(relationship.score).id);
});

test('refusal and violations stop compression with proportionate saved discipline', () => {
  let { state, stay } = committed();
  state = Prison.setPlan(state, stay.id, { priorityId: 'refusal' }, 1100).state;
  let advanced = Prison.advance(state, 1000 + Prison.DAY);
  expect(advanced).toMatchObject({ stopReason: 'routineRefusal', stay: { decision: { required: true }, assignment: { daysCompleted: 0 } } });
  const disciplined = Prison.recordViolation(advanced.state, stay.id, 'contraband', 1000 + Prison.DAY + 1);
  expect(disciplined).toMatchObject({ response: 'privilegeRestriction', stay: { discipline: { warnings: 1, incidents: [expect.objectContaining({ kind: 'contraband', response: 'privilegeRestriction' })] } } });
});

test('communications are delayed and release due is a living custody boundary, not game over', () => {
  let { state, stay } = committed(1);
  const requested = Prison.requestCommunication(state, stay.id, 'companyPortal', 'Helix company', 1200); state = requested.state;
  expect(requested.request).toMatchObject({ status: 'pending', readyAt: 1200 + 24 * Prison.HOUR });
  state = Prison.advance(state, requested.request.readyAt).state;
  const ready = Prison.activeStay(state).communications.requests[0]; expect(ready.status).toBe('ready');
  const completed = Prison.completeCommunication(state, stay.id, ready.id, ready.readyAt, { money: 900 });
  expect(completed.stay.knowledge).toMatchObject({ labSnapshotAt: ready.readyAt, labSnapshot: { money: 900 }, reports: [expect.objectContaining({ money: 900 })] });
  const released = Prison.advance(completed.state, stay.sentence.releaseAt);
  expect(released.stay).toMatchObject({ status: 'releaseDue', decision: { kind: 'releaseDue', required: true } });
  expect(released.stay).not.toHaveProperty('runEnded');
});

test('legacy life orders normalize to the ten-year finite maximum', () => {
  const state = Trial.normalizeState({ version: 1, cases: [{ id: 'case-legacy', sentencing: { order: { id: 'order-legacy', kind: 'lifePrison', label: 'Life imprisonment', custodial: true, life: true, destinationId: 'statePrisonIntake', status: 'commitmentPending' } } }] });
  expect(state.cases[0].sentencing.order).toMatchObject({ kind: 'finitePrison', label: 'Maximum finite prison commitment', incarcerationMonths: 120 });
  expect(state.cases[0].sentencing.order).not.toHaveProperty('life');
});
