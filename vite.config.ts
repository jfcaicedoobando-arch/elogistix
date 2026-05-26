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
    // Excluir chunks pesados que SÓLO se cargan vía import() dinámico
    // (pdf, sentry, charts, phone, query-persist) del modulepreload del
    // entry. Sin esto, Vite genera <link rel="modulepreload"> que fuerza
    // ~700 KB de descargas innecesarias en /login y rutas iniciales.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (dep) =>
            !/(pdf-vendor|sentry-vendor|charts-vendor|phone-vendor|query-persist-vendor)-[\w-]+\.js$/.test(
              dep,
            ),
        ),
    },
    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: mode === "production",
      },
    },

    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Aislar @react-pdf/renderer + toda su dependencia transitiva
          // (fontkit, yoga-layout, pako, brotli, @noble/ciphers, etc.) en un
          // chunk separado para que sólo se cargue al descargar un PDF.
          if (
            /node_modules\/(@react-pdf|fontkit|yoga-layout|restructure|brotli|pako|jay-peg|unicode-properties|unicode-trie|dfa|tiny-inflate|hyphen|media-engine|@noble\/ciphers|js-md5)/.test(
              id,
            )
          ) {
            return "pdf-vendor";
          }
          // Sentry: cargado dinámicamente desde main.tsx en requestIdleCallback.
          if (/node_modules\/@sentry/.test(id)) {
            return "sentry-vendor";
          }
          // React Query persister: cargado dinámicamente en main.tsx.
          if (
            /node_modules\/@tanstack\/(react-query-persist-client|query-sync-storage-persister|query-persist-client-core)/.test(
              id,
            )
          ) {
            return "query-persist-vendor";
          }
          if (/node_modules\/(react|react-dom|react-router-dom|@remix-run)/.test(id)) {
            return "react-vendor";
          }
          if (/node_modules\/@tanstack\/react-query/.test(id)) {
            return "query-vendor";
          }
          // NOTA: recharts NO se agrupa manualmente. Tiene imports
          // circulares internos que rompen con "Cannot access 'n' before
          // initialization" cuando se separa en un chunk vendor compartido.
          // Dejamos que Vite/Rollup lo coloque en los chunks de las rutas
          // que lo usan (Reportes, Operaciones, AdminDashboard, Auditoria),
          // evitando además que se cargue en /login.
          // libphonenumber-js (~30 KB gzip) sólo lo necesitan 3 rutas
          // (Clientes, ClienteDetalle, ProveedorDetalle) vía formatPhoneMx.
          if (/node_modules\/libphonenumber-js/.test(id)) {
            return "phone-vendor";
          }
          if (/node_modules\/lucide-react/.test(id)) {
            return "icons-vendor";
          }
          if (/node_modules\/(react-hook-form|@hookform|zod)/.test(id)) {
            return "forms-vendor";
          }
          if (/node_modules\/(date-fns|clsx|tailwind-merge|class-variance-authority)/.test(id)) {
            return "utils-vendor";
          }
          if (/node_modules\/(cmdk|sonner)/.test(id)) {
            return "ui-vendor";
          }
          if (/node_modules\/@radix-ui/.test(id)) {
            return "radix-vendor";
          }
          return undefined;
        },
      },
    },
  },
}));
