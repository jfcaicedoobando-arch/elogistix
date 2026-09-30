import { describe, expect, it } from "vitest";
import {
  facturaManualIsDirty, INITIAL_CONCEPTOS, INITIAL_FISCAL,
} from "../facturaManualFormDefaults";

describe("factura manual · cambios pendientes", () => {
  it("el formulario recién abierto no pide descartar el concepto vacío inicial", () => {
    expect(facturaManualIsDirty("", INITIAL_FISCAL, INITIAL_CONCEPTOS, "")).toBe(false);
  });

  it("detecta cambios en cliente, fiscal, concepto y notas", () => {
    expect(facturaManualIsDirty("cliente-1", INITIAL_FISCAL, INITIAL_CONCEPTOS, "")).toBe(true);
    expect(facturaManualIsDirty("", { ...INITIAL_FISCAL, moneda: "USD" }, INITIAL_CONCEPTOS, "")).toBe(true);
    expect(facturaManualIsDirty("", INITIAL_FISCAL, [{ ...INITIAL_CONCEPTOS[0], descripcion: "Flete" }], "")).toBe(true);
    expect(facturaManualIsDirty("", INITIAL_FISCAL, INITIAL_CONCEPTOS, "Nota interna")).toBe(true);
  });
});
