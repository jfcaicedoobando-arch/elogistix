/**
 * Tests del barrel `embarqueWizardSchemas` enfocados ÚNICAMENTE en funciones
 * que NO tienen archivo dedicado: validateStepDatosGenerales, validateStepRuta, sugerirETA.
 *
 * validateArchivo, validateStepDocumentos y validateStepCostos están cubiertos en:
 *   - embarqueWizardDocumentos.test.ts
 *   - embarqueWizardCostos.test.ts
 * (duplicados eliminados en v11.39.0).
 */
import { describe, it, expect } from "vitest";
import {
  validateStepDatosGenerales,
  validateStepRuta,
  sugerirETA,
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
      contenedores: [{ numero_contenedor: "ABCD1234567", tipo_contenedor: "40HC" }],
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

describe("sugerirETA", () => {
  it("suma días de tránsito al ETD", () => {
    expect(sugerirETA("2026-05-01", 19)).toBe("2026-05-20");
  });
  it("retorna null sin datos suficientes", () => {
    expect(sugerirETA(null, 5)).toBeNull();
    expect(sugerirETA("2026-05-01", 0)).toBeNull();
  });
});

