import { describe, it, expect } from "vitest";
import { EMBARQUE_LIST_COLUMNS, EMBARQUE_DETAIL_COLUMNS } from "@/features/embarques/services/columns";

function parse(s: string): string[] {
  return s.split(",").map((c) => c.trim()).filter(Boolean);
}

describe("EMBARQUE_LIST_COLUMNS", () => {
  it("incluye campos críticos para listados", () => {
    const cols = parse(EMBARQUE_LIST_COLUMNS);
    for (const k of [
      "id", "expediente", "bl_master", "cliente_nombre", "modo", "estado", "etd", "eta",
      "operador", "tipo_cambio_usd", "tipo_cambio_eur", "tiene_proforma",
    ]) expect(cols).toContain(k);
  });
  it("no contiene columnas duplicadas", () => {
    const cols = parse(EMBARQUE_LIST_COLUMNS);
    expect(new Set(cols).size).toBe(cols.length);
  });
});

describe("EMBARQUE_DETAIL_COLUMNS", () => {
  it("es superset funcional del listado (campos clave)", () => {
    const list = parse(EMBARQUE_LIST_COLUMNS);
    const detail = parse(EMBARQUE_DETAIL_COLUMNS);
    for (const k of ["id", "expediente", "bl_master", "cliente_nombre", "modo", "estado", "etd", "eta", "operador"]) {
      expect(list).toContain(k);
      expect(detail).toContain(k);
    }
  });
  it("incluye campos extra de detalle (bl_house, organization_id, cotizacion_id)", () => {
    const cols = parse(EMBARQUE_DETAIL_COLUMNS);
    for (const k of ["bl_house", "mawb", "hawb", "organization_id", "cotizacion_id", "consignatario", "shipper"]) {
      expect(cols).toContain(k);
    }
  });
  it("no contiene columnas duplicadas", () => {
    const cols = parse(EMBARQUE_DETAIL_COLUMNS);
    expect(new Set(cols).size).toBe(cols.length);
  });
});
