// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { HostNet } from '../js/net.js';

// a stand-in for a PeerJS DataConnection: records what's sent, lets the test push data in
function fakeConn(metadata) {
  const on = {};
  return { metadata, open: true, sent: [], on: (ev, fn) => { on[ev] = fn; }, send(m) { this.sent.push(m); }, close() {}, data: (m) => on.data(m) };
}

function host() {
  const events = [];
  const h = new HostNet({ onEvent: (e) => events.push(e) });
  h.mode = 'peer'; h.conns = new Map(); h.lastQ = new Map();
  return { h, events, inputs: () => events.filter((e) => e.t === 'phone-msg').map((e) => e.msg) };
}

test('control positions on the fast channel reach the game, and late old ones are dropped', () => {
  const { h, inputs } = host();
  const main = fakeConn(), fast = fakeConn({ fast: 1 });
  h._accept(main); h._accept(fast);
  main.data({ t: 'phone', pid: 'abc123' });
  fast.data({ t: 'fast', pid: 'abc123' });
  fast.data({ t: 'in', id: 1, b: 'stick', x: 0.1, y: 0, h: 0, q: 0 });
  fast.data({ t: 'in', id: 1, b: 'stick', x: 0.5, y: 0, h: 0, q: 2 });
  fast.data({ t: 'in', id: 1, b: 'stick', x: 0.3, y: 0, h: 0, q: 1 }); // arrived late: stale
  main.data({ t: 'in', id: 1, b: 'stick', x: 0.9, y: 0, h: 1, q: 3 }); // fallback over the main channel
  main.data({ t: 'in', id: 1, b: 'go' }); // a button press, no number
  assert.deepEqual(inputs().map((m) => m.x ?? m.b), [0.1, 0.5, 0.9, 'go']);
  assert.ok(inputs().every((m) => !('q' in m)), 'the number is stripped before the game sees it');
});

test('the fast channel only carries input, and only for a phone that has joined', () => {
  const { h, inputs } = host();
  const fast = fakeConn({ fast: 1 });
  h._accept(fast);
  fast.data({ t: 'fast', pid: 'nobody1' });
  fast.data({ t: 'in', id: 1, b: 'stick', x: 1, y: 0, h: 0, q: 0 });
  assert.equal(inputs().length, 0);
  const main = fakeConn();
  h._accept(main);
  main.data({ t: 'phone', pid: 'nobody1' });
  fast.data({ t: 'profile', name: 'sneaky', q: 1 });
  assert.equal(inputs().length, 0);
});

test('a reloaded phone counting from 0 again is not ignored', () => {
  const { h, inputs } = host();
  const a = fakeConn();
  h._accept(a);
  a.data({ t: 'phone', pid: 'abc123' });
  a.data({ t: 'in', id: 1, b: 'tilt', v: 0.2, q: 50 });
  const b = fakeConn();
  h._accept(b);
  b.data({ t: 'phone', pid: 'abc123' });
  b.data({ t: 'in', id: 1, b: 'tilt', v: 0.4, q: 0 });
  assert.deepEqual(inputs().map((m) => m.v), [0.2, 0.4]);
});
