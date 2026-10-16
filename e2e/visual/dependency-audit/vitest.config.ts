import config from "../../../vitest.config.ts";
import { fileURLToPath } from "node:url";

// Reuse the repository's projects/setup/aliases without loading application .env.
const envDir = fileURLToPath(new URL("./empty-env", import.meta.url));
export default {
  ...config, envDir,
  test: { ...config.test, projects: config.test.projects.map(project => ({ ...project, envDir })) },
};
