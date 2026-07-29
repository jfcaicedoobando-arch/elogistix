/**
 * M2 (auditoría de arquitectura 2026-07-29): métrica de adopción de zod en
 * `fromDb`. Cuenta, sobre código productivo de `src/`:
 *  - `sinSchema`: `fromDb<T>(...)` — cast crudo, sin validación runtime.
 *  - `conSchema`: `fromDb(data, schema)` / `fromDbChecked(data, schema)`.
 *
 * Se consume desde `scripts/audit-report.ts` (informativo) y desde el ratchet
 * `src/__tests__/architecture/fromdb-zod-adoption.test.ts` (bloqueante).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface FromDbAdoption {
  total: number;
  conSchema: number;
  sinSchema: number;
  ratio: number;
  porFeature: Record<string, number>;
}

const EXCLUDED = /(^|\/)(node_modules|__tests__|integrations)(\/|$)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (EXCLUDED.test(full.replace(/\\/g, "/"))) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Agrupa por feature (`src/features/<x>/…`) o por el primer segmento bajo `src/`. */
function featureOf(rel: string): string {
  const m = rel.match(/^src\/features\/([^/]+)\//);
  if (m) return m[1];
  return rel.split("/")[1] ?? "src";
}

export function scanFromDbAdoption(root: string): FromDbAdoption {
  const srcDir = join(root, "src");
  const porFeature: Record<string, number> = {};
  let sinSchema = 0;
  let conSchema = 0;

  for (const file of walk(srcDir)) {
    const rel = relative(root, file).replace(/\\/g, "/");
    // La definición del helper vive en cast.ts: no es un call site.
    if (rel === "src/lib/supabase/cast.ts") continue;
    const src = readFileSync(file, "utf8");

    const crudos = src.match(/\bfromDb</g)?.length ?? 0;
    const validados = src.match(/\bfromDbChecked</g)?.length ?? 0;
    // `fromDb(data, schema)` (sin genérico explícito) también cuenta como validado.
    const conSchemaInline = src.match(/\bfromDb\(\s*[^)]*,\s*\w/g)?.length ?? 0;

    sinSchema += crudos;
    conSchema += validados + conSchemaInline;
    if (crudos > 0) porFeature[featureOf(rel)] = (porFeature[featureOf(rel)] ?? 0) + crudos;
  }

  const total = sinSchema + conSchema;
  return {
    total,
    conSchema,
    sinSchema,
    ratio: total === 0 ? 1 : Number((conSchema / total).toFixed(3)),
    porFeature,
  };
}
