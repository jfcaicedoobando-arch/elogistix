/**
 * v13.823.358 (Addendum P1): regresión estática de la fuente canónica de
 * `actualizar_cotizacion_costos`. La base de costos sólo se reemplaza en
 * Borrador/Solicitada y sin embarque vinculado; antes cualquier estado pasaba.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/schema/cotizaciones/actualizar_cotizacion_costos.sql"),
  "utf8",
);

describe("actualizar_cotizacion_costos (SQL canónico)", () => {
  it("rechaza estados fuera de captura y cotizaciones con embarque", () => {
    expect(sql).toContain("LC_COT_COSTOS_ESTADO_INVALIDO");
    expect(sql).toContain("LC_COT_COSTOS_CON_EMBARQUE");
    expect(sql).toContain(
      "v_estado NOT IN ('Borrador'::estado_cotizacion, 'Solicitada'::estado_cotizacion)",
    );
    expect(sql).toContain("IF v_embarque_id IS NOT NULL THEN");
  });

  it("evalúa el candado antes del replay de idempotencia y del borrado", () => {
    const estado = sql.indexOf("LC_COT_COSTOS_ESTADO_INVALIDO");
    const idem = sql.indexOf("idempotency_claim");
    const del = sql.indexOf("DELETE FROM cotizacion_costos");
    const autoridad = sql.indexOf("_assert_writer_cotizacion");
    expect(autoridad).toBeLessThan(estado);
    expect(estado).toBeLessThan(idem);
    expect(estado).toBeLessThan(del);
  });

  it("conserva el candado optimista y los permisos del contrato", () => {
    expect(sql).toContain("LC_CONFLICTO_CONCURRENCIA");
    expect(sql).toContain("FROM PUBLIC, anon;");
    expect(sql).toContain("TO authenticated, service_role;");
  });
});
