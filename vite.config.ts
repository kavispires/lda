import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import svgr from 'vite-plugin-svgr';
import checker from 'vite-plugin-checker';

export default defineConfig({
  base: '/lda/',
  plugins: [
    react(),
    commonjs(),
    svgr({
      include: [
        'src/**/*.svg',
      ],
    }),
    checker({
      typescript: process.env.NODE_ENV !== 'production' ? {
        tsconfigPath: 'tsconfig.json',
        buildMode: false,
      } : false,
    }),
  ],
  server: {
    open: true, // automatically open the app in the browser
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      screens: path.resolve(__dirname, './src/screens'),
      'styles': path.resolve(__dirname, 'src/styles'),
    },
  },
  build: {
    outDir: 'build',
  },
});
