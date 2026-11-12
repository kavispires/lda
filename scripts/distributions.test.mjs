import { after, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile, rm } from 'node:fs/promises';
import react from '@vitejs/plugin-react';
import lodash from 'lodash';
import reactUse from 'react-use';
import { createServer } from 'vite';

// Node cannot infer these CommonJS named exports; bridge the real packages for SSR.
const commonJsModules = {
  lodash: { entry: 'lodash/lodash.js', exports: Object.keys(lodash) },
  'react-use': { entry: 'react-use/lib/index.js', exports: Object.keys(reactUse) },
};

const cacheDir = fileURLToPath(new URL(`../node_modules/.vite-distributions-tests-${process.pid}`, import.meta.url));
const server = await createServer({
  cacheDir,
  configFile: false,
  plugins: [
    react(),
    {
      name: 'distribution-test-interop',
      enforce: 'pre',
      resolveId(id) {
        if (id === '@services/firebase') return '\0distribution-test-firebase';
        if (id === 'firebase/firestore') return '\0formation-test-firestore';
        if (id === 'virtual:formation-test-firestore') return '\0formation-test-firestore';
        if (id.startsWith('virtual:distribution-test-')) return id.replace('virtual:', '\0');
      },
      transform(code, id) {
        if (!id.includes('/src/')) return;
        return code.replace(/from (['"])firebase\/firestore\1/g, "from 'virtual:formation-test-firestore'").replace(
          /from (['"])(lodash|react-use)\1/g,
          (_, quote, name) => `from ${quote}virtual:distribution-test-${name}${quote}`,
        );
      },
      async load(id) {
        if (id === '\0formation-test-firestore') {
          return readFile(new URL('./formation-test-firestore.mjs', import.meta.url), 'utf8');
        }
        for (const [name, module] of Object.entries(commonJsModules)) {
          if (id === `\0distribution-test-${name}`) {
            return `import value from '${module.entry}';
              export default value;
              export const { ${module.exports.join(', ')} } = value;`;
          }
        }
        if (id === '\0distribution-test-firebase') {
          return `
            const unavailable = () => { throw new Error('Firebase is unavailable in distribution tests'); };
            export const firestore = {};
            export const getDocQueryFunction = unavailable;
            export const updateDocQueryFunction = unavailable;
            export const deleteDocQueryFunction = unavailable;
          `;
        }
      },
    },
  ],
  resolve: {
    tsconfigPaths: true,
    alias: { styles: fileURLToPath(new URL('../src/styles', import.meta.url)) },
  },
  ssr: { noExternal: ['firebase/firestore'] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
  logLevel: 'error',
});

describe('Distributions', async () => {
  after(async () => {
    try {
      await server.close();
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
  try {
    await server.ssrLoadModule('/src/pages/Distributions/distribution-timeline.test.tsx');
    await server.ssrLoadModule('/src/components/Log/LogPart.test.tsx');
    await server.ssrLoadModule('/src/services/inline-adlibs.test.tsx');
    await server.ssrLoadModule('/src/utils/formation.test.tsx');
  } catch (error) {
    process.exitCode = 1;
    throw error;
  }
});
