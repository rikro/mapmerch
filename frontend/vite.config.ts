import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Resolve bare .js imports to .tsx/.ts when the .js file doesn't exist.
// This handles ESM-style import paths (e.g. './App.js') in TypeScript source.
function resolveJsToTs(): import('vite').Plugin {
  return {
    name: 'resolve-js-to-ts',
    resolveId(id, importer) {
      if (!id.endsWith('.js') || !importer) return;
      const base = resolve(importer, '..', id.slice(0, -3));
      for (const ext of ['.tsx', '.ts']) {
        if (existsSync(base + ext)) return base + ext;
      }
    },
  };
}

export default defineConfig({
  plugins: [resolveJsToTs(), react(), tailwindcss()],
  server: {
    port: 5173,
  },
});
