import { describe, it, expect, vi } from "vitest";
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
  it("devuelve 9 fases en orden canónico v13.380.0", () => {
    const fases = calcularFasesEmbarque(base);
    expect(fases.map((f) => f.id)).toEqual([
      "cotizacion", "confirmado", "en_transito",
      "arribo", "en_aduana", "entregado", "eir", "por_liquidar", "cerrado",
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

  it("marca arribo como actual cuando estado=Arribo y hay fecha_llegada_real", () => {
    const fases = calcularFasesEmbarque({
      ...base,
      estado: "Arribo",
      fecha_llegada_real: "2026-02-01",
    });
    // Índice 3 = "arribo" en el nuevo orden.
    expect(fases[3].estado).toBe("actual");
  });

  it("marca EIR como fase propia (v13.303.22)", () => {
    const fases = calcularFasesEmbarque({ ...base, estado: "EIR" });
    // Índice 6 = "eir".
    expect(fases[6].estado).toBe("actual");
    // Y todas las anteriores completadas.
    expect(fases[5].estado).toBe("completada");
  });

  it("marca cerrado actual cuando estado=Cerrado", () => {
    const fases = calcularFasesEmbarque({ ...base, estado: "Cerrado" });
    // Índice 8 = "cerrado" en el nuevo orden (v13.380.0).
    expect(fases[8].estado).toBe("actual");
    expect(fases[8].fecha).toBe(base.updated_at);
  });

  it("marca en_transito como actual con etd pasado y eta futuro (marítimo importación)", () => {
    // v13.137.36: pin de reloj para que `ayer`/`manana` y cualquier `Date.now()`
    // interno del SUT compartan la misma referencia (evita flake en CI lento o
    // si un test previo dejó timers falsos activos).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
    try {
      const ayer = "2026-06-16";
      const manana = "2026-06-18";
      const fases = calcularFasesEmbarque({ ...base, etd: ayer, eta: manana });
      expect(fases[2].estado).toBe("actual");
    } finally {
      vi.useRealTimers();
    }
  });
});
