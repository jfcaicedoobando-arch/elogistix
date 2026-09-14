/**
 * C30 (v13.823.381) — `mergeFacturasVinculadas`.
 *
 * En una fusión de VARIAS proformas la factura nace con `proforma_id = NULL`,
 * así que la FK inversa no la trae: el vínculo vive en la proforma
 * (`factura_id` / `factura_secundaria_id`). El helper mezcla ambos caminos sin
 * duplicar y descartando las facturas en papelera.
 */
import { describe, it, expect } from "vitest";
import { mergeFacturasVinculadas } from "../queries.helpers";

const f = (id: string, extra: Record<string, unknown> = {}) => ({
  id, estado: "Emitida", uuid_fiscal: null, deleted_at: null, ...extra,
});

describe("mergeFacturasVinculadas", () => {
  it("una sola proforma: conserva la factura de la FK inversa", () => {
    const r = mergeFacturasVinculadas({ facturas_asociadas: [f("A")] });
    expect(r.facturas_asociadas.map((x) => x.id)).toEqual(["A"]);
  });

  it("fusión con factura única: toma la vinculada aunque la FK inversa venga vacía", () => {
    const r = mergeFacturasVinculadas({ facturas_asociadas: [], factura_vinculada: f("A") });
    expect(r.facturas_asociadas.map((x) => x.id)).toEqual(["A"]);
  });

  it("fusión MXN + USD: devuelve las dos facturas", () => {
    const r = mergeFacturasVinculadas({
      factura_vinculada: f("MXN"),
      factura_vinculada_secundaria: f("USD"),
    });
    expect(r.facturas_asociadas.map((x) => x.id)).toEqual(["MXN", "USD"]);
  });

  it("no duplica cuando la misma factura llega por los dos caminos", () => {
    const r = mergeFacturasVinculadas({
      facturas_asociadas: [f("A")],
      factura_vinculada: f("A"),
    });
    expect(r.facturas_asociadas).toHaveLength(1);
  });

  it("descarta facturas en papelera de cualquiera de los dos caminos", () => {
    const r = mergeFacturasVinculadas({
      facturas_asociadas: [f("A", { deleted_at: "2026-01-01" })],
      factura_vinculada: f("B", { deleted_at: "2026-01-02" }),
      factura_vinculada_secundaria: null,
    });
    expect(r.facturas_asociadas).toEqual([]);
  });
});
