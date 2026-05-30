import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Lets the page keep a handle on popups it opens (window.closed / popup.location),
// even when the popup navigates to a COOP:same-origin page like accounts.google.com.
// Required for the Google OAuth popup login used by the sync plugin.
const COOP_HEADERS = { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' };

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    headers: COOP_HEADERS,
  },
  preview: {
    headers: COOP_HEADERS,
  },
});
