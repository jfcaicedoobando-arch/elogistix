import { describe, it, expect } from "vitest";
import { derivarOrigenAceptacion } from "@/features/proformas/components/ProformaEstadoBadges";

describe("derivarOrigenAceptacion", () => {
  it("reconoce la aprobación interna cuando el cliente no requiere autorización (R170-07)", () => {
    expect(derivarOrigenAceptacion("auto:sin_autorizacion_requerida")).toBe("interna");
  });

  it("mantiene los orígenes existentes", () => {
    expect(derivarOrigenAceptacion("cliente_portal_token")).toBe("portal");
    expect(derivarOrigenAceptacion("manual:alguien@ejemplo.com")).toBe("manual");
    expect(derivarOrigenAceptacion(null)).toBe("desconocido");
  });
});
