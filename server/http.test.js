import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from './http.js';

test('search without a key returns a visible server error', async () => {
  const result = await handleRequest('GET', '/api/search', { query: 'Arrival', type: 'movie' }, '');
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'NOT_CONFIGURED');
});

test('plan validates favorite entities before any upstream call', async () => {
  const result = await handleRequest('POST', '/api/plan', { action: 'create', favorites: [{ id: 'one' }], city: 'Shanghai', mood: 'Curious' }, 'unused');
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_INPUT');
});
