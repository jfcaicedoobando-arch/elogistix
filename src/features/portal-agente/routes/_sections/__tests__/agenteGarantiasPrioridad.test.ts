import { describe, expect, it } from "vitest";
import type { FilaNaviera } from "@/features/costeo/types/filaNaviera";
import { priorizarNavierasAgente } from "../agenteGarantiasPrioridad";

const filas: FilaNaviera[] = ["APL", "COSCO", "Maersk", "ONE"].map((nombre) => ({
  naviera_id: nombre, naviera_nombre: nombre, naviera_code: nombre, condicion: null,
}));
const vigente = {
  naviera_id: "Maersk", estado: "vigente", estado_aprobacion: "vigente",
  vigente_desde: "2026-09-01", vigente_hasta: "2026-10-31",
};
const hoy = "2026-09-30";

describe("prioridad de navieras del agente", () => {
  it("prioriza vigentes y programadas, sin duplicar ni ocultar el catálogo", () => {
    const resultado = priorizarNavierasAgente(filas, [vigente, vigente,
      { ...vigente, naviera_id: "COSCO", vigente_desde: "2026-10-01" }], hoy);
    expect(resultado.filas.map((f) => f.naviera_id)).toEqual(["COSCO", "Maersk", "APL", "ONE"]);
    expect([...resultado.ids]).toEqual(["COSCO", "Maersk"]);
    expect(filas.map((f) => f.naviera_id)).toEqual(["APL", "COSCO", "Maersk", "ONE"]);
  });

  it.each([
    { ...vigente, estado_aprobacion: "borrador" },
    { ...vigente, estado_aprobacion: "rechazada" },
    { ...vigente, estado: "reemplazada" },
    { ...vigente, vigente_hasta: "2026-09-29" },
  ])("no prioriza una tarifa no utilizable: %j", (tarifa) => {
    const resultado = priorizarNavierasAgente(filas, [tarifa], hoy);
    expect(resultado.filas).toEqual(filas);
    expect(resultado.ids.size).toBe(0);
  });

  it("conserva todo el catálogo sin tarifas y no cuenta referencias ausentes", () => {
    expect(priorizarNavierasAgente(filas, [], hoy).filas).toEqual(filas);
    expect(priorizarNavierasAgente(filas, [{ ...vigente, naviera_id: "ausente" }], hoy).ids.size).toBe(0);
  });
});
