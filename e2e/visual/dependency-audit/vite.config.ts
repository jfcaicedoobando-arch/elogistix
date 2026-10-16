import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const noBackend = here("./no-backend.ts");
export default defineConfig({
  root: here("./"), publicDir: false,
  envDir: here("./empty-env"), envPrefix: "AUDIT_FIXTURE_PUBLIC_",
  plugins: [react(), {
    name: "dependency-audit-isolation", enforce: "pre",
    resolveId(source, importer) {
      if (source === "./queryErrorReporting" && importer?.replaceAll("\\", "/").endsWith("/query/queryClient.ts")) return noBackend;
    },
    generateBundle() {
      const forbidden = /(?:\/src\/(?:main|App)\.tsx|\/src\/integrations\/supabase\/client\.|\/node_modules\/(?:@supabase|@sentry)\/)/;
      const leaked = [...this.getModuleIds()].filter(id => forbidden.test(id));
      if (leaked.length) this.error(`Forbidden demo dependencies: ${leaked.join(", ")}`);
    },
  }],
  resolve: { alias: [
    { find: /^@\/lib\/auth\/sessionCacheRegistry$/, replacement: noBackend },
    { find: /^@\/lib\/browserStorage$/, replacement: noBackend },
    { find: /^@\/features\/catalogos\/services$/, replacement: noBackend },
    { find: "@", replacement: here("../../../src") },
  ] },
  css: { postcss: { plugins: [] } },
  build: { outDir: here("../../../test-results/dependency-audit-demo"), emptyOutDir: true, sourcemap: false },
  preview: { host: "127.0.0.1", port: 8099, strictPort: true },
});
