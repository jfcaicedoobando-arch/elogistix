import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

// Separate entry: no App, authentication, Supabase, Sentry or real ERP records.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  css: { postcss: fileURLToPath(new URL("./e2e/visual", import.meta.url)) },
  server: { host: "127.0.0.1", port: 8087, strictPort: true },
});
