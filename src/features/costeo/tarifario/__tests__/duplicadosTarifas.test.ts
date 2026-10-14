import { describe, it, expect } from "vitest";
import { detectarConflictos, seleccionInicial } from "../duplicadosTarifas";
import type { TarifaImport } from "../importarTarifas";

const imp = (fila: number, flete: number, ruta = "r1"): TarifaImport => ({
  fila, origenId: "o", destinoId: "d",
  input: { agente_id: "a", naviera_id: "n", ruta_id: ruta, tipo_contenedor_id: "t", flete_base: flete,
    dias_libres_demoras: 21, vigente_desde: "2026-10-14", vigente_hasta: "2026-10-31", recargos: [] },
});
const ex = { id: "x", agente_id: "a", naviera_id: "n", ruta_id: "r1", tipo_contenedor_id: "t", flete_base: 900,
  vigente_desde: "2026-10-01", vigente_hasta: "2026-10-20", estado: "vigente", estado_aprobacion: "vigente" };

describe("detectarConflictos", () => {
  it("marca tarifa vigente existente con vigencia cruzada", () => {
    expect(detectarConflictos([imp(2, 1000)], [ex], [], "2026-10-14")[0].tipo).toBe("existente");
  });
  it("ignora existentes reemplazadas, rechazadas o vencidas", () => {
    const otras = [{ ...ex, estado: "reemplazada" }, { ...ex, estado_aprobacion: "rechazada" }, { ...ex, vigente_hasta: "2026-10-13" }];
    expect(detectarConflictos([imp(2, 1000)], otras, [], "2026-10-14")).toEqual([]);
  });
  it("marca repetidas dentro del lote, también con ruta nueva", () => {
    const c = detectarConflictos([imp(2, 1000, ""), imp(3, 1100, "")], [], [], "2026-10-14");
    expect(c).toHaveLength(1);
    expect(c[0].indice).toBe(1);
  });
  it("por defecto conserva sólo las que no tienen conflicto", () => {
    expect([...seleccionInicial(3, [{ indice: 1, tipo: "repetida", fleteOtro: 0, vigenciaOtro: "", estadoOtro: "" }])]).toEqual([0, 2]);
  });
});
