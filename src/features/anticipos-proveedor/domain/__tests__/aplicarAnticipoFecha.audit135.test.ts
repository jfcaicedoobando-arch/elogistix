import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/date/mx", () => ({ hoyMx: () => "2026-10-06" }));
import { buildSchema } from "../aplicarAnticipoSchema";

const payload = {
  facturaId: "11111111-1111-4111-8111-111111111111",
  saldoFactura: 50, monedaFactura: "MXN", monto: 20, fechaAplicacion: "2026-10-06",
};

describe("audit135 · esquema de aplicación con fecha de documentos", () => {
  it("acepta exactamente el límite sin alterar fecha ni monto", () => {
    const result = buildSchema(100, "MXN", 50, "2026-10-06").parse(payload);
    expect(result.fechaAplicacion).toBe("2026-10-06");
    expect(result.monto).toBe(20);
  });
  it("rechaza fecha anterior, vacía o futura con error de fecha", () => {
    for (const fechaAplicacion of ["2026-10-05", "", "2026-10-07"]) {
      const result = buildSchema(100, "MXN", 50, "2026-10-06").safeParse({ ...payload, fechaAplicacion });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "fechaAplicacion")).toBe(true);
    }
  });
  it("no borra la protección de moneda al validar una fecha correcta", () => {
    const result = buildSchema(100, "USD", null, "2026-10-06").safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "monto")).toBe(true);
  });
});
