import { handleRequest } from '../server/http.js';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const result = await handleRequest(req.method, '/api/search', Object.fromEntries(url.searchParams), process.env.QLOO_API_KEY);
  res.status(result.status).json(result.body);
}
