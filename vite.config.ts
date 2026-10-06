import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleRequest } from './server/http.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'QLOO_');
  return {
    plugins: [
      react(),
      {
        name: 'local-api',
        configureServer(server) {
          server.middlewares.use('/api', async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://localhost');
            let body: Record<string, unknown> = Object.fromEntries(url.searchParams);
            if (req.method === 'POST') {
              try {
                const chunks: Buffer[] = [];
                for await (const chunk of req) chunks.push(Buffer.from(chunk));
                body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { code: 'INVALID_INPUT', message: 'Invalid JSON request.' } }));
                return;
              }
            }
            const result = await handleRequest(req.method ?? 'GET', `/api${url.pathname}`, body, env.QLOO_API_KEY);
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));
          });
        },
      },
    ],
  };
});
