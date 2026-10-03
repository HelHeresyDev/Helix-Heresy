const { expect } = require('@playwright/test');
const Sentencing = require('../../cargo-sentencing');
const { fixture } = require('./cargo-appearance-fixture');
const { trialFixture } = require('./cargo-trial-fixture');
const finePolicy = { ordinarySanctions: ['fine', 'finitePrison'], fineRangeCredits: { minimum: 120, maximum: 900 }, finitePrisonRangeMonths: { minimum: 3, maximum: 48 } };
function sentencingFixture(policy = finePolicy) {
  const base = fixture({ trialSources: true, sentencing: policy }); base.until('complete');
  const f = trialFixture(base); f.untilTrial('judgment');
  let now = f.clock();
  const step = (seconds = 60) => { now += seconds; Sentencing.advance(f.state, f.gate, now); };
  const until = phase => { for (let i = 0; i < 1800 && f.d.sentencing?.phase !== phase; i++) step(); expect(f.d.sentencing?.phase).toBe(phase); };
  return { ...f, stepSentence: step, untilSentence: until, sentencingClock: () => now };
}
module.exports = { sentencingFixture, finePolicy };
