import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Architectural guardrails — prevent drift back into oversized files
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true }],
      "complexity": ["warn", { max: 15 }],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],
    },
  },
  {
    // Exemptions: generated types, UI primitives (shadcn), data catalogs, and tests
    files: [
      "src/components/ui/**",
      "src/integrations/supabase/**",
      "src/data/changelogData.ts",
      "src/data/ports.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "complexity": "off",
    },
  },
);
