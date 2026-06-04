import { describe, it, expect } from "vitest";
import { validateStepCostos } from "@/features/embarques/domain/embarqueWizardCostos";

const ventaOk = { id: 1, concepto: "Flete", cantidad: 1, precioUnitario: 100, moneda: "USD" };
const costoOk = { id: 1, proveedorId: "p1", concepto: "Flete", monto: 50, moneda: "USD" };

describe("validateStepCostos", () => {
  it("sin errores con input válido", () => {
    const errs = validateStepCostos({
      conceptosVenta: [ventaOk],
      conceptosCosto: [costoOk],
      tipoCambioUSD: 17.5,
      tipoCambioEUR: 19,
    });
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("marca TC USD/EUR <= 0", () => {
    const errs = validateStepCostos({
      conceptosVenta: [ventaOk],
      conceptosCosto: [costoOk],
      tipoCambioUSD: 0,
      tipoCambioEUR: -1,
    });
    expect(errs.tipoCambioUSD).toBeTruthy();
    expect(errs.tipoCambioEUR).toBeTruthy();
  });

  it("parsea string como TC", () => {
    const errs = validateStepCostos({
      conceptosVenta: [ventaOk],
      conceptosCosto: [costoOk],
      tipoCambioUSD: "abc",
      tipoCambioEUR: "19.5",
    });
    expect(errs.tipoCambioUSD).toBeTruthy();
    expect(errs.tipoCambioEUR).toBeUndefined();
  });

  it("requiere al menos una venta y un costo válidos", () => {
    const errs = validateStepCostos({
      conceptosVenta: [],
      conceptosCosto: [],
      tipoCambioUSD: 17.5,
      tipoCambioEUR: 19,
    });
    expect(errs.conceptosVenta).toBeTruthy();
    expect(errs.conceptosCosto).toBeTruthy();
  });

  it("marca venta con cantidad <1 individualmente", () => {
    const errs = validateStepCostos({
      conceptosVenta: [ventaOk, { id: 2, concepto: "X", cantidad: 0, precioUnitario: 10, moneda: "USD" }],
      conceptosCosto: [costoOk],
      tipoCambioUSD: 17.5,
      tipoCambioEUR: 19,
    });
    expect(errs.venta_2).toBeTruthy();
  });

  it("marca costo negativo individualmente", () => {
    const errs = validateStepCostos({
      conceptosVenta: [ventaOk],
      conceptosCosto: [costoOk, { id: 2, proveedorId: "p", concepto: "X", monto: -1, moneda: "USD" }],
      tipoCambioUSD: 17.5,
      tipoCambioEUR: 19,
    });
    expect(errs.costo_2).toBeTruthy();
  });
});
