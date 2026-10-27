import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({
      configPath:
        process.env.FOREST_PRODUCTION === '1'
          ? 'deployment/wrangler.jsonc'
          : 'wrangler.jsonc',
    }),
  ],
  server: { host: '127.0.0.1' },
});
