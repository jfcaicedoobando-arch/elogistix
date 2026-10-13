import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const forbidden = /(?:\/src\/(?:main|App)\.tsx|\/src\/(?:integrations|services)\/|\/src\/hooks\/shared\/index\.|\/node_modules\/(?:@supabase|@sentry)\/)/;

// Standalone compiled fixture: no app config, env files, public assets or backend.
export default defineConfig({
  root: here("./"), publicDir: false, envDir: false,
  plugins: [react(), {
    name: "virtualization-smoke-no-backend",
    generateBundle() {
      const leaked = [...this.getModuleIds()].filter(id => forbidden.test(id));
      if (leaked.length) this.error(`Forbidden fixture imports: ${leaked.join(", ")}`);
    },
  }],
  resolve: { alias: { "@": here("../../../src") } },
  css: { postcss: here("../") },
  build: {
    outDir: here("../../../test-results/virtualization-fixture"),
    emptyOutDir: true, sourcemap: false,
  },
  server: { host: "127.0.0.1", port: 8098, strictPort: true, hmr: false },
  preview: { host: "127.0.0.1", port: 8098, strictPort: true },
});
