import { describe, expect, it } from "vitest";
import { productoFronteraBloqueado } from "../productoFronteraBloqueado";

describe("productoFronteraBloqueado", () => {
  it("bloquea elegir un producto al 8% cuando el estímulo está apagado", () => {
    expect(productoFronteraBloqueado({ tipo_iva: "gravado_8" }, false)).toBe(true);
  });

  it("permite elegir el producto al 8% cuando el estímulo está encendido", () => {
    expect(productoFronteraBloqueado({ tipo_iva: "gravado_8" }, true)).toBe(false);
  });

  it("no bloquea los demás tratamientos", () => {
    expect(productoFronteraBloqueado({ tipo_iva: "gravado_16" }, false)).toBe(false);
  });
});