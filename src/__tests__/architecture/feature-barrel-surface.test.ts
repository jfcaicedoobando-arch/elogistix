/**
 * O4 (auditoría 2026-07-29) — Superficie pública de features CON barrel raíz.
 *
 * ARCHITECTURE.md exige barrel `index.ts` por feature como superficie
 * pública. Mientras el burn-down avanza, este test enforcea la regla SOLO
 * en los features que ya tienen barrel raíz (`BARRELED_FEATURES`): desde
 * fuera del feature solo se permite importar:
 *   · el barrel raíz            `@/features/<f>`
 *   · barrels de subcapa        `@/features/<f>/(services|hooks|domain|types|queryKeys)`
 *   · rutas lazy                `@/features/<f>/routes/...`
 *     (las rutas lazy de `src/routes/` son la superficie de navegación).
 * Cualquier otro deep import (`/services/<modulo>`, `/components/...`,
 * `/utils/...`, `/constants/...`) es violación, salvo baseline abajo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = process.cwd();

/** Features con barrel raíz enforceado por este test. */
const BARRELED_FEATURES = ["tesoreria", "proformas"] as const;

/** Subcapas permitidas como barrel (1 segmento). */
const ALLOWED_SUBLAYER = /^(services|hooks|domain|types|queryKeys)$/;

/**
 * Baseline de deep imports externos ya existentes (burn-down, mismo
 * criterio que CROSS_FEATURE_ALLOWLIST de eslint.config.js). Cada entrada
 * debe salir migrando al barrel o promoviendo el símbolo. NO agregar
 * entradas nuevas sin PR justificado.
 *
 * Nota: verificado contra HEAD (2026-07-29); difiere ligeramente del
 * inventario original de la auditoría (el consumidor de
 * `tesoreria/services/conciliacion` es hoy `cxp/hooks/useConciliacionPagoCellController.ts`,
 * no `cxp/components/ConciliacionPagoCell.tsx`) y suma un quinto caso en
 * `src/services/__tests__/idempotency.integration.test.ts`.
 */
const BASELINE: Record<string, string[]> = {
  "src/features/cxp/hooks/useConciliacionPagoCellController.ts": [
    "@/features/tesoreria/services/conciliacion",
  ],
  "src/features/embarques/services/submitProformaDialog.ts": [
    "@/features/proformas/domain/proforma",
  ],
  "src/features/facturacion/components/TabProformas.tsx": [
    "@/features/proformas/hooks/useConvertirProformaDirecto",
  ],
  "src/pdf/documents/ProformaHeader.tsx": [
    "@/features/proformas/domain/proformaDetalleHelpers",
  ],
  "src/services/__tests__/idempotency.integration.test.ts": [
    "@/features/proformas/services/consolidar",
  ],
};

describe("O4 — deep imports en features con barrel", () => {
  it("ningún deep import nuevo fuera de la baseline", () => {
    const offenders: string[] = [];
    const importRe = /from\s+["'](@\/features\/[a-z-]+\/[^"']+)["']/g;
    for (const file of walk(join(ROOT, "src"))) {
      const rel = relPath(ROOT, file);
      if (rel.endsWith("feature-barrel-surface.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(importRe)) {
        const spec = m[1];
        const parts = spec.split("/"); // ["@", "features", "<f>", ...rest]
        const feature = parts[2] as (typeof BARRELED_FEATURES)[number];
        if (!BARRELED_FEATURES.includes(feature)) continue;
        if (rel.startsWith(`src/features/${feature}/`)) continue; // intra-feature
        const rest = parts.slice(3);
        if (rest.length === 0) continue;                          // barrel raíz
        if (rest.length === 1 && ALLOWED_SUBLAYER.test(rest[0])) continue;
        if (rest[0] === "routes") continue;                       // superficie lazy
        if ((BASELINE[rel] ?? []).includes(spec)) continue;       // burn-down
        offenders.push(`${rel} -> ${spec}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
