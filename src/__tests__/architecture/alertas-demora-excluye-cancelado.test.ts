/**
 * Regresión R220 — un expediente Cancelado no puede contarse como demora.
 *
 * El CASE de `estado_real` derivaba el estado por ETD/ETA cuando el estado
 * guardado no era uno de los avanzados: un Cancelado con ETA vencida terminaba
 * como 'Arribo' y entraba a las alertas de demora (ELIMP00353). El filtro
 * `NOT IN ('Cancelado')` corría DESPUÉS de la derivación, así que no ayudaba.
 *
 * Este guardrail exige que:
 *  - las funciones de alerta (`embarques_alertas_ids`, `sidebar_alert_counts`)
 *    excluyan Cancelado/Borrador en la rama de demora, y
 *  - las funciones con `estado_real` materializado preserven 'Cancelado'.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";

function migracionesConcatenadas(): string {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(`${DIR}/${f}`, "utf8"))
    .join("\n");
}

describe("alertas de demora: Cancelado nunca deriva a Arribo", () => {
  const sql = migracionesConcatenadas();

  it("las funciones de alerta excluyen Cancelado y Borrador", () => {
    const guards = sql.match(
      /AND e\.estado::text NOT IN \('Cancelado','Borrador'\)/g,
    );
    // Una por función de alerta: sidebar_alert_counts y embarques_alertas_ids.
    expect(guards?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("estado_real preserva Cancelado antes de derivar por ETD/ETA", () => {
    expect(sql).toContain("WHEN e.estado::text = ''Cancelado'' THEN ''Cancelado''");
  });
});
