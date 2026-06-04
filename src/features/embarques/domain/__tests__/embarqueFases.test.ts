import { describe, it, expect } from "vitest";
import { calcularFasesEmbarque, type EmbarqueFasesInput } from "../embarqueFases";

const base: EmbarqueFasesInput = {
  modo: "Marítimo",
  tipo: "Importación",
  estado: "Confirmado",
  etd: null,
  eta: null,
  fecha_creacion: "2026-01-01T00:00:00Z",
  fecha_llegada_real: null,
  cotizacion_id: null,
  updated_at: "2026-01-01T00:00:00Z",
};

describe("calcularFasesEmbarque", () => {
  it("devuelve 5 fases en orden canónico", () => {
    const fases = calcularFasesEmbarque(base);
    expect(fases.map((f) => f.id)).toEqual([
      "cotizacion", "confirmado", "en_transito", "llegada", "cerrado",
    ]);
  });

  it("marca cotización pendiente sin cotizacion_id", () => {
    const fases = calcularFasesEmbarque(base);
    expect(fases[0].estado).toBe("pendiente");
  });

  it("marca cotización completada con cotizacion_id", () => {
    const fases = calcularFasesEmbarque({ ...base, cotizacion_id: "abc" });
    expect(fases[0].estado).toBe("completada");
  });

  it("marca llegada completada cuando hay fecha_llegada_real", () => {
    const fases = calcularFasesEmbarque({
      ...base,
      estado: "Arribo",
      fecha_llegada_real: "2026-02-01",
    });
    expect(fases[3].estado).toBe("actual");
  });

  it("marca cerrado actual cuando estado=Cerrado", () => {
    const fases = calcularFasesEmbarque({ ...base, estado: "Cerrado" });
    expect(fases[4].estado).toBe("actual");
    expect(fases[4].fecha).toBe(base.updated_at);
  });

  it("marca en_transito como actual con etd pasado y eta futuro (marítimo importación)", () => {
    const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const fases = calcularFasesEmbarque({ ...base, etd: ayer, eta: manana });
    expect(fases[2].estado).toBe("actual");
  });
});
