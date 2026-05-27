import { describe, it, expect } from "vitest";
import {
  arribosEsteMesSchema,
  resumenMesSiguienteSchema,
  cargaPorClienteSchema,
} from "../dashboardSchemas";

describe("dashboardSchemas", () => {
  it("arribosEsteMesSchema acepta payload válido y coerce strings", () => {
    const r = arribosEsteMesSchema.parse({
      total: "5",
      yaLlegaron: 2,
      enCamino: 3,
      profitUSD: 100,
      ventaMXN: 200,
      costoMXN: 50,
      profitMXN: 150,
      ventaMxnFromUsd: 0,
      costoMxnFromUsd: 0,
      ventaMxnFromEur: 0,
      costoMxnFromEur: 0,
      ventaMxnNative: 200,
      costoMxnNative: 50,
    });
    expect(r.total).toBe(5);
    expect(r.profitUSD).toBe(100);
  });

  it("resumenMesSiguienteSchema rechaza objeto sin campos requeridos", () => {
    const result = resumenMesSiguienteSchema.safeParse({ totalEmbarques: "no-numero" });
    expect(result.success).toBe(false);
  });

  it("cargaPorClienteSchema tolera ambos snake_case y camelCase de cliente", () => {
    const r = cargaPorClienteSchema.parse({
      cliente_id: "abc",
      cliente_nombre: "Acme",
      total: 7,
    });
    expect(r.total).toBe(7);
    expect(r.cliente_id).toBe("abc");
    expect(r.desglose.Confirmado).toBe(0);
  });
});
