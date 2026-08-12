/** FE-03 / UIA-06: reglas de fecha del cobro CxC. */
import { describe, it, expect } from "vitest";
import { validarFechaPago } from "../DialogRegistrarPago";

describe("validarFechaPago", () => {
  it("exige capturar la fecha", () => {
    expect(validarFechaPago("", "2026-08-12")).toBe("Captura la fecha del pago");
  });

  it("rechaza fecha futura", () => {
    expect(validarFechaPago("2030-05-01", "2026-08-12")).toBe(
      "La fecha del pago no puede ser futura",
    );
  });

  it("rechaza fecha anterior a la emisión", () => {
    expect(validarFechaPago("2026-08-01", "2026-08-12", "2026-08-05")).toBe(
      "La fecha del pago no puede ser anterior a la fecha de emisión de la factura",
    );
  });

  it("acepta hoy y la fecha de emisión exacta", () => {
    expect(validarFechaPago("2026-08-12", "2026-08-12", "2026-08-01")).toBeNull();
    expect(validarFechaPago("2026-08-05", "2026-08-12", "2026-08-05")).toBeNull();
  });

  it("sin fecha de emisión (legacy) sólo aplica la regla de futuro", () => {
    expect(validarFechaPago("2020-01-01", "2026-08-12", null)).toBeNull();
  });
});
