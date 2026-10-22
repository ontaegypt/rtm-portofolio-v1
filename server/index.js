import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

// Mount API routes under /api
app.use('/api', api);

// Serve static assets from dist in production
const DIST_DIR = path.resolve(__dirname, '../dist');
app.use(express.static(DIST_DIR));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 RTM Server & Database API running at http://localhost:${PORT}`);
    console.log(`📡 API Endpoints available under http://localhost:${PORT}/api`);
  });
}

export default app;
