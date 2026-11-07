import { after } from 'node:test';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
  logLevel: 'error',
});

after(() => server.close());
await server.ssrLoadModule('/src/pages/Distributions/distribution-timeline.test.tsx');
