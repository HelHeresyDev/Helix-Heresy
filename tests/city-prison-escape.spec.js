const { test, expect } = require('@playwright/test');
const Escape = require('../city-prison-escape');
const Prison = require('../city-prison');
function fixture() {
  const p = { phase: 'escapeAttempt', collectedAt: 10, admittedAt: 20, termEndsAt: 1000, lastAt: 20, releasedAt: null, completedAt: null, history: [], reviewAt: 10000 };
  const s = { ledger: { remainingSeconds: 980, recognizedCustodyCreditSeconds: 100, transportCustodyCreditSeconds: 10 }, custodyAuthority: { status: 'served' } };
  const c = { trial: { sentence: { status: 'active' } } }; return { p, s, c };
}
test('only actual escape interrupts the local remainder; absence beyond the old deadline is not service', () => {
  const { p, s, c } = fixture(), facts = { mobile: true, outside: true, controlled: false };
  expect(Escape.escape(p, s, 100, { ...facts, outside: false })).toBe(false);
  expect(Escape.escape(p, s, 100, { ...facts, controlled: true })).toBe(false);
  expect(Escape.escape(p, s, 100, facts)).toBe(true); expect(Prison.custody(p)).toBe(false);
  const saved = JSON.parse(JSON.stringify({ p, s, c })); Prison.tick(saved.p, saved.s, saved.c, {}, 2000);
  expect(saved.s.ledger.remainingSeconds).toBe(900); expect(saved.p.releasedAt).toBeNull();
  expect(Escape.recapture(saved.p, saved.s, 2000)).toBe(true); expect(Escape.recapture(saved.p, saved.s, 2001)).toBe(false);
  expect(saved.p.termEndsAt).toBe(2900); expect(Prison.custody(saved.p)).toBe(true);
  Prison.tick(saved.p, saved.s, saved.c, {}, 2100);
  expect(saved.s.ledger.remainingSeconds).toBe(800); expect(saved.s.ledger.prisonServedSeconds).toBe(180);
  expect(saved.s.ledger.recognizedCustodyCreditSeconds).toBe(100); expect(saved.s.ledger.transportCustodyCreditSeconds).toBe(10);
});
test('witnessed reports retain observations, never convictions or current hidden positions', () => {
  const { p } = fixture(); Escape.observe(p, 'officer', 'fastening', { x: 25, y: 8, z: 3 }, 50);
  expect(Escape.target(p, 60)).toEqual({ x: 25, y: 8, z: 3 }); expect(Escape.target(p, 71)).toBeNull();
  Escape.observe(p, 'officer', 'fastening', { x: 26, y: 8, z: 3 }, 65);
  expect(p.escape.reports).toHaveLength(1); expect(p.escape.reports[0].allegationOnly).toBe(true);
  expect(Escape.target(p, 180)).toBeNull();
});
test('sentence expiry wins over an unfinished attempt and prevents recapture', () => {
  const { p, s, c } = fixture(); Escape.ensure(p);
  expect(Escape.escape(p, s, 1000, { mobile: true, outside: true, controlled: false })).toBe(false);
  Prison.tick(p, s, c, {}, 1000); expect(p.phase).toBe('releaseDue');
  expect(Escape.recapture(p, s, 1000)).toBe(false); expect(s.ledger.remainingSeconds).toBe(0);
});
