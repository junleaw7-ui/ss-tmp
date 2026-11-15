import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore -- Node type stripping needs the .ts extension
import { triage, triageByRules } from './triage.ts';

test('rules: "air naik" is rescue/critical', async () => {
  const t = await triage('air naik', { rulesOnly: true });
  assert.equal(t.need, 'rescue');
  assert.equal(t.urgency, 'critical');
  assert.equal(t.source, 'rules');
});

test('rules: medicine, food, fallback', () => {
  assert.equal(triageByRules('Ubat darah tinggi atuk dah habis').need, 'medical');
  assert.equal(triageByRules('tak ada makanan').need, 'food');
  assert.deepEqual(
    { need: triageByRules('hello').need, urgency: triageByRules('hello').urgency },
    { need: 'other', urgency: 'medium' },
  );
});
