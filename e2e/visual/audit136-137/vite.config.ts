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
    { find: /^@\/lib\/ui\/appFeedback$/, replacement: noBackend },
    { find: /^@\/hooks\/shared$/, replacement: here("../../../src/hooks/shared/useIsMobile.ts") },
    { find: "@", replacement: here("../../../src") },
  ] },
  css: { postcss: here("../") },
  build: {
    outDir: here("../../../test-results/audit136-137-fixture"),
    emptyOutDir: true, sourcemap: false,
  },
  server: { host: "127.0.0.1", port: 8097, strictPort: true, hmr: false },
  preview: { host: "127.0.0.1", port: 8097, strictPort: true },
});
