import { describe, expect, it } from "vitest";
import { fechaIso, prepararImportacion } from "../importarTarifas";

const cat = {
  puertos: [{ id: "p1", name: "Shanghai", code: "CNSHA" }, { id: "p2", name: "Manzanillo", code: "MXZLO" }],
  agentes: [{ id: "a1", nombre: "Cloverstar" }],
  navieras: [{ id: "n1", name: "OOCL", code: "OOCL" }],
  tipos: [{ id: "t20", code: "20GP" }, { id: "t40gp", code: "40GP" }, { id: "t40", code: "40HC" }],
  rutas: [{ id: "r1", puerto_origen_id: "p1", puerto_destino_id: "p2" }],
};
const fila = { Origen: "CNSHA", Destino: "Manzanillo", Agente: "cloverstar", Naviera: "OOCL", 'Tarifa 20" (USD)': "1200", 'Tarifa 40" (USD)': "1500", "Inicio de la vigencia": "01/10/2026", "Término de la vigencia": "15/10/2026", "Días libres de demoras": "14", Observaciones: "" };

describe("prepararImportacion", () => {
  it("un renglón con 20 y 40 genera dos tarifas en la ruta existente", () => {
    const r = prepararImportacion([fila], cat);
    expect(r.errores).toEqual([]);
    expect(r.tarifas.map((t) => [t.input.tipo_contenedor_id, t.input.flete_base, t.input.ruta_id])).toEqual([["t20", 1200, "r1"], ["t40", 1500, "r1"]]);
    expect(r.tarifas[0].input.vigente_desde).toBe("2026-10-01");
  });
  it("rechaza agente inexistente y fechas invertidas", () => {
    const r = prepararImportacion([{ ...fila, Agente: "X", "Término de la vigencia": "01/09/2026" }], cat);
    expect(r.tarifas).toEqual([]);
    expect(r.errores[0]).toMatch(/Fila 2: .*agente.*anterior/);
  });
  it("ruta nueva queda sin ruta_id para crearse", () => {
    const r = prepararImportacion([{ ...fila, Origen: "Manzanillo", Destino: "Shanghai" }], cat);
    expect(r.tarifas[0].input.ruta_id).toBe("");
  });
  it("fechaIso acepta ISO y Date", () => {
    expect(fechaIso("2026-1-5")).toBe("2026-01-05");
    expect(fechaIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
