/**
 * Auditoría 2026-08-18, punto 6 — `src/lib/domain` sólo para dominio cross-cutting.
 *
 * Criterio: un módulo vive en `src/lib/domain` sólo si lo consumen DOS O MÁS
 * features (o código compartido: `src/components`, `src/hooks`, `src/services`,
 * `src/pdf`, `src/lib`). Si sólo lo usa un feature, pertenece a
 * `src/features/<feature>/domain/`.
 *
 * Analogía: `lib/domain` es la bodega común del edificio; lo que sólo usa un
 * departamento se guarda dentro de ese departamento.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = process.cwd();
const DOMAIN_DIR = join(ROOT, "src/lib/domain");

/** Módulos sin consumidores externos: los usa otro módulo de `lib/domain`. */
const SOLO_USO_INTERNO = new Set([
  "bitacoraDescripcion.types",
  "bitacoraDescripcionModulos",
  "bitacoraGrupos",
  "entranteListo",
  "facturasEntrantesArchivos",
  "validationFormat",
]);

function modulos(): string[] {
  return readdirSync(DOMAIN_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .map((f) => f.replace(/\.ts$/, ""));
}

describe("punto 6 — alcance de src/lib/domain", () => {
  it("cada módulo de lib/domain lo consumen ≥2 features o código compartido", () => {
    const consumidores = new Map<string, Set<string>>();
    for (const m of modulos()) consumidores.set(m, new Set());

    for (const file of walk(join(ROOT, "src"))) {
      const rel = relPath(ROOT, file);
      if (rel.startsWith("src/lib/domain/")) continue;
      if (rel.includes("__tests__")) continue;
      const text = readFileSync(file, "utf8");
      const feature = /^src\/features\/([A-Za-z-]+)\//.exec(rel)?.[1] ?? "shared";
      for (const m of consumidores.keys()) {
        if (new RegExp(`@/lib/domain/${m}["'/]`).test(text)) {
          consumidores.get(m)!.add(feature);
        }
      }
    }

    const offenders: string[] = [];
    for (const [m, feats] of consumidores) {
      if (SOLO_USO_INTERNO.has(m)) continue;
      if (feats.size === 0) {
        offenders.push(`${m}: sin consumidores (¿código muerto?)`);
        continue;
      }
      if (feats.size === 1 && !feats.has("shared")) {
        offenders.push(
          `${m}: sólo lo usa features/${[...feats][0]} → muévelo a src/features/${[...feats][0]}/domain/`,
        );
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
