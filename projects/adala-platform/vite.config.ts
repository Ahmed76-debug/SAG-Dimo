import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => ({
  /* وضع desktop: بناء بالمسارات النسبية لنسخة سطح المكتب (Electron) */
  base: mode === "desktop" ? "./" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5180,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5181',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    outDir: mode === "desktop" ? "dist-desktop" : "dist",
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](jspdf|html2canvas|dompurify|fflate|canvg)/.test(id)) {
            return "pdf";
          }
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)/.test(id)) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
}));
