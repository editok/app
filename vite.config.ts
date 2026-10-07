import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('react-joyride')) return 'joyride';
          if (id.includes('@supabase/supabase-js')) return 'supabase';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('@capacitor')) return 'capacitor';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
});
