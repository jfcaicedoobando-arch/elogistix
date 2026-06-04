import { describe, it, expect } from "vitest";
import { validateArchivo, validateStepDocumentos } from "@/features/embarques/domain/embarqueWizardDocumentos";
import { MAX_FILE_SIZE_BYTES } from "@/features/embarques/domain/embarqueWizardConstants";

describe("validateArchivo", () => {
  it("retorna null para archivo válido", () => {
    expect(validateArchivo({ nombre: "BL.pdf", size: 1024, type: "application/pdf" })).toBeNull();
  });
  it("rechaza archivo > 10 MB", () => {
    const err = validateArchivo({ nombre: "BL.pdf", size: MAX_FILE_SIZE_BYTES + 1, type: "application/pdf" });
    expect(err).toMatch(/10/);
  });
  it("rechaza mime type no permitido", () => {
    const err = validateArchivo({ nombre: "raro.exe", size: 100, type: "application/x-msdownload" });
    expect(err).toMatch(/formato/i);
  });
  it("acepta archivo sin type definido", () => {
    expect(validateArchivo({ nombre: "x.pdf", size: 100, type: "" })).toBeNull();
  });
});

describe("validateStepDocumentos", () => {
  it("colecciona errores por nombre", () => {
    const errs = validateStepDocumentos({
      "BL.pdf": { size: 100, type: "application/pdf" },
      "mal.exe": { size: 100, type: "application/x-msdownload" },
    });
    expect(errs["BL.pdf"]).toBeUndefined();
    expect(errs["mal.exe"]).toBeTruthy();
  });
});
