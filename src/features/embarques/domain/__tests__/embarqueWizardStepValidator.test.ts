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
        incoterm: "FOB",
        descripcionMercancia: "Carga seca",
      },
      documentosArchivos: {},
      conceptosVenta: [],
      conceptosCosto: [],
      cotizacionVinculadaId: "cot-1",
    });
    expect(errors).toEqual({});
  });


  it("step 3: archivo válido (PDF pequeño) no genera errores", () => {
    const errors = validateWizardStep({
      step: 3,
      values: {},
      documentosArchivos: {
        factura: new File(["x"], "f.pdf", { type: "application/pdf" }),
      },
      conceptosVenta: [],
      conceptosCosto: [],
    });
    expect(errors).toEqual({});
  });

  it("step 3: archivo con MIME no permitido genera error puntual", () => {
    const malo = new File(["x"], "f.exe", { type: "application/x-msdownload" });
    const errors = validateWizardStep({
      step: 3,
      values: {},
      documentosArchivos: { factura: malo },
      conceptosVenta: [],
      conceptosCosto: [],
    });
    expect(Object.keys(errors)).toEqual(["factura"]);
    expect(typeof errors.factura).toBe("string");
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

  // v13.303.26 — política tarifa-first: cotización siempre obligatoria en step 1.
  const baseStep1Values = {
    modo: "Marítimo", tipo: "Importación", clienteId: "c1",
    incoterm: "FOB", descripcionMercancia: "Carga seca",
  };

  it("step 1: sin cotización vinculada inyecta error 'cotizacion' (default requiereCotizacion=true)", () => {
    const errors = validateWizardStep({
      step: 1,
      values: baseStep1Values,
      documentosArchivos: {},
      conceptosVenta: [],
      conceptosCosto: [],
      cotizacionVinculadaId: null,
    });
    expect(errors.cotizacion).toBeTruthy();
  });

  it("step 1: con cotización vinculada no inyecta error 'cotizacion'", () => {
    const errors = validateWizardStep({
      step: 1,
      values: baseStep1Values,
      documentosArchivos: {},
      conceptosVenta: [],
      conceptosCosto: [],
      cotizacionVinculadaId: "cot-123",
    });
    expect(errors).toEqual({});
  });
});

