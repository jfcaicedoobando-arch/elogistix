import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { readAppVersion } from "./scripts/lib/readAppVersion";
import { verificarHtmlBundle, type SalidaBundle } from "./scripts/lib/verifyHtmlBundle";

/**
 * Verifica que el `index.html` emitido por ESTA compilación contenga el bundle
 * JS. Se usa `writeBundle` con el `OutputBundle` en memoria (no se lee `dist/`),
 * así un build limpio no falla por timing ni aprueba un `dist` obsoleto.
 */
function verifyHtmlBundlePlugin(): Plugin {
  return {
    name: "verify-html-bundle",
    apply: "build",
    writeBundle(_options, bundle) {
      verificarHtmlBundle(bundle as unknown as Record<string, SalidaBundle>);
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
    // RTC-02 · el plugin del React Compiler (modo annotation, Fase 3) se
    // retiró: tras TC-03 hay 0 archivos con "use memo" y el plugin cargaba
    // Babel en cada build sin compilar nada. La guardia estática vive en
    // eslint-plugin-react-compiler (regla warn, eslint.config.js).
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
      release: { name: `libre-carga@${readAppVersion(__dirname)}` },
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
    // TC-02: 'hidden' + terser en ~291 chunks requiere >4 GB de RAM. En
    // entornos con poca memoria usar `BUILD_SOURCEMAPS=false` (script
    // `build:low-mem`): el bundle queda idéntico pero sin .map ni upload a
    // Sentry. Default sin cambios para CI/producción.
    sourcemap:
      mode === "production"
        ? (process.env.BUILD_SOURCEMAPS === "false" ? false : "hidden")
        : true,
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
    // TC-04 · Excepción conocida: `react-pdf.browser-*.js` (~1.3 MB sin
    // comprimir) SIEMPRE supera este umbral. Es esperado: @react-pdf/renderer
    // es intrínsecamente grande, sólo se carga lazy (dynamic imports) y el
    // gate real por chunk es scripts/check-bundle-size.sh en CI (budget gzip
    // 500 KB para react-pdf*). NO "arreglar" subiendo este límite ni
    // reintroduciendo manualChunks (ver NOTA abajo: rompe producción).
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


