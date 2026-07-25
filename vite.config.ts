import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { APP_VERSION } from "./src/constants/appVersion";
import { reactCompilerPlugin } from "./vite-plugins/reactCompilerPlugin";

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
      console.log("[verify-html-bundle] OK — index.html contiene bundle JS.");
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // F3 (13.65.0): si build prod sin SENTRY_AUTH_TOKEN, log warning para que
  // operaciones detecte que los sourcemaps NO se subirán a Sentry (los stack
  // traces de prod quedarán minificados). No rompemos el build — forks/CI
  // ajenos deben poder compilar sin el token.
  if (mode === "production" && !process.env.SENTRY_AUTH_TOKEN) {
    console.warn(
      "[sentry] SENTRY_AUTH_TOKEN ausente: sourcemaps NO se subirán a Sentry. " +
      "Los stack traces de producción quedarán minificados. " +
      "Configura el token en Workspace Settings → Build Secrets.",
    );
  }
  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    // Fase 3 — React Compiler en modo `annotation` (opt-in por archivo con
    // `"use memo"`). Ver vite-plugins/reactCompilerPlugin.ts.
    reactCompilerPlugin(),
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
      // Empata con `release` runtime en src/lib/observability/sentry/core.ts.
      release: { name: `libre-carga@${APP_VERSION}` },
      sourcemaps: {
        // Borrar .map del dist tras subirlos: nunca queremos servir sourcemaps
        // al cliente en producción (filtración de código fuente).
        filesToDeleteAfterUpload: ["./dist/**/*.map"],
      },
    }) : null,
    mode === "production" && verifyHtmlBundlePlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 'hidden' genera .map sin agregar // sourceMappingURL en los .js, así los
    // browsers no los descargan aunque queden en dist. El plugin de Sentry los
    // sube y luego los borra (filesToDeleteAfterUpload).
    sourcemap: mode === "production" ? "hidden" : true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: mode === "production",
      },
    },
    // Bajar de 500 → 350 kB fuerza disciplina de split. Si un chunk supera
    // este umbral, Vite emite warning en build (no rompe el CI, pero queda
    // visible en logs y en el bundle-size gate del workflow).
    chunkSizeWarningLimit: 350,
    // NOTA: se eliminó `rollupOptions.output.manualChunks` por completo.
    // Agrupar paquetes con imports circulares internos (recharts, @react-pdf,
    // sentry, etc.) en chunks vendor monolíticos rompe el orden de
    // inicialización en producción con `Cannot access 'n' before
    // initialization`. Dejamos que Vite/Rollup genere chunks por ruta
    // (lazy-loaded en routes.tsx) — el costo de bundle inicial es aceptable
    // y la app deja de quedarse en pantalla en blanco.
    //
    // P17 · Higiene: fusionar automáticamente chunks minúsculos (<10 kB) para
    // reducir cascadas de requests HTTP en rutas con muchos micro-imports.
    // No cambia el grafo; solo consolida hojas pequeñas.
    rollupOptions: {
      output: {
        experimentalMinChunkSize: 10_000,
      },
    },
  },
  };
});


