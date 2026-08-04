import { describe, it, expect } from "vitest";
import { calcularDiasVencidoFactura, puedeEnviarRecordatorio } from "../facturaAging";

describe("calcularDiasVencidoFactura", () => {
  it("retorna null sin fecha", () => {
    expect(calcularDiasVencidoFactura(null)).toBeNull();
  });

  it("positivo cuando ya venció", () => {
    const hoy = new Date(2026, 6, 10);
    expect(calcularDiasVencidoFactura("2026-07-05", hoy)).toBe(5);
  });

  it("0 cuando vence hoy", () => {
    const hoy = new Date(2026, 6, 10);
    expect(calcularDiasVencidoFactura("2026-07-10", hoy)).toBe(0);
  });

  it("negativo cuando aún no vence", () => {
    const hoy = new Date(2026, 6, 10);
    expect(calcularDiasVencidoFactura("2026-07-15", hoy)).toBe(-5);
  });
});

describe("puedeEnviarRecordatorio", () => {
  it("false si está cancelada", () => {
    expect(puedeEnviarRecordatorio({ saldo: 100, estaCancelada: true })).toBe(false);
  });
  it("false si no hay saldo", () => {
    expect(puedeEnviarRecordatorio({ saldo: 0, estaCancelada: false })).toBe(false);
  });
  it("true con saldo y vigente", () => {
    expect(puedeEnviarRecordatorio({ saldo: 100, estaCancelada: false })).toBe(true);
  });
});
