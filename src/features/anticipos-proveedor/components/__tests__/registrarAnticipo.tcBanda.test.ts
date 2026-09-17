/**
 * MNY — El registro de anticipos reusa el guard canónico `validarTcMxn`
 * (banda 5–40 MXN por divisa) en lugar de aceptar cualquier T/C positivo <1000.
 */
import { describe, it, expect } from "vitest";
import { registrarAnticipoSchema } from "../registrarAnticipo.schema";

const base = {
  proveedorId: "11111111-1111-4111-8111-111111111111",
  monto: 100,
  moneda: "USD" as const,
  fechaAnticipo: "2026-09-01",
  metodoPago: "Transferencia" as const,
  cuentaBancariaId: "22222222-2222-4222-8222-222222222222",
  tipoCambioUsd: 18.5,
  referencia: "",
  notas: "",
  embarqueId: null,
  embarqueExpediente: null,
};

function errorDeTc(values: Record<string, unknown>): string | undefined {
  const parsed = registrarAnticipoSchema.safeParse(values);
  if (parsed.success) return undefined;
  return parsed.error.issues.find((i) => i.path[0] === "tipoCambioUsd")?.message;
}

describe("registrarAnticipoSchema · banda de T/C (MNY)", () => {
  it("acepta un T/C dentro de la banda", () => {
    expect(errorDeTc(base)).toBeUndefined();
  });

  it("rechaza 185 (dedazo)", () => {
    expect(errorDeTc({ ...base, tipoCambioUsd: 185 })).toMatch(/parece incorrecto/i);
  });

  it("rechaza 1.85 (dedazo)", () => {
    expect(errorDeTc({ ...base, tipoCambioUsd: 1.85 })).toMatch(/parece incorrecto/i);
  });

  it("conserva el mensaje de T/C requerido cuando falta", () => {
    const msg = errorDeTc({ ...base, tipoCambioUsd: undefined });
    expect(msg).toMatch(/Captura el tipo de cambio/i);
  });

  it("no aplica la banda a anticipos en MXN", () => {
    expect(errorDeTc({ ...base, moneda: "MXN", tipoCambioUsd: undefined })).toBeUndefined();
  });
});
