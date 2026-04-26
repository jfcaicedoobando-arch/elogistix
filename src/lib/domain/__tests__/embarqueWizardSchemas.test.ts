import { describe, it, expect } from "vitest";
import {
  validateStepDatosGenerales,
  validateStepRuta,
  validateStepDocumentos,
  validateStepCostos,
  validateArchivo,
  sugerirETA,
  MAX_FILE_SIZE_BYTES,
} from "../embarqueWizardSchemas";

describe("validateStepDatosGenerales", () => {
  it("acepta inputs válidos", () => {
    const errors = validateStepDatosGenerales({
      modo: "Marítimo",
      tipo: "Importación",
      clienteId: "abc",
      descripcionMercancia: "Café",
    });
    expect(errors).toEqual({});
  });

  it("reporta todos los campos faltantes", () => {
    const errors = validateStepDatosGenerales({});
    expect(errors.modo).toBeDefined();
    expect(errors.tipo).toBeDefined();
    expect(errors.clienteId).toBeDefined();
    expect(errors.descripcionMercancia).toBeDefined();
  });
});

describe("validateStepRuta", () => {
  it("Marítimo válido", () => {
    const errors = validateStepRuta({
      modo: "Marítimo",
      etd: "2026-05-01",
      eta: "2026-05-20",
      puertoOrigen: "MXZLO",
      puertoDestino: "USLAX",
      naviera: "MAERSK",
      tipoServicio: "FCL",
      contenedor: "ABCD1234567",
      tipoContenedor: "40HC",
    });
    expect(errors).toEqual({});
  });

  it("Marítimo LCL no exige tipoContenedor manual", () => {
    const errors = validateStepRuta({
      modo: "Marítimo",
      etd: "2026-05-01",
      eta: "2026-05-20",
      puertoOrigen: "MXZLO",
      puertoDestino: "USLAX",
      naviera: "MAERSK",
      tipoServicio: "LCL",
      contenedor: "N/A",
      tipoContenedor: "",
    });
    expect(errors).toEqual({});
  });

  it("ETA antes de ETD falla", () => {
    const errors = validateStepRuta({
      modo: "Marítimo",
      etd: "2026-05-20",
      eta: "2026-05-01",
      puertoOrigen: "X",
      puertoDestino: "Y",
      naviera: "Z",
      tipoServicio: "FCL",
      contenedor: "C",
      tipoContenedor: "40HC",
    });
    expect(errors.eta).toMatch(/posterior/);
  });

  it("Aéreo exige aeropuertos y MAWB", () => {
    const errors = validateStepRuta({ modo: "Aéreo", etd: "2026-05-01", eta: "2026-05-02" });
    expect(errors.aeropuertoOrigen).toBeDefined();
    expect(errors.aeropuertoDestino).toBeDefined();
    expect(errors.mawb).toBeDefined();
  });

  it("Terrestre exige ciudades y transportista", () => {
    const errors = validateStepRuta({ modo: "Terrestre", etd: "2026-05-01", eta: "2026-05-02" });
    expect(errors.ciudadOrigen).toBeDefined();
    expect(errors.transportista).toBeDefined();
  });
});

describe("validateArchivo", () => {
  it("acepta PDF dentro del límite", () => {
    expect(validateArchivo({ nombre: "x", size: 1024, type: "application/pdf" })).toBeNull();
  });
  it("rechaza archivo muy grande", () => {
    const r = validateArchivo({ nombre: "x", size: MAX_FILE_SIZE_BYTES + 1, type: "application/pdf" });
    expect(r).toMatch(/excede/);
  });
  it("rechaza tipo no permitido", () => {
    const r = validateArchivo({ nombre: "x", size: 100, type: "application/x-msdownload" });
    expect(r).toMatch(/formato/i);
  });
});

describe("validateStepDocumentos", () => {
  it("vacío es válido (todos opcionales)", () => {
    expect(validateStepDocumentos({})).toEqual({});
  });
  it("detecta archivo inválido", () => {
    const errors = validateStepDocumentos({
      "BL Master": { size: MAX_FILE_SIZE_BYTES + 1, type: "application/pdf" },
    });
    expect(errors["BL Master"]).toBeDefined();
  });
});

describe("validateStepCostos", () => {
  const baseTC = { tipoCambioUSD: "17.5", tipoCambioEUR: "19" };

  it("válido con al menos un concepto", () => {
    const errors = validateStepCostos({
      ...baseTC,
      conceptosVenta: [{ id: 1, concepto: "Flete", cantidad: 1, precioUnitario: 100, moneda: "USD" }],
      conceptosCosto: [{ id: 1, proveedorId: "p1", concepto: "Flete", monto: 50, moneda: "USD" }],
    });
    expect(errors).toEqual({});
  });

  it("rechaza tipo de cambio ≤ 0", () => {
    const errors = validateStepCostos({
      tipoCambioUSD: "0",
      tipoCambioEUR: "-1",
      conceptosVenta: [{ id: 1, concepto: "x", cantidad: 1, precioUnitario: 100, moneda: "USD" }],
      conceptosCosto: [{ id: 1, proveedorId: "p1", concepto: "x", monto: 1, moneda: "USD" }],
    });
    expect(errors.tipoCambioUSD).toBeDefined();
    expect(errors.tipoCambioEUR).toBeDefined();
  });

  it("exige al menos un concepto válido de venta y costo", () => {
    const errors = validateStepCostos({
      ...baseTC,
      conceptosVenta: [{ id: 1, concepto: "", cantidad: 1, precioUnitario: 0, moneda: "USD" }],
      conceptosCosto: [{ id: 1, proveedorId: "", concepto: "", monto: 0, moneda: "USD" }],
    });
    expect(errors.conceptosVenta).toBeDefined();
    expect(errors.conceptosCosto).toBeDefined();
  });
});

describe("sugerirETA", () => {
  it("suma días de tránsito al ETD", () => {
    expect(sugerirETA("2026-05-01", 19)).toBe("2026-05-20");
  });
  it("retorna null sin datos suficientes", () => {
    expect(sugerirETA(null, 5)).toBeNull();
    expect(sugerirETA("2026-05-01", 0)).toBeNull();
  });
});
