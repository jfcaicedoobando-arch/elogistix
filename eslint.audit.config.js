import base from "./eslint.config.js";
export default [...base, { files:["**/*.{ts,tsx}"], rules:{"react-hooks/exhaustive-deps":"error"} }];
