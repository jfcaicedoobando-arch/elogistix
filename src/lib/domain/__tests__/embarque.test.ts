import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";

describe("calcularEstadoEmbarque", () => {
  beforeAll(() => {
    // Fijar "hoy" al 2026-04-15 para deterministicar los rangos
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("respeta estados manuales sin recalcular", () => {
    const manuales = ["Arribo", "En Aduana", "Entregado", "EIR", "Cerrado"];
    for (const est of manuales) {
      expect(
        calcularEstadoEmbarque("Marítimo", "Importación", "2026-04-01", "2026-04-10", est),
      ).toBe(est);
    }
  });

  it("no calcula automático para modos distintos a Marítimo + Importación", () => {
    expect(
      calcularEstadoEmbarque("Aéreo", "Importación", "2026-04-01", "2026-04-30", "Confirmado"),
    ).toBe("Confirmado");
    expect(
      calcularEstadoEmbarque("Marítimo", "Exportación", "2026-04-01", "2026-04-30", "Confirmado"),
    ).toBe("Confirmado");
  });

  it("retorna estado actual si faltan ETD o ETA", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", null, "2026-04-30", "Confirmado"),
    ).toBe("Confirmado");
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", "2026-04-01", null, "Confirmado"),
    ).toBe("Confirmado");
  });

  it("hoy < ETD → Confirmado", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", "2026-04-20", "2026-04-30", "Confirmado"),
    ).toBe("Confirmado");
  });

  it("ETD <= hoy < ETA → En Tránsito", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", "2026-04-10", "2026-04-30", "Confirmado"),
    ).toBe("En Tránsito");
  });

  it("hoy >= ETA → Arribo", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", "2026-04-01", "2026-04-10", "Confirmado"),
    ).toBe("Arribo");
  });
});
