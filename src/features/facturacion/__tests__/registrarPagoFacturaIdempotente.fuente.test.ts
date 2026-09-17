/**
 * MNY P1.2 — la idempotencia del cobro individual no debe permitir un "éxito
 * silencioso": la misma llave (`client_request_id`) con un payload distinto se
 * rechaza con LC_PAGO_REINTENTO_DISTINTO, y el reintento idéntico sigue
 * devolviendo el cobro existente sin duplicar.
 *
 * Contrato verificado sobre la fuente canónica (la ejecución SQL vive en
 * GitHub Actions).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fuente = readFileSync(
  resolve(process.cwd(), "supabase/schema/facturacion/registrar_pago_factura_atomico.sql"),
  "utf8",
);

describe("registrar_pago_factura_atomico · reintento con datos distintos", () => {
  it("compara el payload del reintento en los dos caminos de idempotencia", () => {
    const comparaciones = fuente.match(/_assert_pago_factura_mismo_payload\(/g) ?? [];
    // 1 definición + 2 usos (búsqueda por llave y rescate del unique_violation).
    expect(comparaciones.length).toBeGreaterThanOrEqual(3);
  });

  it("rechaza con un error claro que permite revisar el cobro previo", () => {
    expect(fuente).toContain("LC_PAGO_REINTENTO_DISTINTO");
    expect(fuente).toMatch(/no se guardó la edición ni se duplicó el cobro/);
  });

  it("compara factura, fecha, importe, moneda, T/C, aplicado, método y cuenta", () => {
    for (const campo of [
      "v_p.factura_id",
      "v_p.fecha_pago",
      "v_p.monto",
      "v_p.moneda::text",
      "v_p.tipo_cambio",
      "v_p.monto_aplicado_factura",
      "v_p.forma_pago",
      "v_p.cuenta_bancaria_id",
    ]) {
      expect(fuente).toContain(campo);
    }
  });

  it("conserva la idempotencia del reintento idéntico (devuelve el pago existente)", () => {
    expect(fuente).toContain("v_reintento := true");
    expect(fuente).toContain("WHERE client_request_id = p_client_request_id AND deleted_at IS NULL");
  });
});
