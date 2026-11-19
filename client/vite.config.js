import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Хөгжүүлэлтийн үед Vite (5173) ба Express (3000) тусдаа ажиллана.
// Proxy нь /api, /socket.io хүсэлтийг Express рүү дамжуулж, хөтөчид нэг домэйн мэт харагдуулна.
// Ингэснээр production-ийн монолиттой адил cookie, CORS-гүй орчинд хөгжүүлнэ.
export default defineConfig({
  plugins: [react()],
  build: {
    // Жижиг фонтыг data: URI болгон CSS-д шигтгэхгүй: Content-Security-Policy нь font-src 'self' (server/src/app.js)
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
