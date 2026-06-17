/**
 * Fase 2 #3 — Las páginas no deben llamar `useQuery`/`useMutation` directamente.
 * Sólo `useQueryClient` (para invalidaciones puntuales) está permitido.
 * Cualquier query nueva debe vivir en un hook del feature correspondiente.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { sync as glob } from "fast-glob";
import { join } from "node:path";

const ROOT = process.cwd();
const PAGES = glob("src/pages/**/*.tsx", { cwd: ROOT, absolute: true });

const ALLOWLIST = new Set<string>([
  // Vacío: ya no quedan páginas con useQuery inline tras Fase 2.
]);

describe("Fase 2 #3 — Páginas sin useQuery/useMutation inline", () => {
  it("ninguna página importa useQuery o useMutation de @tanstack/react-query", () => {
    const offenders: string[] = [];
    for (const abs of PAGES) {
      if (!existsSync(abs)) continue;
      const rel = abs.slice(ROOT.length + 1);
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(abs, "utf8");
      const match = src.match(
        /from\s+["']@tanstack\/react-query["'][^;]*|import\s*\{([^}]*)\}\s*from\s*["']@tanstack\/react-query["']/,
      );
      if (!match) continue;
      const named = src.match(/import\s*\{([^}]+)\}\s*from\s*["']@tanstack\/react-query["']/);
      if (!named) continue;
      const imports = named[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim());
      const bad = imports.filter((i) => i === "useQuery" || i === "useMutation" || i === "useInfiniteQuery");
      if (bad.length > 0) offenders.push(`${rel}: ${bad.join(", ")}`);
    }
    expect(offenders, `Páginas con queries inline:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe(join("Fase 2 #2 — formatters centralizados"), () => {
  // Falla si vuelven a aparecer declaraciones locales de formatDate/formatCurrency/formatPercent/pctPnl/formatMoney
  // fuera de src/lib/formatters/.
  it("no hay declaraciones locales de formatters fuera de src/lib/formatters/", () => {
    const files = glob("src/**/*.{ts,tsx}", {
      cwd: ROOT,
      absolute: true,
      ignore: ["src/lib/formatters/**", "**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
    });
    const re = /(?:^|\n)\s*(?:export\s+)?(?:function|const)\s+(formatDate|formatCurrency|formatPercent|formatMoney|pctPnl)\b/;
    const offenders: string[] = [];
    for (const abs of files) {
      const src = readFileSync(abs, "utf8");
      const m = src.match(re);
      if (m) offenders.push(`${abs.slice(ROOT.length + 1)} → ${m[1]}`);
    }
    expect(offenders, `Formatters redeclarados:\n${offenders.join("\n")}`).toEqual([]);
  });
});
