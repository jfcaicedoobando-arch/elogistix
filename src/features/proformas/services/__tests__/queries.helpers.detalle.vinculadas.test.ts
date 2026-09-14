/**
 * D6 (v13.823.382) — `mergeProformaDetalle` con facturas vinculadas.
 *
 * En una fusión N→1 la factura nace con `proforma_id = NULL`, así que el
 * detalle `/proformas/:id` perdía el PDF/XML (sobre todo el segundo documento
 * en USD). El detalle debe mezclar la FK inversa con `factura_id` y
 * `factura_secundaria_id`, sin borradas ni duplicados.
 */
import { describe, it, expect } from "vitest";
import { mergeProformaDetalle } from "../queries.helpers";

const doc = (id: string, moneda: string, extra: Record<string, unknown> = {}) => ({
  id,
  numero: `F-${id}`,
  estado: "Emitida",
  total: 100,
  moneda,
  fecha_emision: "2026-01-10",
  uuid_fiscal: `uuid-${id}`,
  factura_pdf_url: `https://pdf/${id}`,
  factura_xml_url: `https://xml/${id}`,
  deleted_at: null,
  created_at: "2026-01-10T00:00:00Z",
  ...extra,
});

describe("mergeProformaDetalle · facturas vinculadas (D6)", () => {
  it("factura única en USD: la trae aunque la FK inversa venga vacía", () => {
    const r = mergeProformaDetalle({
      id: "p1",
      facturas_asociadas: [],
      factura_vinculada: doc("USD1", "USD"),
      factura_vinculada_secundaria: null,
    });
    expect(r.facturas_asociadas.map((f) => f.id)).toEqual(["USD1"]);
    expect(r.facturas_asociadas[0].factura_pdf_url).toBe("https://pdf/USD1");
  });

  it("fusión MXN + USD: ambos documentos quedan visibles", () => {
    const r = mergeProformaDetalle({
      id: "p1",
      facturas_asociadas: [],
      factura_vinculada: doc("MXN1", "MXN"),
      factura_vinculada_secundaria: doc("USD1", "USD", { created_at: "2026-01-11T00:00:00Z" }),
    });
    expect(r.facturas_asociadas.map((f) => f.id)).toEqual(["MXN1", "USD1"]);
    expect(r.facturas_asociadas.map((f) => f.factura_xml_url)).toEqual([
      "https://xml/MXN1",
      "https://xml/USD1",
    ]);
  });

  it("el detalle no duplica la factura cuando llega por FK inversa y por factura_id", () => {
    const r = mergeProformaDetalle({
      id: "p1",
      facturas_asociadas: [doc("A", "MXN")],
      factura_vinculada: doc("A", "MXN"),
    });
    expect(r.facturas_asociadas).toHaveLength(1);
  });

  it("descarta la factura en papelera", () => {
    const r = mergeProformaDetalle({
      id: "p1",
      facturas_asociadas: [],
      factura_vinculada: doc("BORRADA", "MXN", { deleted_at: "2026-02-01T00:00:00Z" }),
    });
    expect(r.facturas_asociadas).toEqual([]);
  });

  it("las columnas auxiliares no se filtran al detalle", () => {
    const r = mergeProformaDetalle({
      id: "p1",
      facturas_asociadas: [],
      factura_vinculada: doc("A", "MXN"),
    });
    expect(r.facturas_asociadas[0]).not.toHaveProperty("deleted_at");
    expect(r.facturas_asociadas[0]).not.toHaveProperty("created_at");
  });
});
