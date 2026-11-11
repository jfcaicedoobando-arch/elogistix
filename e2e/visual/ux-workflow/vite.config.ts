import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const boundaries = here("./boundaries.tsx");
const hooks = here("./boundary-hooks.ts");

export default defineConfig({
  root: here("./"), publicDir: false,
  envDir: here("./empty-env"), envPrefix: "UX_FIXTURE_PUBLIC_",
  plugins: [react(), {
    name: "ux-workflow-no-backend",
    generateBundle() {
      const forbidden = /(?:\/src\/(?:main|App)\.tsx|\/src\/integrations\/supabase\/client\.|\/node_modules\/(?:@supabase|@sentry)\/|\/src\/features\/facturacion\/(?:hooks|services)\/)/;
      const leaked = [...this.getModuleIds()].filter(id => forbidden.test(id));
      if (leaked.length) this.error(`Forbidden fixture dependencies: ${leaked.join(", ")}`);
    },
  }],
  resolve: { alias: [
    { find: /^@\/integrations\/supabase\/client$/, replacement: here("./no-backend.ts") },
    { find: /^@\/features\/facturacion\/hooks$/, replacement: hooks },
    { find: /^.*\/hooks\/useFacturasMasivas$/, replacement: hooks },
    { find: /^@\/hooks\/shared$/, replacement: hooks },
    { find: /^@\/features\/facturacion\/components\/(?:DashboardEjecutivoFacturacion|FacturacionDialogs|bandejas\/FacturacionBandejasTabs)$/, replacement: boundaries },
    { find: /^\.\/facturacionColumns$/, replacement: hooks },
    { find: "@", replacement: here("../../../src") },
  ] },
  css: { postcss: here("../") },
  build: { outDir: here("../../../test-results/ux-workflow-fixture"), emptyOutDir: true, sourcemap: false },
  server: { host: "127.0.0.1", port: 8097, strictPort: true, hmr: false },
  preview: { host: "127.0.0.1", port: 8097, strictPort: true },
});
