/**
 * Alta express de lead: el origen elegido en el modal inicial debe persistir
 * en el input canónico (default Prospección si no se indica).
 */
import { describe, it, expect } from "vitest";
import { leadQuickCreateInput } from "../quickCreateInput";

const USER = { id: "u-1", email: "kam@librecarga.com" };

describe("leadQuickCreateInput — origen", () => {
  it("usa Prospección cuando no se indica origen", () => {
    const input = leadQuickCreateInput("Acme", "ana@acme.com", USER);
    expect(input.fuente).toBe("Prospección");
  });

  it("persiste Finkargo y Referido cuando el usuario los elige", () => {
    expect(leadQuickCreateInput("Acme", "", USER, "Finkargo").fuente).toBe("Finkargo");
    expect(leadQuickCreateInput("Acme", "", USER, "Referido").fuente).toBe("Referido");
  });

  it("no altera el resto del mapeo canónico al recibir origen", () => {
    const input = leadQuickCreateInput("Acme", "5551234567", USER, "Referido");
    expect(input).toMatchObject({
      empresa: "Acme",
      email: "",
      telefono: "5551234567",
      estado: "Nuevo",
      vendedor_id: "u-1",
    });
  });
});
