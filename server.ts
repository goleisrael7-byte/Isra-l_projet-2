import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { getDb, seedDatabaseIfEmpty } from './server/db.ts';
import { registerRoutes } from './server/routes.ts';
import { securityHeaders } from './server/security.ts';

export async function createAppServer() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '2mb' }));

  const db = getDb();
  seedDatabaseIfEmpty(db);

  registerRoutes(app, db);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  return app;
}

const PORT = Number(process.env.PORT || 3000);

if (process.env.NODE_ENV !== 'test') {
  createAppServer()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`AcademiaHA server listening on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}
