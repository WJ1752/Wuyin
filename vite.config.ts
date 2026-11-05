import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  cacheDir: '.cache/vite',
  // Large esbuild transforms use native temporary files, which managed Windows
  // workspaces can forbid deleting. Terser keeps the local browser build in memory.
  build: process.platform === 'win32' ? { target: 'esnext', minify: 'terser' } : {},
  server: {
    proxy: { '/api': process.env.DEV_API_TARGET ?? 'http://127.0.0.1:3001' },
  },
  optimizeDeps: {
    esbuildOptions: {
      // Let the Node host write cache files: native esbuild writes can be denied
      // by Windows managed-workspace permissions even when Node can write them.
      plugins: [
        {
          name: 'host-cache-writer',
          setup(build) {
            if (!build.initialOptions.outdir) return;
            build.initialOptions.write = false;
            build.onEnd(async (result) => {
              if (result.errors.length) return;
              await Promise.all(
                (result.outputFiles ?? []).map(async (file) => {
                  await mkdir(dirname(file.path), { recursive: true });
                  await writeFile(file.path, file.contents);
                }),
              );
            });
          },
        },
      ],
    },
  },
});
