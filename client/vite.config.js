import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Хөгжүүлэлтийн үед Vite (5173) ба Express (3000) тусдаа ажиллана.
// Proxy нь /api, /socket.io хүсэлтийг Express рүү дамжуулж, хөтөчид нэг домэйн мэт харагдуулна.
// Ингэснээр production-ийн монолиттой адил cookie, CORS-гүй орчинд хөгжүүлнэ.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
