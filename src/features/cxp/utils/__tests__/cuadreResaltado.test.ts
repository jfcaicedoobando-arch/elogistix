import { describe, expect, it } from "vitest";
import { keyRenglonSospechoso } from "../cuadreResaltado";

describe("keyRenglonSospechoso", () => {
  it("sin líneas no resalta nada", () => {
    expect(keyRenglonSospechoso(100, [])).toBeNull();
  });

  it("cuando cuadra no resalta nada", () => {
    const lineas = [{ key: "a", monto: 50, cantidad: 2 }];
    expect(keyRenglonSospechoso(100, lineas)).toBeNull();
  });

  it("cuando falta resalta la línea de mayor total", () => {
    const lineas = [
      { key: "a", monto: 10, cantidad: 1 },
      { key: "b", monto: 30, cantidad: 2 },
    ];
    expect(keyRenglonSospechoso(1000, lineas)).toBe("b");
  });

  it("cuando sobra resalta la línea de mayor total", () => {
    const lineas = [
      { key: "a", monto: 900, cantidad: 1 },
      { key: "b", monto: 5, cantidad: 1 },
    ];
    expect(keyRenglonSospechoso(10, lineas)).toBe("a");
  });
});
