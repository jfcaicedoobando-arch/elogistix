import config from "../../tailwind.config.ts";

// v4 resolves content paths relative to this config rather than process.cwd().
export default { ...config, content: [
  ...config.content.map(path => `../../${path.replace(/^\.\//, "")}`),
  "./**/*.tsx",
] };
