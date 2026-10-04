const { expect } = require('@playwright/test');
const { commitmentFixture } = require('./cargo-commitment-fixture');
const Commitment = require('../../cargo-commitment');
const Prison = require('../../cargo-prison');
function prisonFixture() {
  const f = commitmentFixture(); f.untilCommitment('reserved');
  let at = f.commitmentClock();
  const step = (seconds = 60) => {
    at += seconds; Commitment.advance(f.state, f.gate, at); Prison.advance(f.state, f.gate, at);
  };
  const until = phase => {
    for (let n = 0; n < 200 && f.d.commitment.execution?.phase !== phase; n++) step();
    expect(f.d.commitment.execution?.phase, JSON.stringify(f.d.commitment.execution)).toBe(phase);
  };
  return { ...f, stepPrison: step, untilPrison: until, prisonClock: () => at };
}
module.exports = { prisonFixture };
