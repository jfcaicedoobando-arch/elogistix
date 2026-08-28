/**
 * Ola 7 (M3/M7): normalización de correo y topes numéricos compartidos.
 */
import { describe, expect, it } from "vitest";
import { emailSchema } from "../mutationSchemas.shared";
import { CANTIDAD_MAX, MONTO_MAX } from "../limitesNumericos";

describe("Ola 7 · captura", () => {
  it("normaliza el correo a minúsculas y sin espacios", () => {
    expect(emailSchema.parse("  Hector@Ejemplo.MX ")).toBe("hector@ejemplo.mx");
  });

  it("rechaza correos con formato inválido", () => {
    expect(emailSchema.safeParse("no-es-correo").success).toBe(false);
  });

  it("expone los topes numéricos del ERP", () => {
    expect(MONTO_MAX).toBe(999_999_999.99);
    expect(CANTIDAD_MAX).toBe(1_000_000);
  });
});
