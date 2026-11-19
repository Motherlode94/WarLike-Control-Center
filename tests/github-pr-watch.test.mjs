import test from 'node:test';
import assert from 'node:assert/strict';
import { assess } from '../scripts/github-pr-watch.mjs';

const now = new Date('2026-11-19T12:00:00Z');
const base = { updated_at: '2026-11-18T12:00:00Z', draft: false, mergeable: true, mergeable_state: 'clean' };
test('failed checks force P0', () => {
  assert.equal(assess(base, [{status:'completed',conclusion:'failure'}], 7, now).level, 'P0');
});
test('conflicts force P0', () => {
  assert.equal(assess({...base,mergeable:false}, [], 7, now).level, 'P0');
});
test('stale PRs become P1', () => {
  assert.equal(assess({...base,updated_at:'2026-11-01T12:00:00Z'}, [], 7, now).level, 'P1');
});
test('draft PRs become P2', () => {
  assert.equal(assess({...base,draft:true}, [], 7, now).level, 'P2');
});
test('ordinary PRs stay P3', () => {
  assert.equal(assess(base, [], 7, now).level, 'P3');
});
