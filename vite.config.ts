import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import svgr from 'vite-plugin-svgr';
import vitetsConfigPaths from 'vite-tsconfig-paths';
import checker from 'vite-plugin-checker';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/lda/',
  plugins: [
    react(),
    vitetsConfigPaths(),
    commonjs(),
    tailwindcss(),
    svgr({
      include: [
        'src/**/*.svg',
      ],
    }),
    checker({
      typescript: {
        tsconfigPath: 'tsconfig.json', // adjust if needed
        buildMode: false,
      },
    }),
  ],
  server: {
    open: true, // automatically open the app in the browser
    port: 3000,
  },
  resolve: {
    alias: {
      screens: path.resolve(__dirname, './src/screens'),
      'styles': path.resolve(__dirname, 'src/styles'),
    },
  },
  build: {
    outDir: 'build',
  },
});
