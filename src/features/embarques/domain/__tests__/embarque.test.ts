import { describe, it, expect } from "vitest";
import {
  tipoEventoParaEstado,
  descripcionEventoCambioEstado,
  ESTADO_A_EVENTO_TRACKING,
} from "@/lib/domain/embarque";

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
