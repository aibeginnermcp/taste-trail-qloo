import assert from 'node:assert/strict';
import test from 'node:test';
import { getInsights, QlooError, searchEntities } from './qloo.js';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

test('search resolves entities through the hackathon host with a server-side header', async () => {
  let request;
  const entities = await searchEntities({
    query: 'Arrival',
    type: 'movie',
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return response({ results: [{ entity_id: 'film-1', name: 'Arrival', subtype: 'urn:entity:movie' }] });
    },
  });

  assert.equal(request.url.origin, 'https://hackathon.api.qloo.com');
  assert.equal(request.url.pathname, '/search');
  assert.equal(request.url.searchParams.get('query'), 'Arrival');
  assert.equal(request.url.searchParams.get('types'), 'urn:entity:movie');
  assert.equal(request.options.headers['X-Api-Key'], 'test-key');
  assert.deepEqual(entities, [{ id: 'film-1', name: 'Arrival', type: 'movie', imageUrl: null }]);
});

test('place insights use the selected taste entities and city filter', async () => {
  let request;
  const entities = await getInsights({
    favoriteIds: ['film-1', 'artist-2'],
    targetType: 'place',
    city: 'Shanghai',
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return response({ results: { entities: [{ entity_id: 'place-1', name: 'Museum', subtype: 'urn:entity:place' }] } });
    },
  });

  assert.equal(request.url.pathname, '/v2/insights');
  assert.equal(request.url.searchParams.get('filter.type'), 'urn:entity:place');
  assert.equal(request.url.searchParams.get('signal.interests.entities'), 'film-1,artist-2');
  assert.equal(request.url.searchParams.get('filter.location.query'), 'Shanghai');
  assert.equal(request.options.headers['X-Api-Key'], 'test-key');
  assert.equal(entities[0].id, 'place-1');
});

test('a missing key never sends a request or substitutes made-up results', async () => {
  await assert.rejects(
    searchEntities({ query: 'Arrival', type: 'movie', apiKey: '', fetchImpl: () => assert.fail('fetch called') }),
    (error) => error instanceof QlooError && error.code === 'NOT_CONFIGURED' && error.status === 503,
  );
});

test('rate limits become a clear retryable error', async () => {
  await assert.rejects(
    getInsights({ favoriteIds: ['film-1'], targetType: 'movie', apiKey: 'test-key', fetchImpl: async () => response({}, 429) }),
    (error) => error instanceof QlooError && error.code === 'RATE_LIMITED' && error.status === 429,
  );
});
