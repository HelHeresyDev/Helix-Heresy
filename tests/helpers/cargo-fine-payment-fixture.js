const { expect } = require('@playwright/test');
const Review = require('../../cargo-judgment-review');
const Fines = require('../../cargo-fine-payment');
const Referrals = require('../../cargo-criminal-referrals');
const { sentencingFixture } = require('./cargo-sentencing-fixture');
function fineFixture({ balance = 1000, policy, beforeReview } = {}) {
  const f = sentencingFixture(policy); f.untilSentence('sentence');
  if (beforeReview) beforeReview(f);
  let at = f.sentencingClock();
  for (let n = 0; n < 1600 && f.d.judgmentReview?.phase !== 'decided'; n++) {
    at += 60; Review.advance(f.state, f.gate, at, Referrals.findings);
  }
  expect(f.d.judgmentReview.phase).toBe('decided');
  f.buyer.money = balance; // Explicit fixture business balance, never defendant wealth.
  const step = (seconds = 60) => { at += seconds; Fines.advance(f.state, f.gate, at); };
  const until = phase => { for (let n = 0; n < 200 && f.d.finePayment?.phase !== phase; n++) step(); expect(f.d.finePayment?.phase).toBe(phase); };
  return { ...f, stepFine: step, untilFine: until, fineClock: () => at };
}
module.exports = { fineFixture };
