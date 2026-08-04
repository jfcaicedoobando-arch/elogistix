import { describe, it, expect } from "vitest";
import {
  calcularTopeVinculacion,
  lineaExcedeOriginal,
  sumarVinculos,
} from "../topeVinculacion";

describe("topeVinculacion", () => {
  it("sin vínculos no excede y todo el subtotal está disponible", () => {
    const r = calcularTopeVinculacion(1000, {});
    expect(r.asignado).toBe(0);
    expect(r.disponible).toBe(1000);
    expect(r.excedente).toBe(0);
    expect(r.excede).toBe(false);
    expect(r.lineas).toBe(0);
  });

  it("suma exacta al subtotal no excede", () => {
    const r = calcularTopeVinculacion(1000, {
      a: { monto: 400 },
      b: { monto: 600 },
    });
    expect(r.asignado).toBe(1000);
    expect(r.disponible).toBe(0);
    expect(r.excede).toBe(false);
  });

  it("suma menor deja disponible el resto", () => {
    const r = calcularTopeVinculacion(1000, { a: { monto: 250.5 } });
    expect(r.asignado).toBe(250.5);
    expect(r.disponible).toBe(749.5);
    expect(r.excede).toBe(false);
  });

  it("excedente dentro de la tolerancia (0.005) no bloquea", () => {
    const r = calcularTopeVinculacion(1000, { a: { monto: 1000.005 } });
    expect(r.excede).toBe(false);
  });

  it("excedente claro bloquea y reporta el monto sobrante", () => {
    const r = calcularTopeVinculacion(1000, {
      a: { monto: 2000 },
      b: { monto: 1500 },
    });
    expect(r.asignado).toBe(3500);
    expect(r.excedente).toBe(2500);
    expect(r.disponible).toBe(0);
    expect(r.excede).toBe(true);
    expect(r.lineas).toBe(2);
  });

  it("tolera montos como texto o nulos", () => {
    expect(sumarVinculos({ a: { monto: "100.25" }, b: { monto: null } })).toBe(100.25);
  });

  it("sin drift binario al sumar decimales", () => {
    const r = calcularTopeVinculacion(0.3, { a: { monto: 0.1 }, b: { monto: 0.2 } });
    expect(r.asignado).toBe(0.3);
    expect(r.excede).toBe(false);
  });

  it("lineaExcedeOriginal detecta montos por encima de lo cotizado", () => {
    expect(lineaExcedeOriginal({ monto: 150, montoOriginal: 100 })).toBe(true);
    expect(lineaExcedeOriginal({ monto: 100, montoOriginal: 100 })).toBe(false);
    expect(lineaExcedeOriginal({ monto: 80, montoOriginal: 100 })).toBe(false);
    expect(lineaExcedeOriginal({ monto: 150, montoOriginal: null })).toBe(false);
  });
});
