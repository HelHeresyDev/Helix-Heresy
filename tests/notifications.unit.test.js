const { test } = require('node:test'), assert = require('node:assert/strict');
const N = require('../notifications');
const enabled = { muted: false, volume: .3 };
const event = (kind = 'warning', sourceId = 'a', text = 'Observed work') => ({ cue: kind, sourceKind: 'actual', sourceId, message: text, time: 10 });
test('preferences start muted, clamp finite volume, and retain independent category choices', () => {
  assert(N.preferences().muted); assert.equal(N.preferences({ volume: 0 }).volume, 0);
  assert.equal(N.preferences({ volume: 20 }).volume, 1); assert.equal(N.preferences({ volume: -2 }).volume, 0);
  assert.equal(N.preferences({ volume: NaN }).volume, .25);
  assert.deepEqual(N.preferences({ muted: false, categories: { warning: false } }).categories, { completion: true, discovery: true, warning: false, danger: true });
});
test('existing severity and explicit semantic cues classify important work without routine motion, hits, XP or failed-completion fanfare', () => {
  for (const text of ['Material hauling complete.', 'Scientist movement complete.', 'Chemistry gained 10 XP.', 'Scientist arrived.']) assert.equal(N.kind({ message: text }), null);
  assert.equal(N.kind({ message: 'Research complete.' }), 'completion');
  assert.equal(N.kind({ message: 'Discovery recorded.', category: 'discovery' }), 'discovery');
  assert.equal(N.kind({ severity: 'serious', category: 'facility' }), 'warning');
  assert.equal(N.kind({ severity: 'warning', category: 'combat', message: 'Individual hit' }), null);
  assert.equal(N.kind({ severity: 'critical', category: 'combat' }), 'danger');
  assert.equal(N.kind({ message: 'Research could not complete.' }), null);
  assert.equal(N.kind({ cue: 'none', severity: 'critical' }), null);
});
test('one fast-simulation burst coalesces a thousand related notices without modifying the original event history', () => {
  const q = N.createQueue(), history = Array.from({ length: 1000 }, (_, i) => event('warning', 'source', `Warning ${i}`));
  const original = JSON.stringify(history); history.forEach(e => q.offer(e));
  const out = q.flush(100, enabled); assert.equal(out.sound, 'warning'); assert.equal(out.groups.length, 1);
  assert.equal(out.groups[0].count, 1000); assert.equal(out.groups[0].event.message, 'Warning 999'); assert.equal(JSON.stringify(history), original);
  assert.equal(q.flush(100000, enabled).sound, null); // No later backlog replay.
});
test('real-time cooldowns suppress repeats, while genuinely higher urgency can interrupt a lower-priority cue', () => {
  const q = N.createQueue(); q.offer(event('completion')); assert.equal(q.flush(0, enabled).sound, 'completion');
  q.offer(event('completion')); assert.equal(q.flush(100, enabled).sound, null);
  q.offer(event('danger')); assert.equal(q.flush(200, enabled).sound, 'danger');
  q.offer(event('warning', 'b')); assert.equal(q.flush(300, enabled).sound, null);
  q.offer(event('danger')); assert.equal(q.flush(3000, enabled).sound, null);
  q.offer(event('danger')); assert.equal(q.flush(6200, enabled).sound, 'danger');
});
test('muting, zero volume and category toggles suppress only sound, not equivalent readable notices', () => {
  for (const p of [{}, { muted: false, volume: 0 }, { muted: false, categories: { warning: false } }]) {
    const q = N.createQueue(); q.offer(event()); const out = q.flush(0, p);
    assert.equal(out.sound, null); assert.equal(out.notice.kind, 'warning'); assert.equal(out.groups.length, 1);
    assert.equal(q.flush(10000, enabled).sound, null);
  }
});
test('unavailable knowledge is excluded on arrival and checked again at delivery; old notices cannot track hidden new facts', () => {
  const q = N.createQueue(), hidden = event('danger', 'secret'); assert(!q.offer(hidden, false));
  const received = event(); q.offer(received); assert.equal(q.flush(0, enabled, () => false).groups.length, 0);
  assert.equal(q.flush(10000, enabled).sound, null);
  q.offer(received); const out = q.flush(11000, enabled); received.message = 'Private later fact';
  assert.equal(out.groups[0].event.message, 'Observed work');
  assert.equal(q.flush(12000, enabled, () => false).groups.length, 0);
});
test('background delivery and session reset discard pending cues rather than replaying them after return, import or restart', () => {
  const q = N.createQueue(); q.offer(event('danger'));
  assert.equal(q.flush(0, enabled, () => true, false).sound, null);
  assert.equal(q.flush(10000, enabled).groups.length, 0);
  q.offer(event()); q.clear(); assert.equal(q.flush(20000, enabled).sound, null);
  assert.equal(q.snapshot().length, 0);
});
test('ordinary notices expire, dangers stay readable until dismissal, and grouping is bounded', () => {
  const q = N.createQueue(); q.offer(event('danger')); q.offer(event('completion', 'b'));
  const out = q.flush(0, enabled); assert.equal(out.sound, 'danger');
  assert.equal(q.flush(N.WINDOW + 1, enabled).groups.length, 1);
  q.dismiss(out.groups[0].key); assert.equal(q.snapshot().length, 0);
  for (let n = 0; n < 1000; n++) q.offer(event('warning', `source-${n}`));
  assert.equal(q.flush(100000, enabled).groups.length, N.LIMIT);
});
function fakeHost(options = {}) {
  const notes = [], gains = [];
  class Context {
    constructor() { if (options.constructorFails) throw Error('no device'); this.state = 'suspended'; this.currentTime = 10; this.destination = {}; }
    async resume() { if (options.resumeFails) throw Error('blocked'); this.state = 'running'; }
    createGain() { if (options.gainFails) throw Error('lost device'); const values = []; gains.push(values); return { connect() {}, disconnect() {}, gain: {
      setValueAtTime: (...v) => values.push(v), linearRampToValueAtTime: (...v) => values.push(v), exponentialRampToValueAtTime: (...v) => values.push(v) } }; }
    createOscillator() { const note = { stops: 0, frequency: {}, connect() {}, disconnect() {}, start(t) { this.startAt = t; }, stop(t) { this.stops++; if (t !== undefined) this.stopAt = t; } }; notes.push(note); return note; }
  }
  const host = { document: { hidden: false }, AudioContext: Context };
  return { host, notes, gains };
}
test('four short distinct finite tone patterns are gesture-unlocked, volume-scaled and never played in the background', async () => {
  const f = fakeHost(), a = N.createAudio(f.host); assert(!a.play('danger', .5)); assert(await a.unlock());
  for (const k of N.KINDS) assert(a.play(k, .5));
  assert(f.notes.every(n => n.startAt >= 10 && n.stopAt <= 10.4));
  assert(f.gains.every(g => g[1][0] === .06));
  const before = f.notes.length; f.host.document.hidden = true; assert(!a.play('danger', .5)); assert.equal(f.notes.length, before);
  f.host.document.hidden = false; assert(!a.play('danger', 0));
  a.stop(); assert(f.notes.every(n => n.stops >= 2));
});
test('missing, rejected, suspended or failing browser audio gracefully leaves notifications functional', async () => {
  const unavailable = N.createAudio({}); assert(!await unavailable.unlock()); assert.match(unavailable.status(), /unavailable/);
  for (const options of [{ constructorFails: true }, { resumeFails: true }]) assert(!await N.createAudio(fakeHost(options).host).unlock());
  const a = N.createAudio(fakeHost({ gainFails: true }).host); assert(await a.unlock()); assert(!a.play('danger', .2)); assert.match(a.status(), /Text notifications/);
  const q = N.createQueue(); q.offer(event()); assert.equal(q.flush(0, enabled).groups.length, 1);
});
