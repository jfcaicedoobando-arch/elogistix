/**
 * Baseline de violaciones arquitectónicas.
 *
 * Complementa `architecture.test.ts` (que sólo cubre lib/ y services/) con
 * un control NO-REGRESSION sobre `src/hooks/**` y `src/contexts/**`:
 * éstos no deberían importar `@/integrations/supabase/client` directamente
 * (Pages → Hooks → **Services** → Lib).
 *
 * Como hay deuda histórica, este test no falla por las violaciones
 * existentes — falla SÓLO si aparece una violación nueva o si una de las
 * conocidas cambia de archivo. Esto evita que la deuda crezca mientras se
 * planifica la migración (ver `mem://audit/pendings`).
 *
 * Cuando un archivo del baseline se limpie:
 *   1. Quitarlo de `BASELINE`.
 *   2. El test seguirá pasando.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { runArchAudit } from "../../../scripts/lib/arch";

const ROOT = process.cwd();
const DIRECT_CLIENT_IMPORT = /from\s+["']@\/integrations\/supabase\/client["']/;

const BASELINE: ReadonlySet<string> = new Set<string>([
  // 11.59.0 — Baseline VACÍO. Toda la deuda histórica migrada a services/.
  // Mantener el set vacío hace que cualquier nuevo import directo desde
  // hooks/ o contexts/ falle la CI de inmediato.
]);


function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

function findCurrentViolators(roots: string[]): Set<string> {
  const violators = new Set<string>();
  for (const root of roots) {
    for (const f of walk(join(ROOT, root))) {
      const src = readFileSync(f, "utf8");
      if (DIRECT_CLIENT_IMPORT.test(src)) {
        violators.add(relative(ROOT, f).split("\\").join("/"));
      }
    }
  }
  return violators;
}

describe("Arquitectura — baseline de imports directos a supabase/client", () => {
  const current = findCurrentViolators(["src/hooks", "src/contexts"]);

  it("hooks/ y contexts/ no introducen NUEVOS imports directos al cliente Supabase", () => {
    const nuevos = [...current].filter((f) => !BASELINE.has(f)).sort();
    expect(
      nuevos,
      `Aparecieron nuevos archivos importando supabase/client. Mover la consulta a services/<dominio>:\n${nuevos.join(
        "\n",
      )}`,
    ).toEqual([]);
  });

  it("components/ y pages/ jamás importan supabase/client directamente", () => {
    const v = [...findCurrentViolators(["src/components", "src/pages"])].sort();
    expect(
      v,
      `components/ y pages/ deben ir vía hooks/ + services/. Violaciones:\n${v.join("\n")}`,
    ).toEqual([]);
  });

  it("entradas obsoletas del baseline deben removerse", () => {
    const stale = [...BASELINE].filter((f) => !current.has(f)).sort();
    expect(
      stale,
      `Estos archivos ya no violan la regla. Quítalos de BASELINE en este archivo:\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  // D14 — Guardrail explícito de tamaño de archivo (Power of 10 #1).
  // Falla la CI si CUALQUIER archivo productivo en src/ supera las 200 líneas.
  // Cubre la regresión silenciosa que el reporte de audit-report.ts sólo informaba.
  it("Power of 10: 0 archivos productivos en src/ con > 200 líneas", () => {
    const { oversized } = runArchAudit(ROOT);
    const detalle = oversized
      .map((o) => `  - ${o.path} (${o.lines} líneas)`)
      .join("\n");
    expect(
      oversized,
      `Hay archivos productivos > 200 líneas. Divídelos antes de mergear:\n${detalle}`,
    ).toEqual([]);
  });
});
