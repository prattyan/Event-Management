import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      minify: 'esbuild',
      target: 'es2020',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Split node_modules into separate vendor chunks
            if (id.includes('node_modules')) {
              // Large specific libraries get their own chunks
              if (id.includes('framer-motion')) return 'vendor-motion';
              if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
              if (id.includes('html5-qrcode')) return 'vendor-qr';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('socket.io')) return 'vendor-socket';
              if (id.includes('html2canvas')) return 'vendor-canvas';
              // Other smaller modules go into a common vendor chunk
              return 'vendor-common';
            }
          }
        }
      }
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:5005',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.MONGODB_API_KEY': JSON.stringify(env.MONGODB_API_KEY),
      'process.env.MONGODB_ENDPOINT': JSON.stringify(env.MONGODB_ENDPOINT),
      'process.env.MONGODB_DATA_SOURCE': JSON.stringify(env.MONGODB_DATA_SOURCE),
      'process.env.MONGODB_DB_NAME': JSON.stringify(env.MONGODB_DB_NAME),
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY),
      'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN),
      'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID),
      'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET),
      'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID),
      'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
