import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    // Proxy the evaluation API to the local Bun dev server (`bun run dev:api`).
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
