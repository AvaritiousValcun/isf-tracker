import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function expressServerPlugin(): Plugin {
  return {
    name: 'express-server-plugin',
    apply: 'serve',
    async configureServer(server) {
      const { createServer } = await import('./server/index');
      const app = createServer();
      server.middlewares.use(app);
    },
  };
}

export default defineConfig({
  plugins: [react(), expressServerPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
    },
  },
  server: {
    port: 8080,
  },
});
