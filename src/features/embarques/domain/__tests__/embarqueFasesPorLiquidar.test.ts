/**
 * v13.380.0 — Fase "Por liquidar": cierre operativo terminado, cierre
 * financiero pendiente. Se ubica entre EIR y Cerrado.
 */
import { describe, it, expect } from "vitest";
import {
  calcularFasesEmbarque,
  esEmbarqueArribado,
  type EmbarqueFasesInput,
} from "../embarqueFases";

const base: EmbarqueFasesInput = {
  modo: "Marítimo",
  tipo: "Importación",
  estado: "EIR",
  etd: "2026-01-01",
  eta: "2026-02-01",
  fecha_creacion: "2025-12-01T00:00:00Z",
  fecha_llegada_real: "2026-02-02",
  cotizacion_id: "cot-1",
  updated_at: "2026-03-01T00:00:00Z",
};

describe("calcularFasesEmbarque · fase Por liquidar", () => {
  it("inserta la fase entre EIR y Cerrado", () => {
    const ids = calcularFasesEmbarque(base).map((f) => f.id);
    expect(ids).toEqual([
      "cotizacion", "confirmado", "en_transito", "arribo",
      "en_aduana", "entregado", "eir", "por_liquidar", "cerrado",
    ]);
  });

  it("marca Por liquidar como fase actual y EIR como completada", () => {
    const fases = calcularFasesEmbarque({ ...base, estado: "Por liquidar" });
    const porLiquidar = fases.find((f) => f.id === "por_liquidar");
    expect(porLiquidar?.estado).toBe("actual");
    expect(porLiquidar?.label).toBe("Por liquidar");
    expect(fases.find((f) => f.id === "eir")?.estado).toBe("completada");
    expect(fases.find((f) => f.id === "cerrado")?.estado).toBe("pendiente");
  });

  it("en estado Cerrado la fase Por liquidar queda completada", () => {
    const fases = calcularFasesEmbarque({ ...base, estado: "Cerrado" });
    expect(fases.find((f) => f.id === "por_liquidar")?.estado).toBe("completada");
  });

  it("en EIR la fase Por liquidar todavía está pendiente", () => {
    const fases = calcularFasesEmbarque(base);
    expect(fases.find((f) => f.id === "por_liquidar")?.estado).toBe("pendiente");
  });

  it("un embarque Por liquidar cuenta como arribado (no dispara alertas de ETA)", () => {
    expect(
      esEmbarqueArribado({ estado: "Por liquidar", eta: "2026-01-01", fecha_llegada_real: null }),
    ).toBe(true);
  });
});
