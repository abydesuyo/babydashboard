import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: false, // Disabled auto-open - manually open dist/stats.html when needed
      gzipSize: true,
      brotliSize: true,
    })
  ],
  base: '/', // <-- Cloudflare Pages expects root
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
    proxy: {
      '/api': 'http://localhost:8788'
    }
  },
  build: {
    // Enable source maps for better debugging
    sourcemap: false,
    // Optimize chunk size
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress eval warning from gapi-script (Google's official library)
        if (
          warning.code === 'EVAL' &&
          warning.id?.includes('node_modules/gapi-script')
        ) {
          return;
        }
        warn(warning);
      },
      // Exclude server-only dependencies from frontend bundle
      external: ['mongodb', 'realm-web'],
      output: {
        manualChunks: {
          // Split vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'charts': ['recharts'],
          'google-apis': ['gapi-script', '@react-oauth/google']
        }
      }
    }
  }
})
