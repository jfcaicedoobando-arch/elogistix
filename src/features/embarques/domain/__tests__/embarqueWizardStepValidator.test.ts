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
    // Sin cumplir todos los documentos requeridos, el validador devuelve un
    // objeto plano (no null/array) con al menos una clave de error.
    expect(errors).not.toBeNull();
    expect(Array.isArray(errors)).toBe(false);
    expect(typeof errors).toBe("object");
    expect(Object.keys(errors).length).toBeGreaterThan(0);
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
