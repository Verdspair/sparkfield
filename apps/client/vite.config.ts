import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_ORIGIN = process.env.VITE_SERVER_ORIGIN ?? 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: SERVER_ORIGIN,
        changeOrigin: true,
      },
      '/matchmake': {
        target: SERVER_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules') && (id.includes('three') || id.includes('simplex-noise'))) {
            return 'vendor-three';
          }
          if (id.includes('node_modules') && (id.includes('react') || id.includes('scheduler'))) {
            return 'vendor-react';
          }
          if (
            id.includes('node_modules') &&
            (id.includes('dexie') || id.includes('colyseus') || id.includes('zod'))
          ) {
            return 'vendor-runtime';
          }
          if (id.includes('/src/stage/unitPack') || id.includes('/src/stage/unitBuilderCore')) {
            return 'stage-units';
          }
          if (
            id.includes('/src/stage/arenaBuilder') ||
            id.includes('/src/stage/lobbyStageBuilder') ||
            id.includes('/src/stage/tacticianMeshFactory')
          ) {
            return 'stage-arenas';
          }
          return undefined;
        },
      },
    },
  },
});
