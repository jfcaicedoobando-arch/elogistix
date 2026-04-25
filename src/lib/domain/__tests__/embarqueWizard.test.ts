import { describe, it, expect } from "vitest";
import {
  validateDatosGenerales,
  isDatosGeneralesValid,
  mapConceptosCostoFromCotizacion,
} from "../embarqueWizard";

describe("validateDatosGenerales", () => {
  it("devuelve errores cuando faltan todos los campos", () => {
    const errors = validateDatosGenerales({});
    expect(errors.modo).toBeDefined();
    expect(errors.tipo).toBeDefined();
    expect(errors.clienteId).toBeDefined();
    expect(errors.descripcionMercancia).toBeDefined();
  });

  it("acepta entradas completas", () => {
    expect(
      isDatosGeneralesValid({
        modo: "Marítimo",
        tipo: "Importación",
        clienteId: "abc",
        descripcionMercancia: "Equipo industrial",
      }),
    ).toBe(true);
  });

  it("rechaza descripción solo con espacios", () => {
    const errors = validateDatosGenerales({
      modo: "Marítimo",
      tipo: "Importación",
      clienteId: "abc",
      descripcionMercancia: "   ",
    });
    expect(errors.descripcionMercancia).toBeDefined();
  });
});

describe("mapConceptosCostoFromCotizacion", () => {
  it("resuelve proveedorId por nombre cuando existe", () => {
    const result = mapConceptosCostoFromCotizacion(
      [{ proveedor: "MAERSK", concepto: "Flete", costo_unitario: 1000, moneda: "USD" }],
      [{ id: "p1", nombre: "MAERSK" }],
    );
    expect(result[0].proveedorId).toBe("p1");
    expect(result[0].monto).toBe(1000);
    expect(result[0].moneda).toBe("USD");
  });

  it("deja proveedorId vacío si no encuentra match", () => {
    const result = mapConceptosCostoFromCotizacion(
      [{ proveedor: "DESCONOCIDO", concepto: "X", costo_unitario: "0", moneda: null }],
      [{ id: "p1", nombre: "MAERSK" }],
    );
    expect(result[0].proveedorId).toBe("");
    expect(result[0].moneda).toBe("MXN");
  });
});
