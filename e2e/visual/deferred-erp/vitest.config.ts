import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import base from "../../../vitest.config";

// Run the existing suites/config with their mocks, without loading real .env.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const noBackend = { find: /^@\/integrations\/supabase\/client$/, replacement: here("./unit-no-backend.ts") };
export default defineConfig({
  ...base,
  root: here("../../../"),
  envDir: here("./empty-env"), envPrefix: "DEFERRED_FIXTURE_PUBLIC_",
  test: {
    ...base.test,
    projects: base.test!.projects!.map(project => {
      if (typeof project !== "object" || !("test" in project)) throw new Error("Expected inline unit projects");
      const aliases = project.resolve?.alias;
      if (!Array.isArray(aliases)) throw new Error("Expected explicit unit aliases");
      return { ...project, resolve: { ...project.resolve, alias: [noBackend, ...aliases] }, envDir: here("./empty-env"), envPrefix: "DEFERRED_FIXTURE_PUBLIC_", test: {
        ...project.test, setupFiles: [...(project.test?.setupFiles as string[] ?? []), here("./unit-network-guard.ts")],
      } };
    }),
  },
});
