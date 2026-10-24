import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const server = await createServer({
  configFile: false,
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
  logLevel: 'error',
});

try {
  for (const name of [
    'audition-scoring',
    'season-setup',
    'change-history',
    'audition-live',
    'audition-audience',
    'audition-secrets',
    'audition-episode',
  ]) {
    await server.ssrLoadModule(`/src/pages/TheSearch/engine/${name}.test.ts`);
  }
  await server.ssrLoadModule('/src/pages/TheSearch/utilities/episode-visibility.test.ts');
  await server.ssrLoadModule('/src/pages/TheSearch/components/EpisodeNarrative.test.tsx');
} finally {
  await server.close();
}
