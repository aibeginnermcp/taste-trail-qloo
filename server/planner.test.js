import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlan, replaceRecommendation } from './planner.js';

const favorites = [
  { id: 'film-1', name: 'Arrival', type: 'movie' },
  { id: 'artist-1', name: 'Nils Frahm', type: 'artist' },
  { id: 'book-1', name: 'Piranesi', type: 'book' },
];

test('plan uses three real insight categories and falls back when a city has no places', async () => {
  const called = [];
  const plan = await createPlan({ favorites, mood: 'wander', city: 'Shanghai' }, async (args) => {
    called.push(args.targetType);
    if (args.targetType === 'place') return [];
    return [{ id: `${args.targetType}-2`, name: `Real ${args.targetType}`, type: args.targetType }];
  });

  assert.deepEqual(called, ['place', 'movie', 'artist', 'book']);
  assert.deepEqual(plan.recommendations.map((item) => item.type), ['movie', 'artist', 'book']);
  assert.equal(plan.locationUnavailable, true);
  assert.equal(plan.recommendations[0].basis.length, 3);
});

test('replacement re-queries its category and excludes already seen IDs', async () => {
  let calls = 0;
  const replacement = await replaceRecommendation({
    favorites,
    city: 'Shanghai',
    targetType: 'movie',
    excludedIds: ['movie-1'],
  }, async () => {
    calls += 1;
    return [
      { id: 'movie-1', name: 'Seen', type: 'movie' },
      { id: 'movie-2', name: 'New', type: 'movie' },
    ];
  });

  assert.equal(calls, 1);
  assert.equal(replacement.id, 'movie-2');
});

test('no new result returns null instead of repeating a rejected item', async () => {
  const replacement = await replaceRecommendation({
    favorites,
    targetType: 'book',
    excludedIds: ['book-1'],
  }, async () => [{ id: 'book-1', name: 'Seen', type: 'book' }]);

  assert.equal(replacement, null);
});

test('mood changes the order of genuine insight categories', async () => {
  const plan = await createPlan({ favorites, mood: 'Reflective', city: 'Shanghai' }, async ({ targetType }) =>
    [{ id: `${targetType}-2`, name: `Real ${targetType}`, type: targetType }]);
  assert.deepEqual(plan.recommendations.map((item) => item.type), ['book', 'movie', 'artist']);
});
