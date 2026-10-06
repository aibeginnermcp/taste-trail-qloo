import { getInsights, QlooError, searchEntities } from './qloo.js';
import { createPlan, replaceRecommendation } from './planner.js';

const allowedTypes = new Set(['movie', 'artist', 'book']);

function badRequest(message) {
  return new QlooError('INVALID_INPUT', message, 400);
}

function favoritesFrom(value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) =>
    !item || typeof item.id !== 'string' || item.id.length > 100 ||
    typeof item.name !== 'string' || item.name.length > 150 ||
    !allowedTypes.has(item.type))) {
    throw badRequest('Select three Qloo search results first.');
  }
  return value;
}

export async function handleRequest(method, path, body, apiKey) {
  try {
    if (path === '/api/search' && method === 'GET') {
      const query = String(body.query ?? '');
      const type = String(body.type ?? '');
      if (!allowedTypes.has(type)) throw badRequest('Choose movie, music, or book.');
      return { status: 200, body: { entities: await searchEntities({ query, type, apiKey }) } };
    }
    if (path === '/api/plan' && method === 'POST') {
      const favorites = favoritesFrom(body.favorites);
      const city = String(body.city ?? '').trim();
      const mood = String(body.mood ?? '').trim();
      if (!city || city.length > 80 || !mood || mood.length > 80) throw badRequest('Choose a city and mood.');
      const insights = (args) => getInsights({ ...args, apiKey });
      if (body.action === 'replace') {
        if (!['place', 'movie', 'artist', 'book'].includes(body.targetType)) throw badRequest('Invalid category.');
        if (!Array.isArray(body.excludedIds) || body.excludedIds.length > 100 || body.excludedIds.some((id) => typeof id !== 'string' || id.length > 100)) {
          throw badRequest('Invalid excluded entities.');
        }
        const recommendation = await replaceRecommendation({
          favorites, city, targetType: body.targetType, excludedIds: body.excludedIds,
        }, insights);
        return { status: 200, body: { recommendation } };
      }
      if (body.action !== 'create') throw badRequest('Invalid action.');
      return { status: 200, body: { plan: await createPlan({ favorites, city, mood }, insights) } };
    }
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Route not found.' } } };
  } catch (error) {
    const known = error instanceof QlooError;
    return {
      status: known ? error.status : 500,
      body: { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Something went wrong. Please try again.' } },
    };
  }
}
