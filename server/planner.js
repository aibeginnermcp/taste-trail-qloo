const CATEGORIES = ['place', 'movie', 'artist', 'book'];
const MOOD_ORDER = {
  Curious: ['place', 'movie', 'book', 'artist'],
  Reflective: ['book', 'movie', 'artist', 'place'],
  Playful: ['place', 'artist', 'movie', 'book'],
  Slow: ['book', 'artist', 'place', 'movie'],
};

function validateFavorites(favorites) {
  if (!Array.isArray(favorites) || favorites.length !== 3 || favorites.some((item) =>
    !item || typeof item.id !== 'string' || typeof item.name !== 'string' ||
    !['movie', 'artist', 'book'].includes(item.type))) {
    throw new Error('Select exactly three movies, artists, or books from Qloo search.');
  }
}

function decorate(entity, favorites) {
  return {
    ...entity,
    basis: favorites.map(({ id, name, type }) => ({ id, name, type })),
  };
}

export async function createPlan({ favorites, mood, city }, insights) {
  validateFavorites(favorites);
  const favoriteIds = favorites.map((item) => item.id);
  const responses = await Promise.all(CATEGORIES.map((targetType) =>
    insights({ favoriteIds, targetType, city: targetType === 'place' ? city : undefined })));
  const locationUnavailable = responses[0].length === 0;
  const used = new Set(favoriteIds);
  const recommendations = [];
  const orderedTypes = MOOD_ORDER[mood] ?? CATEGORIES;
  for (const targetType of orderedTypes) {
    const entities = responses[CATEGORIES.indexOf(targetType)];
    const entity = entities.find((candidate) => candidate && !used.has(candidate.id));
    if (entity) {
      recommendations.push(decorate(entity, favorites));
      used.add(entity.id);
    }
    if (recommendations.length === 3) break;
  }
  return { recommendations, locationUnavailable, mood, city };
}

export async function replaceRecommendation({ favorites, city, targetType, excludedIds = [] }, insights) {
  validateFavorites(favorites);
  if (!CATEGORIES.includes(targetType)) throw new Error('Unsupported recommendation category.');
  const entities = await insights({
    favoriteIds: favorites.map((item) => item.id),
    targetType,
    city: targetType === 'place' ? city : undefined,
  });
  const excluded = new Set([...excludedIds, ...favorites.map((item) => item.id)]);
  const next = entities.find((entity) => entity && !excluded.has(entity.id));
  return next ? decorate(next, favorites) : null;
}
