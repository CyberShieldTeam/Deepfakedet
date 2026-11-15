import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        // Inference caches/environments and generated reports are not frontend source.
        // Watching these trees on Windows/OneDrive can starve module requests.
        ignored: ['**/.venv*/**', '**/.model-cache/**', '**/ai_service/models/**',
                  '**/reports/**', '**/data/**', '**/test-results/**', '**/playwright-report/**'],
      },
    },
  };
});
