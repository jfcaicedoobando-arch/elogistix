/** v13.628.0 — Reglas de edición de conceptos en facturas de proveedor. */
import { describe, expect, it } from "vitest";
import { evaluarEdicionConceptos } from "../conceptosEditables";

const BASE = {
  uuid_fiscal: null,
  archivo_xml_url: null,
  estado: "Vigente",
  pagado: 0,
};

describe("evaluarEdicionConceptos", () => {
  it("permite editar una factura manual, viva y sin pagos", () => {
    expect(evaluarEdicionConceptos(BASE)).toEqual({ puede: true, motivo: null });
  });

  it("bloquea cuando el desglose vino de un CFDI", () => {
    expect(evaluarEdicionConceptos({ ...BASE, uuid_fiscal: "uuid" }).puede).toBe(false);
    expect(evaluarEdicionConceptos({ ...BASE, archivo_xml_url: "x.xml" }).motivo)
      .toContain("XML");
  });

  it("bloquea facturas canceladas y con pagos", () => {
    expect(evaluarEdicionConceptos({ ...BASE, estado: "Cancelada" }).puede).toBe(false);
    expect(evaluarEdicionConceptos({ ...BASE, pagado: 100 }).motivo).toContain("pagos");
  });
});
