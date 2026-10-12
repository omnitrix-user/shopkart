import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend's CORS allow-list contains http://localhost:5173, so the dev server
// must not silently move to another port.
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: 'localhost',
    port: 4173,
    strictPort: true,
  },
});
