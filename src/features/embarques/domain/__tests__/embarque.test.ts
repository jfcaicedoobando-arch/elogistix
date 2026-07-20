import { describe, it, expect } from "vitest";
import {
  tipoEventoParaEstado,
  descripcionEventoCambioEstado,
  ESTADO_A_EVENTO_TRACKING,
  calcularEstadoEmbarque,
} from "@/features/embarques/domain/embarque";


describe("tipoEventoParaEstado", () => {
  it("mapea estados conocidos al tipo de evento correcto", () => {
    expect(tipoEventoParaEstado("En Tránsito")).toBe("Zarpe");
    expect(tipoEventoParaEstado("Arribo")).toBe("Arribo a Puerto");
    expect(tipoEventoParaEstado("En Aduana")).toBe("Despacho Aduanal");
    expect(tipoEventoParaEstado("Entregado")).toBe("Entrega");
    expect(tipoEventoParaEstado("EIR")).toBe("Liberación");
  });

  it("usa 'Otro' como fallback para estados sin mapeo dedicado", () => {
    expect(tipoEventoParaEstado("Confirmado")).toBe("Otro");
    expect(tipoEventoParaEstado("Cerrado")).toBe("Otro");
  });

  it("usa 'Otro' para estados desconocidos", () => {
    expect(tipoEventoParaEstado("Inexistente")).toBe("Otro");
    expect(tipoEventoParaEstado("")).toBe("Otro");
  });

  it("expone el mapa completo como constante", () => {
    expect(ESTADO_A_EVENTO_TRACKING["En Tránsito"]).toBe("Zarpe");
  });
});

describe("descripcionEventoCambioEstado", () => {
  it("construye la descripción estándar con comillas alrededor del estado", () => {
    expect(descripcionEventoCambioEstado("Arribo")).toBe(
      'Estado cambiado a "Arribo"',
    );
  });
});

describe("calcularEstadoEmbarque — allowlist de estados auto-calculables (v13.302.9)", () => {
  const FUTURO = "2099-12-31";
  const PASADO = "2000-01-01";

  it("Borrador con ETD vencido NO se transiciona (regresión requestId d3b726f5)", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", PASADO, FUTURO, "Borrador"),
    ).toBe("Borrador");
  });

  it("Cotización con ETD vencido NO se transiciona", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", PASADO, FUTURO, "Cotización"),
    ).toBe("Cotización");
  });

  it("Cancelado permanece Cancelado", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", PASADO, PASADO, "Cancelado"),
    ).toBe("Cancelado");
  });

  it("Confirmado con ETD vencido avanza a En Tránsito", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", PASADO, FUTURO, "Confirmado"),
    ).toBe("En Tránsito");
  });

  it("En Tránsito con ETA vencida y sin llegada real se mantiene En Tránsito", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", PASADO, PASADO, "En Tránsito", null),
    ).toBe("En Tránsito");
  });

  it("En Tránsito con ETA vencida y llegada real pasa a Arribo", () => {
    expect(
      calcularEstadoEmbarque("Marítimo", "Importación", PASADO, PASADO, "En Tránsito", "2020-01-01"),
    ).toBe("Arribo");
  });

  it("Confirmado en modo no marítimo no muta", () => {
    expect(
      calcularEstadoEmbarque("Aéreo", "Importación", PASADO, FUTURO, "Confirmado"),
    ).toBe("Confirmado");
  });
});
