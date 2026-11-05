import { describe, it, expect } from "vitest";
import { normalizarTipoCliente } from "../tipoCliente";

describe("normalizarTipoCliente", () => {
  it("por defecto es cliente general", () => {
    expect(normalizarTipoCliente(null)).toBe("general");
    expect(normalizarTipoCliente("otro")).toBe("general");
  });
  it("reconoce cliente especial", () => {
    expect(normalizarTipoCliente("especial")).toBe("especial");
  });
});
