import { describe, it, expect } from "vitest";
import {
  PORTAL_EMBARQUE_LIST_COLUMNS,
  PORTAL_EMBARQUE_DETAIL_COLUMNS,
  PORTAL_EVENTO_COLUMNS,
  PORTAL_DOCUMENTO_COLUMNS,
  PORTAL_COTIZACION_LIST_COLUMNS,
  PORTAL_FACTURA_LIST_COLUMNS,
} from "../columns";

function cols(s: string): string[] {
  return s.split(",").map((c) => c.trim());
}

describe("Portal column constants", () => {
  it("PORTAL_EMBARQUE_LIST_COLUMNS contiene campos básicos requeridos por la UI", () => {
    const list = cols(PORTAL_EMBARQUE_LIST_COLUMNS);
    expect(list).toEqual(expect.arrayContaining([
      "id", "expediente", "cliente_nombre", "estado", "modo", "tipo", "etd", "eta",
    ]));
  });

  it("PORTAL_EMBARQUE_DETAIL_COLUMNS es superset del listado", () => {
    const list = new Set(cols(PORTAL_EMBARQUE_LIST_COLUMNS));
    const detail = new Set(cols(PORTAL_EMBARQUE_DETAIL_COLUMNS));
    for (const c of list) {
      // peso/volumen sólo aparecen en detail; el resto del list debe estar en detail
      if (["created_at"].includes(c)) continue;
      expect(detail.has(c)).toBe(true);
    }
  });

  // v13.301.90 (Fase Q.1): `deleted_at`/`deleted_by` YA NO se exponen al portal;
  // las queries filtran por `deleted_at IS NULL` para ocultar borrados al cliente.
  it("PORTAL_EVENTO_COLUMNS NO expone deleted_at ni deleted_by (Fase Q.1)", () => {
    const c = cols(PORTAL_EVENTO_COLUMNS);
    expect(c).not.toContain("deleted_at");
    expect(c).not.toContain("deleted_by");
  });

  it("PORTAL_DOCUMENTO_COLUMNS NO expone deleted_at ni deleted_by (Fase Q.1)", () => {
    const c = cols(PORTAL_DOCUMENTO_COLUMNS);
    expect(c).not.toContain("deleted_at");
    expect(c).not.toContain("deleted_by");
  });

  it("PORTAL_COTIZACION_LIST_COLUMNS incluye embarque_id para resolver expediente", () => {
    expect(cols(PORTAL_COTIZACION_LIST_COLUMNS)).toContain("embarque_id");
  });

  it("PORTAL_FACTURA_LIST_COLUMNS incluye totales y vencimiento", () => {
    expect(cols(PORTAL_FACTURA_LIST_COLUMNS)).toEqual(
      expect.arrayContaining(["total", "moneda", "fecha_emision", "fecha_vencimiento", "estado"]),
    );
  });
});
