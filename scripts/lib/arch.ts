/**
 * Auditoría de capa: imports directos a `@/integrations/supabase/client` y
 * archivos productivos que superan el límite Power-of-10 de 200 líneas.
 *
 * Puro (sin side-effects). Consumido por `scripts/audit-architecture.ts` y
 * `scripts/audit-report.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walk, relPath } from "./walk";

export const MAX_LINES = 200;
export const DIRECT_CLIENT_IMPORT = /from\s+["']@\/integrations\/supabase\/client["']/;

/** Archivos exentos del límite de líneas (shadcn base, catálogos planos). */
export const SIZE_EXEMPT = new Set<string>([
  "src/components/ui/sidebar.tsx",
  "src/lib/query/index.ts",
  "src/integrations/supabase/types.ts",
]);

export interface OversizedFile {
  file: string;
  lines: number;
}

export function findDirectClientImports(
  root: string,
  roots: string[],
  extraExcludeDirs: string[] = [],
): string[] {
  const out: string[] = [];
  for (const r of roots) {
    for (const f of walk(join(root, r), {
      excludeDirs: ["__tests__", "node_modules", ...extraExcludeDirs],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      const src = readFileSync(f, "utf8");
      if (DIRECT_CLIENT_IMPORT.test(src)) out.push(relPath(root, f));
    }
  }
  return out.sort();
}

export function findOversized(root: string): OversizedFile[] {
  const out: OversizedFile[] = [];
  for (const f of walk(join(root, "src"), { excludeDirs: ["__tests__", "node_modules"], excludeFileRe: /\.(test|spec)\.tsx?$/ })) {
    const r = relPath(root, f);
    if (SIZE_EXEMPT.has(r)) continue;
    const lines = readFileSync(f, "utf8").split("\n").length;
    if (lines > MAX_LINES) out.push({ file: r, lines });
  }
  return out.sort((a, b) => b.lines - a.lines);
}

export interface ArchReport {
  hooksContextsDirectImports: string[];
  componentsPagesDirectImports: string[];
  oversized: OversizedFile[];
}

export function runArchAudit(root: string): ArchReport {
  return {
    hooksContextsDirectImports: findDirectClientImports(root, [
      "src/hooks",
      "src/lib/contexts",
    ]),
    // `src/features` alberga ~90% del código. Excluimos `services/` (capa
    // permitida para tocar el cliente Supabase) para que sólo afloren
    // violaciones reales en components/hooks/routes de features.
    componentsPagesDirectImports: findDirectClientImports(
      root,
      ["src/components", "src/features"],
      ["services"],
    ),
    oversized: findOversized(root),
  };
}
