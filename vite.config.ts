import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";

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
          if (/node_modules\/recharts/.test(id)) {
            return "charts-vendor";
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
