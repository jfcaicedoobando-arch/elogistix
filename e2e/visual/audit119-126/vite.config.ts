import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const noBackend = here("./no-backend.ts");

// Independent build: never imports the app's Vite config, .env files or public/.
export default defineConfig({
  root: here("./"), publicDir: false,
  envDir: here("./empty-env"), envPrefix: "AUDIT_FIXTURE_PUBLIC_",
  plugins: [react(), {
    name: "audit-fixture-no-app-or-backend",
    generateBundle() {
      const forbidden = /(?:\/src\/(?:main|App)\.tsx|\/src\/integrations\/supabase\/client\.|\/node_modules\/(?:@supabase|@sentry)\/)/;
      const leaked = [...this.getModuleIds()].filter(id => forbidden.test(id));
      if (leaked.length) this.error(`Forbidden fixture dependencies: ${leaked.join(", ")}`);
    },
  }],
  resolve: { alias: [
    { find: /^@\/integrations\/supabase\/client$/, replacement: noBackend },
    { find: /^@\/features\/facturacion\/hooks$/, replacement: noBackend },
    { find: /^@\/features\/facturacion\/hooks\/useConsultarRep$/, replacement: noBackend },
    { find: /^@\/features\/facturacion\/components\/FacturaDownloadButton$/, replacement: noBackend },
    { find: "@", replacement: here("../../../src") },
  ] },
  css: { postcss: here("../") },
  build: {
    outDir: here("../../../test-results/audit119-126-fixture"),
    emptyOutDir: true, sourcemap: false,
  },
  server: { host: "127.0.0.1", port: 8096, strictPort: true, hmr: false },
  preview: { host: "127.0.0.1", port: 8096, strictPort: true },
});
