/**
 * Guardrail Fase R.7 (Bug menor B): `eliminar_embarque_completo` debe bloquear
 * la eliminación cuando existen proformas en cualquier estado vivo, incluyendo
 * `borrador`. Antes sólo contaba `estado_proforma = 'pendiente'` con
 * `estado_aprobacion <> 'borrador'`.
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

describe("eliminar_embarque_completo bloquea proformas en borrador", () => {
  const body = findLatestBody();

  it("la última definición cuenta proformas NOT IN ('cancelada','facturada')", () => {
    const idx = lastDefIndex(body);
    const slice = body.slice(idx);
    expect(slice).toMatch(
      /estado_proforma[\s\S]{0,120}NOT\s+IN\s*\(\s*'cancelada'\s*,\s*'facturada'\s*\)/i,
    );
  });
});
