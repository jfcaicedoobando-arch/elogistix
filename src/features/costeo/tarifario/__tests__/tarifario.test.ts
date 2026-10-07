import { describe, expect, it } from "vitest";
import { agruparTarifas, entraAlTarifario, type TarifaTarifario } from "../tarifarioService";
import { tarifasCoincidentes } from "../coincidencias";

const base = (o: Partial<TarifaTarifario>): TarifaTarifario => ({
  id: "t", flete_base: 1000, moneda: "USD", dias_libres_demoras: 14, vigente_desde: "2026-10-01",
  vigente_hasta: "2026-10-15", notas: null, solicitud_pricing_id: null,
  agente: { id: "a1", nombre: "Agente" }, naviera: { id: "n1", name: "MSC" }, tipo: { code: "20GP" },
  ruta: { origen: { name: "Shanghai" }, destino: { name: "Manzanillo" } }, ...o,
});

describe("tarifario", () => {
  it("una tarifa de solicitud entra sólo si dura más de 1 día", () => {
    expect(entraAlTarifario(base({ solicitud_pricing_id: "s", vigente_desde: "2026-10-01", vigente_hasta: "2026-10-02" }))).toBe(false);
    expect(entraAlTarifario(base({ solicitud_pricing_id: "s", vigente_desde: "2026-10-01", vigente_hasta: "2026-10-03" }))).toBe(true);
    expect(entraAlTarifario(base({}))).toBe(true);
  });
  it("agrupa 20 y 40 en una fila", () => {
    const filas = agruparTarifas([base({ id: "a" }), base({ id: "b", tipo: { code: "40HC" }, flete_base: 1500 })]);
    expect(filas).toHaveLength(1);
    expect(filas[0].tarifa20?.id).toBe("a");
    expect(filas[0].tarifa40?.id).toBe("b");
  });
  it("encuentra coincidencias por ruta, contenedor y vigencia", () => {
    const ts = [base({ id: "a" }), base({ id: "b", tipo: { code: "40HC" } }), base({ id: "c", vigente_hasta: "2026-10-05" })];
    const s = { pol: "shanghai", pod: "Manzanillo", origen: null, destino: null, container_size: "20'", fecha_tentativa_carga: null };
    expect(tarifasCoincidentes(s, ts, "2026-10-07").map((t) => t.id)).toEqual(["a"]);
  });
});
