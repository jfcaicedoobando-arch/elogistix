import { describe, it, expect } from "vitest";
import { resolveTipoContenedorNombre } from "../resolveTipoContenedorNombre";

const catalogo = [
  { id: "8014e97d-37a6-4e99-9238-fd507543c340", code: "40HC", name: "40' High Cube" },
  { id: "11111111-1111-1111-1111-111111111111", code: "20", name: "20' Estándar" },
];

describe("resolveTipoContenedorNombre", () => {
  it("resuelve UUID a nombre del catálogo", () => {
    expect(
      resolveTipoContenedorNombre("8014e97d-37a6-4e99-9238-fd507543c340", catalogo),
    ).toBe("40' High Cube");
  });

  it("devuelve string legacy tal cual", () => {
    expect(resolveTipoContenedorNombre("20'", catalogo)).toBe("20'");
    expect(resolveTipoContenedorNombre("40HC", catalogo)).toBe("40HC");
  });

  it("devuelve fallback para vacío/UUID desconocido", () => {
    expect(resolveTipoContenedorNombre("", catalogo)).toBe("—");
    expect(resolveTipoContenedorNombre(null, catalogo)).toBe("—");
    expect(
      resolveTipoContenedorNombre("99999999-9999-9999-9999-999999999999", catalogo),
    ).toBe("—");
  });
});
