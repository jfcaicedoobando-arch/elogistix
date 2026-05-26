import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";

/**
 * Verifica que `dist/index.html` contenga el bundle JS antes de terminar el
 * build. Evita publicaciones con HTML vacío (pantalla en blanco en prod).
 */
function verifyHtmlBundlePlugin(): Plugin {
  return {
    name: "verify-html-bundle",
    apply: "build",
    closeBundle() {
      const htmlPath = path.resolve(__dirname, "dist/index.html");
      if (!fs.existsSync(htmlPath)) {
        throw new Error(
          "[verify-html-bundle] dist/index.html no existe. Build inválido.",
        );
      }
      const html = fs.readFileSync(htmlPath, "utf-8");
      const scriptRegex = /<script[^>]+src=["'][^"']*\/assets\/[^"']+\.js["'][^>]*>/i;
      const hasRootDiv = /<div\s+id=["']root["']\s*>/i.test(html);
      const hasScript = scriptRegex.test(html);
      if (!hasRootDiv || !hasScript) {
        throw new Error(
          "[verify-html-bundle] dist/index.html no contiene <div id=root> o <script src=/assets/*.js>. Publicación abortada para evitar pantalla en blanco.",
        );
      }
      // eslint-disable-next-line no-console
      console.log("[verify-html-bundle] OK — index.html contiene bundle JS.");
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    process.env.ANALYZE === "true" && visualizer({
      filename: "dist/bundle-stats.html",
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
    mode === "production" && process.env.SENTRY_AUTH_TOKEN ? sentryVitePlugin({
      org: "elogistix",
      project: "javascript-react",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }) : null,
    mode === "production" && verifyHtmlBundlePlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: mode === "production",
      },
    },
    // NOTA: se eliminó `rollupOptions.output.manualChunks` por completo.
    // Agrupar paquetes con imports circulares internos (recharts, @react-pdf,
    // sentry, etc.) en chunks vendor monolíticos rompe el orden de
    // inicialización en producción con `Cannot access 'n' before
    // initialization`. Dejamos que Vite/Rollup genere chunks por ruta
    // (lazy-loaded en routes.tsx) — el costo de bundle inicial es aceptable
    // y la app deja de quedarse en pantalla en blanco.
  },
}));
