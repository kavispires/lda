import { after, describe } from 'node:test';
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

describe('The Search', async () => {
  after(() => server.close());
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
    'bootcamp-scoring',
    'bootcamp-integration',
    'mega-groups-episode',
    'photoshoot-episode',
  ]) {
    await server.ssrLoadModule(`/src/pages/TheSearch/engine/${name}.test.ts`);
  }
  await server.ssrLoadModule('/src/pages/TheSearch/engine/bootcamp-episode.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/activity-awards.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/mega-groups-integration.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/photoshoot-integration.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/track-specials-episode.test.ts');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/track-specials-integration.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/versatility-episode.test.ts');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/versatility-integration.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/variety-show-episode.test.ts');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/variety-show-integration.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/music-video-episode.test.ts');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/music-video-integration.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/specialties-episode.test.ts');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/specialties-integration.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/finale-episode.test.ts');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/finale-integration.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/engine/episode-auto-complete.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/utilities/episode-visibility.test.ts');
  await server.ssrLoadModule('/src/pages/TheSearch/utilities/episode-rundown.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/utilities/show-rundown.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/utilities/bootcamp-rundown.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/utilities/contestant-profile.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/EpisodeNarrative.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/BattleEpisodeView.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/ContestantDetailModal.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/NarrativeEpisodeView.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/NarrativeBattlePlayer.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/LaterEpisodeViews.test.tsx');
  await server.ssrLoadModule('/src/pages/TheSearch/components/RelationshipUpdates.test.tsx');
});
