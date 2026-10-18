import { defineConfig } from 'vite';
import { apiApp } from './server/api.js';

export default defineConfig({
  plugins: [
    {
      name: 'rtm-api-server',
      configureServer(server) {
        server.middlewares.use('/api', (req, res, next) => {
          apiApp(req, res, next);
        });
      }
    }
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true
  },
  preview: {
    port: 3000,
    host: '0.0.0.0'
  }
});
