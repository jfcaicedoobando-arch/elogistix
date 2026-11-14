import { describe, expect, it } from "vitest";
import { agruparEmpresas, type FilaBrokerEmpresa } from "../agruparEmpresas";

const fila = (o: Partial<FilaBrokerEmpresa>): FilaBrokerEmpresa => ({
  empresa_id: "e1", empresa: "ACME", estado_crm: "Prospecto", organizacion: "Org",
  oportunidad: null, etapa: null, etapa_tipo: null, actualizado: null, ...o,
});

describe("agruparEmpresas", () => {
  it("junta varias oportunidades de la misma empresa", () => {
    const r = agruparEmpresas([fila({ oportunidad: "A", etapa: "Negociación" }), fila({ oportunidad: "B", etapa: "Prospecto" })]);
    expect(r).toHaveLength(1);
    expect(r[0].oportunidades.map((o) => o.etapa)).toEqual(["Negociación", "Prospecto"]);
  });
  it("conserva empresas sin oportunidades", () => {
    expect(agruparEmpresas([fila({})])[0].oportunidades).toEqual([]);
  });
});
