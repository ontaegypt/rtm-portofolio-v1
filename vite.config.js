import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'rtm-api-server',
      async configureServer(server) {
        try {
          const { apiApp } = await import('./server/api.js');
          server.middlewares.use((req, res, next) => {
            if (req.url && (req.url.startsWith('/api') || req.originalUrl?.startsWith('/api'))) {
              return apiApp(req, res, next);
            }
            next();
          });
        } catch (err) {
          console.warn('[Vite API Middleware] Could not load server/api.js, running in static mode:', err.message);
        }
      },
      async configurePreviewServer(server) {
        try {
          const { apiApp } = await import('./server/api.js');
          server.middlewares.use((req, res, next) => {
            if (req.url && (req.url.startsWith('/api') || req.originalUrl?.startsWith('/api'))) {
              return apiApp(req, res, next);
            }
            next();
          });
        } catch (err) {
          console.warn('[Vite Preview API Middleware] Could not load server/api.js:', err.message);
        }
      }
    }
  ],
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  preview: {
    port: 3000,
    host: '0.0.0.0'
  }
});
