import { test } from 'node:test';
import assert from 'node:assert/strict';
// Node strips types and needs the explicit extension; tsc (bundler resolution) would flag it.
// @ts-ignore TS5097
import { buildListedSet, computeStatus, scoreHousehold } from './scoring.ts';
import type { Household, RollCall } from './types';

const START = new Date('2026-01-01T10:00:00Z');
const rollCall: RollCall = {
  id: 'rc',
  area: 'Kuala Krai',
  started_at: START.toISOString(),
  deadline_minutes: 2,
  ended_at: null,
};
/** `now` = deadline + m minutes. */
const afterDeadline = (m: number) => new Date(START.getTime() + (2 + m) * 60_000);

function hh(over: Partial<Household>): Household {
  return {
    id: 'x', code: 'ABCDEF', label: 'No. 1', kampung: 'Kg Test', head_name: 'Test',
    members: 1, tags: [], risk_zone: 'low', phone_masked: null, lat: 0, lng: 0,
    status: 'pending', message: null, triage: null, replied_at: null, source: 'self',
    buddy_note: null, scheduled_reply_at: null, scheduled_status: null,
    scheduled_message: null, is_demo: false, updated_at: START.toISOString(),
    ...over,
  };
}

const critical = { urgency: 'critical', need: 'rescue', people: 1, summary_en: '', source: 'rules' } as const;

const A = hh({ id: 'A', tags: ['elderly'], risk_zone: 'high' });
const B = hh({ id: 'B', status: 'help' });
const C = hh({ id: 'C', status: 'help', tags: ['elderly'], risk_zone: 'high', triage: critical });
const D = hh({ id: 'D', tags: ['oku'], risk_zone: 'medium' });
const E = hh({ id: 'E', status: 'dispatched', tags: ['elderly'], risk_zone: 'high' });
const F = hh({ id: 'F', buddy_note: 'Cannot reach' });

// Silent minutes: A=3, D=25 (capped at 20), F=1. Other statuses are time independent.
const scoreAt = (h: Household, m: number) => scoreHousehold(h, rollCall, afterDeadline(m)).score;

test('worked examples', () => {
  assert.equal(scoreAt(A, 3), 78);
  assert.equal(scoreAt(B, 3), 50);
  assert.equal(scoreAt(C, 3), 100);
  assert.equal(scoreAt(D, 25), 85);
  assert.equal(scoreAt(E, 3), 40);
  assert.equal(scoreAt(F, 1), 51);
});

test('reasons are i18n keys', () => {
  const { reasons } = scoreHousehold(A, rollCall, afterDeadline(3));
  assert.ok(reasons.includes('reason.silentMin:3'));
  assert.ok(reasons.includes('reason.elderly'));
  assert.ok(reasons.includes('reason.riskHigh'));
  assert.ok(scoreHousehold(F, rollCall, afterDeadline(1)).reasons.includes('reason.buddyUnreachable'));
});

test('ordering C > D > A > F > B > E', () => {
  const now = afterDeadline(3);
  // Use per-household minutes by giving all the same start; D needs 25 min, so use one `now` of 25
  // and recompute expectations through scoreAt instead.
  const scores = { C: scoreAt(C, 3), D: scoreAt(D, 25), A: scoreAt(A, 3), F: scoreAt(F, 1), B: scoreAt(B, 3), E: scoreAt(E, 3) };
  const order = Object.entries(scores).sort((x, y) => y[1] - x[1]).map(([k]) => k).join('');
  assert.equal(order, 'CDAFBE');
  void now;
});

test('listed set contains only help/silent/dispatched, sorted by score desc', () => {
  const safe = hh({ id: 'S', status: 'safe', tags: ['elderly'], risk_zone: 'high' });
  const rescued = hh({ id: 'R', status: 'rescued', tags: ['elderly'], risk_zone: 'high' });
  const pendingBefore = hh({ id: 'P', tags: ['elderly'], risk_zone: 'high' });

  // Before the deadline: pending is not listed.
  const early = buildListedSet([safe, rescued, pendingBefore, B, E], rollCall, new Date(START.getTime() + 60_000));
  assert.deepEqual(early.map((l) => l.household.id), ['B', 'E']);

  // Without a roll call: pending is not listed.
  assert.deepEqual(buildListedSet([pendingBefore, safe, rescued], null, afterDeadline(5)), []);

  // After the deadline at 3 minutes: A and pending-turned-silent are listed, safe/rescued never.
  const now = afterDeadline(3);
  const listed = buildListedSet([safe, rescued, A, B, C, E], rollCall, now);
  assert.deepEqual(listed.map((l) => l.household.id), ['C', 'A', 'B', 'E']);
  assert.ok(listed.every((l, i) => i === 0 || listed[i - 1].score >= l.score));
});

test('vulnerability total is capped at 30', () => {
  const h = hh({ status: 'help', tags: ['elderly', 'oku', 'baby'] });
  assert.equal(scoreHousehold(h, rollCall, afterDeadline(0)).score, 50 + 30);
});

test('computeStatus', () => {
  const beforeDeadline = new Date(START.getTime() + 60_000);
  for (const s of ['safe', 'help', 'dispatched', 'rescued'] as const) {
    assert.equal(computeStatus(hh({ status: s }), rollCall, afterDeadline(5)), s);
    assert.equal(computeStatus(hh({ status: s }), null, beforeDeadline), s);
  }
  assert.equal(computeStatus(hh({}), rollCall, beforeDeadline), 'pending');
  assert.equal(computeStatus(hh({}), rollCall, afterDeadline(1)), 'silent');
  assert.equal(computeStatus(hh({}), null, afterDeadline(1)), 'pending');
});
