import { describe, it, expect } from "vitest";
import {
  formaPagoParaMetodo,
  MSG_PPD_REQUIERE_99,
  MSG_PUE_REQUIERE_FORMA_REAL,
  normalizarClaveFormaPago,
  validarFormaMetodoPago,
} from "@/lib/financial/formaMetodoPago";

describe("validarFormaMetodoPago", () => {
  it("acepta PPD con forma 99 (operación no pagada)", () => {
    expect(validarFormaMetodoPago("99", "PPD")).toEqual([]);
  });

  it("bloquea PPD con una forma real de pago", () => {
    const issues = validarFormaMetodoPago("03", "PPD");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual({ field: "forma_pago", message: MSG_PPD_REQUIERE_99 });
  });

  it("acepta PUE con forma real y bloquea PUE con 99", () => {
    expect(validarFormaMetodoPago("03", "PUE")).toEqual([]);
    expect(validarFormaMetodoPago("99", "PUE")[0].message).toBe(MSG_PUE_REQUIERE_FORMA_REAL);
  });

  it("bloquea claves fuera del catálogo o ausentes", () => {
    expect(validarFormaMetodoPago("", "PUE")).toHaveLength(1);
    expect(validarFormaMetodoPago("77", "PUE")).toHaveLength(1);
    expect(validarFormaMetodoPago("03", "")).toHaveLength(1);
  });
});

describe("formaPagoParaMetodo", () => {
  it("fuerza 99 al cambiar a PPD y limpia el 99 al cambiar a PUE", () => {
    expect(formaPagoParaMetodo("PPD", "03")).toBe("99");
    expect(formaPagoParaMetodo("PUE", "99")).toBe("");
    expect(formaPagoParaMetodo("PUE", "03")).toBe("03");
  });
});

describe("normalizarClaveFormaPago", () => {
  it("sólo acepta claves de dos dígitos del catálogo", () => {
    expect(normalizarClaveFormaPago(" 03 ")).toBe("03");
    expect(normalizarClaveFormaPago("07")).toBeNull();
    expect(normalizarClaveFormaPago("3")).toBeNull();
  });
});
