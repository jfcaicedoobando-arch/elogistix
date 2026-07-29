/**
 * Guardrail v13.303.14: al eliminar (soft) un embarque huérfano de fiscales, la
 * última definición de `eliminar_embarque_completo` debe limpiar los FKs
 * bidireccionales con la cotización (además de revertir su estado). Sin esto,
 * `cotizaciones.embarque_id` sigue apuntando al embarque fantasma y la UI
 * bloquea la re-conversión.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

function findLatestBody(): string {
  const files = readdirSync(MIGRATIONS_DIR).sort();
  let latest = "";
  for (const f of files) {
    const body = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
    if (/FUNCTION\s+public\.eliminar_embarque_completo\b/i.test(body)) {
      latest = body;
    }
  }
  return latest;
}

/**
 * Índice de la ÚLTIMA definición (no del COMMENT ON FUNCTION, que también
 * menciona el nombre y dejaba el slice vacío).
 */
function lastDefIndex(body: string): number {
  let idx = -1;
  for (const m of body.matchAll(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.eliminar_embarque_completo\b/gi,
  )) {
    idx = m.index ?? idx;
  }
  return idx;
}

describe("eliminar_embarque_completo limpia vínculo con cotización", () => {
  const body = findLatestBody();
  const idx = lastDefIndex(body);
  const slice = body.slice(idx);

  it("nulifica cotizaciones.embarque_id cuando no quedan embarques vivos", () => {
    expect(slice).toMatch(
      /UPDATE\s+public\.cotizaciones[\s\S]{0,200}SET[\s\S]{0,200}embarque_id\s*=\s*NULL/i,
    );
  });

  it("nulifica embarques.cotizacion_id del embarque borrado", () => {
    expect(slice).toMatch(
      /UPDATE\s+public\.embarques[\s\S]{0,200}SET[\s\S]{0,200}cotizacion_id\s*=\s*NULL/i,
    );
  });
});
