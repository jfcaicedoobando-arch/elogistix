import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here("./"), publicDir: false,
  envDir: here("./empty-env"), envPrefix: "CXP_FIXTURE_PUBLIC_",
  plugins: [react(), {
    name: "cxp-fixture-no-app-or-backend",
    generateBundle() {
      const forbidden = /(?:\/src\/(?:main|App)\.tsx|\/src\/integrations\/supabase\/|\/node_modules\/(?:@supabase|@sentry)\/)/;
      const leaked = [...this.getModuleIds()].filter(id => forbidden.test(id.replaceAll("\\", "/")));
      if (leaked.length) this.error(`Forbidden fixture dependencies: ${leaked.join(", ")}`);
    },
  }],
  resolve: { alias: [
    { find: /^@\/features\/(?:proveedor|presupuesto)\/hooks$/, replacement: here("./no-backend.ts") },
    { find: /^@\/hooks\/shared$/, replacement: here("./no-backend.ts") },
    { find: "@", replacement: here("../../../src") },
  ] },
  css: { postcss: here("../") },
  build: { outDir: here("../../../test-results/cxp-filters-fixture"), emptyOutDir: true, sourcemap: false },
  preview: { host: "127.0.0.1", port: 8103, strictPort: true },
});
