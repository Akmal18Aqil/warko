import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { STORE_PROFILE, STORE_TITLE } from "./src/lib/storeProfile";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  preview: {
    host: true,
    port: 5173,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: STORE_TITLE,
        short_name: STORE_PROFILE.brand.split(" ")[0].toUpperCase(),
        description:
          `POS, layar dapur, dan self-order QR ${STORE_PROFILE.outlet}.`,
        lang: "id",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#f3f6fa",
        theme_color: "#f3f6fa",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "wakro-foto-menu",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
