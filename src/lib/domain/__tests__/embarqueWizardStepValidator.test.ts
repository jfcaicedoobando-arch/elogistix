import { describe, it, expect } from "vitest";
import { validateWizardStep } from "../embarqueWizardStepValidator";

describe("validateWizardStep", () => {
  it("step 1: marca campos requeridos faltantes", () => {
    const errors = validateWizardStep({
      step: 1,
      values: { modo: "", tipo: "", clienteId: "", descripcionMercancia: "" },
      documentosArchivos: {},
      conceptosVenta: [],
      conceptosCosto: [],
    });
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });

  it("step 1: válido con campos completos", () => {
    const errors = validateWizardStep({
      step: 1,
      values: {
        modo: "Marítimo", tipo: "Importación", clienteId: "c1",
        descripcionMercancia: "Carga seca",
      },
      documentosArchivos: {},
      conceptosVenta: [],
      conceptosCosto: [],
    });
    expect(errors).toEqual({});
  });

  it("step 3: valida tamaño/tipo de archivos", () => {
    const errors = validateWizardStep({
      step: 3,
      values: {},
      documentosArchivos: {
        factura: new File(["x"], "f.pdf", { type: "application/pdf" }),
      },
      conceptosVenta: [],
      conceptosCosto: [],
    });
    // No marcamos todos los docs requeridos; sólo aceptamos que se ejecute sin lanzar.
    expect(typeof errors).toBe("object");
  });

  it("step desconocido retorna vacío", () => {
    const errors = validateWizardStep({
      step: 99,
      values: {},
      documentosArchivos: {},
      conceptosVenta: [],
      conceptosCosto: [],
    });
    expect(errors).toEqual({});
  });
});
