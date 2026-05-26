/**
 * Audita la jerarquía Pages → Hooks → Services → Lib.
 *
 * Reporta (no falla por sí solo — gating en CI vía
 * `src/lib/__tests__/architecture.test.ts`):
 *  1. Archivos bajo `src/hooks/**` o `src/contexts/**` que importan
 *     `@/integrations/supabase/client` directamente (deberían pasar por
 *     `src/services/`).
 *  2. Archivos bajo `src/components/**` o `src/pages/**` con la misma
 *     violación.
 *  3. Archivos `.ts(x)` productivos con más de `MAX_LINES` líneas
 *     (excluye __tests__ y excepciones documentadas).
 *
 * Uso:  bun scripts/audit-architecture.ts
 *       bun run audit:arch
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const MAX_LINES = 200;
const DIRECT_CLIENT_IMPORT = /from\s+["']@\/integrations\/supabase\/client["']/;

/** Archivos exentos del límite de líneas (shadcn base, catálogos planos). */
const SIZE_EXEMPT = new Set<string>([
  "src/components/ui/sidebar.tsx",
  "src/lib/query/index.ts",
  "src/integrations/supabase/types.ts",
]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, acc);
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

function rel(p: string): string {
  return relative(ROOT, p).split("\\").join("/");
}

function findDirectClientImports(roots: string[]): string[] {
  const out: string[] = [];
  for (const root of roots) {
    for (const f of walk(join(ROOT, root))) {
      const src = readFileSync(f, "utf8");
      if (DIRECT_CLIENT_IMPORT.test(src)) out.push(rel(f));
    }
  }
  return out.sort();
}

function findOversized(): { file: string; lines: number }[] {
  const out: { file: string; lines: number }[] = [];
  for (const f of walk(join(ROOT, "src"))) {
    const r = rel(f);
    if (SIZE_EXEMPT.has(r)) continue;
    const lines = readFileSync(f, "utf8").split("\n").length;
    if (lines > MAX_LINES) out.push({ file: r, lines });
  }
  return out.sort((a, b) => b.lines - a.lines);
}

function header(title: string) {
  console.log(`\n${"=".repeat(64)}\n${title}\n${"=".repeat(64)}`);
}

const hooksContexts = findDirectClientImports(["src/hooks", "src/contexts"]);
const compsPages = findDirectClientImports(["src/components", "src/pages"]);
const oversized = findOversized();

header("Hooks/Contexts con import directo a @/integrations/supabase/client");
if (hooksContexts.length === 0) console.log("✅ Ninguno");
else hooksContexts.forEach((f) => console.log(`  • ${f}`));

header("Components/Pages con import directo a @/integrations/supabase/client");
if (compsPages.length === 0) console.log("✅ Ninguno");
else compsPages.forEach((f) => console.log(`  • ${f}`));

header(`Archivos productivos > ${MAX_LINES} líneas (Power-of-10 #4)`);
if (oversized.length === 0) console.log("✅ Ninguno");
else oversized.forEach(({ file, lines }) => console.log(`  • ${lines.toString().padStart(4)}  ${file}`));

console.log(
  `\nResumen: hooks/contexts=${hooksContexts.length}  components/pages=${compsPages.length}  oversized=${oversized.length}\n`,
);
