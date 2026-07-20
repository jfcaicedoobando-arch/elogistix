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

describe("eliminar_embarque_completo limpia vínculo con cotización", () => {
  const body = findLatestBody();
  const idx = body.lastIndexOf("eliminar_embarque_completo");
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
