/**
 * Fase 2 #1 — El dominio puro de bandejas no puede importar React, Supabase,
 * ni el cliente HTTP. Garantiza que `src/features/bandejas/domain/` siga
 * siendo testable sin levantar UI/red.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { sync as glob } from "fast-glob";

const ROOT = process.cwd();
const FILES = glob("src/features/bandejas/domain/**/*.ts", {
  cwd: ROOT,
  absolute: true,
  ignore: ["**/__tests__/**", "**/*.test.ts"],
});

const FORBIDDEN = [
  /from\s+["']react["']/,
  /from\s+["']@\/integrations\/supabase/,
  /from\s+["']@tanstack\/react-query["']/,
  /from\s+["']sonner["']/,
];

describe("Fase 2 #1 — bandejas/domain es puro", () => {
  it("no importa React, Supabase, react-query ni toasts", () => {
    const offenders: string[] = [];
    for (const abs of FILES) {
      const src = readFileSync(abs, "utf8");
      for (const re of FORBIDDEN) {
        if (re.test(src)) offenders.push(`${abs.slice(ROOT.length + 1)} viola ${re}`);
      }
    }
    expect(offenders, `Dominio impuro:\n${offenders.join("\n")}`).toEqual([]);
  });
});
