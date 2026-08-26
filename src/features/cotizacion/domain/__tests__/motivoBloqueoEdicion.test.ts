import { describe, it, expect } from "vitest";
import { motivoBloqueoEdicionCotizacion } from "@/features/cotizacion/domain/estadosEditables";

describe("motivoBloqueoEdicionCotizacion (B-11/B-12)", () => {
  it("permite editar Borrador y Solicitada sin embarque", () => {
    expect(motivoBloqueoEdicionCotizacion({ estado: "Borrador" })).toBeNull();
    expect(motivoBloqueoEdicionCotizacion({ estado: "Solicitada", embarque_id: null })).toBeNull();
  });

  it("bloquea cuando ya está vinculada a un embarque", () => {
    const motivo = motivoBloqueoEdicionCotizacion({ estado: "Borrador", embarque_id: "emb-1" });
    expect(motivo).toMatch(/vinculada a un embarque/i);
  });

  it("bloquea estados no editables explicando el estado", () => {
    expect(motivoBloqueoEdicionCotizacion({ estado: "En operación" })).toMatch(/En operación/);
    expect(motivoBloqueoEdicionCotizacion({ estado: "Aceptada" })).toMatch(/no se puede editar/i);
    expect(motivoBloqueoEdicionCotizacion({ estado: null })).toMatch(/desconocido/);
  });
});
