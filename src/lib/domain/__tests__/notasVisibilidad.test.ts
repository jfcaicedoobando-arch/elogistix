import { describe, expect, it } from "vitest";
import { notasParaCliente, separarNotas } from "../notasVisibilidad";

describe("separarNotas", () => {
  it("devuelve vacío cuando no hay texto", () => {
    expect(separarNotas(null)).toEqual({ cliente: "", internas: "" });
    expect(separarNotas("")).toEqual({ cliente: "", internas: "" });
  });

  it("deja intacto el texto sin marcadores", () => {
    expect(separarNotas("Entrega en puerta.").cliente).toBe("Entrega en puerta.");
  });

  it("separa renglones marcados como internos", () => {
    const r = separarNotas("Entrega en puerta.\n[interno] Revisar con Ana el margen.");
    expect(r.cliente).toBe("Entrega en puerta.");
    expect(r.internas).toBe("Revisar con Ana el margen.");
  });

  it("acepta los marcadores #interno e [internal]", () => {
    expect(separarNotas("#interno pendiente").internas).toBe("pendiente");
    expect(separarNotas("[internal] pendiente").internas).toBe("pendiente");
  });

  it("excluye residuos de pruebas QA del texto del cliente", () => {
    const r = separarNotas("QA SMOKE 2026 cambio B\nVigencia sujeta a espacio.");
    expect(r.cliente).toBe("Vigencia sujeta a espacio.");
    expect(r.internas).toContain("QA SMOKE");
  });

  it("notasParaCliente nunca devuelve el texto interno", () => {
    expect(notasParaCliente("[interno] no mostrar\nsí mostrar")).toBe("sí mostrar");
  });
});
