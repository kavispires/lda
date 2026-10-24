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
    'audition-panel',
    'episode-preparation',
    'season-setup',
    'change-history',
    'audition-live',
    'audition-audience',
    'audition-secrets',
    'audition-episode',
    'battle-episode',
    'battle-validation',
    'battle-judging',
    'narrative-battle-validation',
    'narrative-audition',
    'narrative-battle',
  ]) {
    await server.ssrLoadModule(`/src/pages/TheSearch/engine/${name}.test.ts`);
  }
  await server.ssrLoadModule('/src/pages/TheSearch/utilities/episode-visibility.test.ts');
  await server.ssrLoadModule('/src/pages/TheSearch/utilities/episode-rundown.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/utilities/contestant-profile.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/EpisodeNarrative.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/BattleEpisodeView.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/ContestantDetailModal.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/NarrativeEpisodeView.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/NarrativeBattlePlayer.test.tsx');
} finally {
  await server.close();
}
