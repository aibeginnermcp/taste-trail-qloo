const BASE_URL = 'https://hackathon.api.qloo.com';
const TYPES = new Set(['movie', 'artist', 'book', 'place']);

export class QlooError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'QlooError';
    this.code = code;
    this.status = status;
  }
}

function typeUrn(type) {
  if (!TYPES.has(type)) throw new QlooError('INVALID_INPUT', 'Unsupported Qloo entity type.', 400);
  return `urn:entity:${type}`;
}

function normalizeEntity(entity, fallbackType) {
  const id = entity.entity_id ?? entity.id;
  const name = entity.name ?? entity.title;
  if (!id || !name) return null;
  const subtype = entity.subtype ?? entity.type ?? '';
  const parsedType = typeof subtype === 'string' && subtype.startsWith('urn:entity:')
    ? subtype.slice('urn:entity:'.length)
    : fallbackType;
  const type = TYPES.has(parsedType) ? parsedType : fallbackType;
  const imageUrl = entity.properties?.image?.url ?? entity.properties?.image_url ?? entity.image?.url ?? null;
  return { id: String(id), name: String(name), type, imageUrl };
}

async function request(path, params, { apiKey, fetchImpl = fetch, allowNotFound = false }) {
  if (!apiKey) throw new QlooError('NOT_CONFIGURED', 'Qloo API key is not configured on the server.', 503);
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  let response;
  try {
    response = await fetchImpl(url.toString(), {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new QlooError('UPSTREAM_UNAVAILABLE', 'Qloo could not be reached. Please try again.', 502);
  }
  if (response.status === 429) throw new QlooError('RATE_LIMITED', 'Qloo is rate limiting requests. Please try again shortly.', 429);
  if (response.status === 404 && allowNotFound) return { results: [] };
  if (response.status === 401 || response.status === 403) throw new QlooError('AUTH_FAILED', 'Qloo rejected this API key or entity type. Check the server configuration.', 502);
  if (!response.ok) throw new QlooError('UPSTREAM_ERROR', `Qloo returned HTTP ${response.status}.`, 502);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new QlooError('UPSTREAM_ERROR', 'Qloo returned an unreadable response.', 502);
  }
  return data;
}

function results(data, type) {
  const raw = Array.isArray(data.results) ? data.results : data.results?.entities ?? data.entities ?? [];
  return Array.isArray(raw) ? raw.map((entity) => normalizeEntity(entity, type)).filter(Boolean) : [];
}

export async function searchEntities({ query, type, apiKey, fetchImpl }) {
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100) {
    throw new QlooError('INVALID_INPUT', 'Enter at least two characters to search.', 400);
  }
  const data = await request('/search', { query: query.trim(), types: typeUrn(type) }, { apiKey, fetchImpl, allowNotFound: true });
  return results(data, type).slice(0, 8);
}

export async function getInsights({ favoriteIds, targetType, city, apiKey, fetchImpl }) {
  if (!Array.isArray(favoriteIds) || favoriteIds.length === 0 || favoriteIds.some((id) => typeof id !== 'string')) {
    throw new QlooError('INVALID_INPUT', 'Choose Qloo taste entities first.', 400);
  }
  const params = {
    'filter.type': typeUrn(targetType),
    'signal.interests.entities': favoriteIds.join(','),
  };
  if (targetType === 'place' && city) params['filter.location.query'] = city;
  const data = await request('/v2/insights', params, { apiKey, fetchImpl });
  return results(data, targetType);
}
