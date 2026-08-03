import { describe, it, expect } from "vitest";
import { calcularCuadreConceptos, sumarConceptos, totalLinea } from "../cuadreConceptos";

describe("cuadreConceptos", () => {
  it("marca sin_conceptos cuando la lista está vacía", () => {
    const r = calcularCuadreConceptos(100, []);
    expect(r.estado).toBe("sin_conceptos");
    expect(r.puedeAprobar).toBe(false);
    expect(r.diferencia).toBe(100);
  });

  it("marca cuadrado dentro de la tolerancia 0.01", () => {
    const r = calcularCuadreConceptos(100.005, [{ monto: 100 }]);
    expect(r.estado).toBe("cuadrado");
    expect(r.puedeAprobar).toBe(true);
    expect(r.diferencia).toBe(0);
  });

  it("caso real FP-000039: 19,150 + (-510.40) cuadra con 18,639.60", () => {
    const r = calcularCuadreConceptos(18639.6, [
      { monto: 19150 },
      { monto: -510.4 },
    ]);
    expect(r.estado).toBe("cuadrado");
    expect(r.suma).toBeCloseTo(18639.6, 2);
  });

  it("marca faltante cuando la suma es menor que el subtotal", () => {
    const r = calcularCuadreConceptos(18639.6, [{ monto: 19150 }]);
    expect(r.estado).toBe("sobrante"); // suma > subtotal
    expect(r.diferencia).toBeCloseTo(-510.4, 2);
    expect(r.puedeAprobar).toBe(false);
  });

  it("marca sobrante cuando el subtotal excede la suma", () => {
    const r = calcularCuadreConceptos(200, [{ monto: 100 }, { monto: 50 }]);
    expect(r.estado).toBe("faltante");
    expect(r.diferencia).toBeCloseTo(50, 2);
  });

  it("respeta cantidad × monto (replica trigger BD)", () => {
    const r = calcularCuadreConceptos(300, [{ monto: 100, cantidad: 3 }]);
    expect(r.estado).toBe("cuadrado");
    expect(r.suma).toBeCloseTo(300, 2);
  });

  it("trata cantidad 0 o nula como 1", () => {
    expect(sumarConceptos([{ monto: 50, cantidad: 0 }])).toBeCloseTo(50, 2);
    expect(sumarConceptos([{ monto: 50, cantidad: null }])).toBeCloseTo(50, 2);
  });

  it("suma conceptos negativos correctamente (nota de crédito parcial)", () => {
    const r = calcularCuadreConceptos(90, [{ monto: 100 }, { monto: -10 }]);
    expect(r.estado).toBe("cuadrado");
    expect(r.suma).toBeCloseTo(90, 2);
  });
});

describe("totalLinea", () => {
  it("multiplica importe unitario × cantidad", () => {
    expect(totalLinea({ monto: 2750, cantidad: 8 })).toBeCloseTo(22000, 2);
  });

  it("usa 1 cuando la cantidad es 0, nula o indefinida", () => {
    expect(totalLinea({ monto: 35, cantidad: 0 })).toBeCloseTo(35, 2);
    expect(totalLinea({ monto: 35, cantidad: null })).toBeCloseTo(35, 2);
    expect(totalLinea({ monto: 35 })).toBeCloseTo(35, 2);
  });

  it("el total de la tabla coincide con sumarConceptos", () => {
    const lineas = [
      { monto: 2750, cantidad: 8 },
      { monto: 35, cantidad: 1 },
      { monto: 13, cantidad: 8 },
      { monto: 50, cantidad: 8 },
      { monto: 50, cantidad: 1 },
    ];
    const totalTabla = lineas.reduce((a, l) => a + totalLinea(l), 0);
    expect(sumarConceptos(lineas)).toBeCloseTo(totalTabla, 2);
    expect(sumarConceptos(lineas)).toBeCloseTo(22589, 2);
  });
});
