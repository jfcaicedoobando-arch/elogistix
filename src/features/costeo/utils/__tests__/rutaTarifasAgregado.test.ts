import { describe, it, expect } from "vitest";
import { agregarTarifasRuta, type TarifaRutaAgregable } from "../rutaTarifasAgregado";
import { computeRutaEstado } from "../rutaEstado";

const HOY = "2026-09-24";
const base: TarifaRutaAgregable = {
  estado: "vigente", estado_aprobacion: "vigente", vigente_desde: "2026-09-01",
  vigente_hasta: "2026-10-31", updated_at: "2026-09-01T00:00:00Z", agente_id: "a1",
};

describe("agregarTarifasRuta", () => {
  it("no cuenta tarifa aprobada futura (15/10–15/11)", () => {
    const r = agregarTarifasRuta([{ ...base, vigente_desde: "2026-10-15", vigente_hasta: "2026-11-15" }], HOY);
    expect(r.tarifas_vigentes_count).toBe(0);
    expect(r.proveedores_count).toBe(0);
    expect(r.proxima_expiracion).toBeNull();
  });
  it("no cuenta pendientes de aprobación ni rechazadas", () => {
    const r = agregarTarifasRuta([
      base,
      { ...base, estado_aprobacion: "borrador", agente_id: "a2" },
      { ...base, estado_aprobacion: "rechazada", agente_id: "a3" },
    ], HOY);
    expect(r.tarifas_vigentes_count).toBe(1);
    expect(r.proveedores_count).toBe(1);
  });
  it("no cuenta expiradas; vence hoy e inicia hoy sí cuentan", () => {
    const r = agregarTarifasRuta([
      { ...base, vigente_hasta: "2026-09-23" },
      { ...base, vigente_hasta: HOY, agente_id: "a2" },
      { ...base, vigente_desde: HOY, vigente_hasta: "2026-12-01", agente_id: "a3" },
    ], HOY);
    expect(r.tarifas_vigentes_count).toBe(2);
    expect(r.proxima_expiracion).toBe(HOY);
  });
  it("excluye reemplazadas", () => {
    expect(agregarTarifasRuta([{ ...base, estado: "reemplazada" }], HOY).tarifas_vigentes_count).toBe(0);
  });
  it("ruta con sólo tarifa futura no se muestra Activa", () => {
    const agg = agregarTarifasRuta([{ ...base, vigente_desde: "2026-10-15", vigente_hasta: "2026-11-15" }], HOY);
    const estado = computeRutaEstado({ activa: true, ...agg } as never);
    expect(estado.key).not.toBe("activa");
  });
});
