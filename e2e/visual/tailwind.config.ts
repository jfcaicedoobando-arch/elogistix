import config from "../../tailwind.config.ts";

export default { ...config, content: [...config.content, "./e2e/visual/**/*.tsx"] };
