import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const backend = here("./backend.ts");
const correo = here("./correo-backend.ts");
const xml = here("./xml-backend.ts");

// Standalone fixture: no app config, real environment, public assets or bootstrap.
export default defineConfig({
  root: here("./"), publicDir: false,
  envDir: here("./empty-env"), envPrefix: "DEFERRED_FIXTURE_PUBLIC_",
  plugins: [react(), {
    name: "deferred-erp-no-app-or-backend",
    generateBundle() {
      const forbidden = /(?:\/src\/(?:main|App)\.tsx|\/src\/integrations\/supabase\/client\.|\/src\/lib\/bootstrap\/|\/src\/lib\/query\/persistBootstrap\.|\/node_modules\/(?:@supabase|@sentry)\/)/;
      const leaked = [...this.getModuleIds()].filter(id => forbidden.test(id.replace(/\\/g, "/")));
      if (leaked.length) this.error(`Forbidden fixture dependencies: ${leaked.join(", ")}`);
    },
  }],
  resolve: { alias: [
    { find: /^@\/integrations\/supabase\/client$/, replacement: backend },
    { find: /^@\/(?:lib\/)?contexts\/OrganizationContext$/, replacement: correo },
    { find: /^@\/features\/catalogos\/services$/, replacement: correo },
    { find: /^@\/features\/costeo\/services\/(?:rutas|tarifas)$/, replacement: correo },
    { find: /^@\/features\/cxp\/services(?:\/parseCfdi)?$/, replacement: xml },
    { find: /^@\/features\/cxp\/hooks\/useNotasCreditoProveedor$/, replacement: xml },
    { find: /^@\/features\/catalogos\/services\/tipoCambioDof$/, replacement: xml },
    { find: /^@\/hooks\/shared(?:\/(?:useOrgFilter|useOrgActiva))?$/, replacement: backend },
    { find: /^@\/lib\/observability\/reportCaughtError$/, replacement: backend },
    { find: "@", replacement: here("../../../src") },
  ] },
  css: { postcss: here("../") },
  build: { outDir: here("../../../test-results/deferred-erp-fixture"), emptyOutDir: true, sourcemap: false },
  server: { host: "127.0.0.1", port: 8097, strictPort: true, hmr: false },
  preview: { host: "127.0.0.1", port: 8097, strictPort: true },
});
