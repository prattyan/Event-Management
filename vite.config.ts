import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.MONGODB_API_KEY': JSON.stringify(env.MONGODB_API_KEY),
      'process.env.MONGODB_ENDPOINT': JSON.stringify(env.MONGODB_ENDPOINT),
      'process.env.MONGODB_DATA_SOURCE': JSON.stringify(env.MONGODB_DATA_SOURCE),
      'process.env.MONGODB_DB_NAME': JSON.stringify(env.MONGODB_DB_NAME)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
