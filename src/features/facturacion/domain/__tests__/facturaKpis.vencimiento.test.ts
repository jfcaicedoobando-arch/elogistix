import { afterEach, describe, expect, it, vi } from "vitest";
import { buildKpisFactura } from "../facturaKpis";

const factura = { total: 100, moneda: "MXN", estado: "Emitida", fecha_vencimiento: "2026-10-03", dias_credito: 0 } satisfies Parameters<typeof buildKpisFactura>[0];
afterEach(() => vi.useRealTimers());
describe("Audit142: antigüedad real del documento", () => {
  it.each(["Emitida", "Vencida", "Parcialmente pagada"] as const)("%s mantiene los tres días reales con saldo", (estado) => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-06T16:00:00Z"));
    expect(buildKpisFactura({ ...factura, estado }, 58)[3]).toMatchObject({ hint: "3 días de atraso", tone: "destructive" });
  });
  it.each([["2026-10-06", 0], ["2026-10-05", 1], ["2026-09-06", 30], ["2026-09-05", 31], ["2026-08-07", 60]] as const)("calcula %s a %i días", (fecha_vencimiento, dias) => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-06T16:00:00Z"));
    expect(buildKpisFactura({ ...factura, fecha_vencimiento }, 50)[3].hint).toBe(dias ? `${dias} ${dias === 1 ? "día" : "días"} de atraso` : "0 días de crédito");
  });
  it("usa día de negocio México al cruzar medianoche UTC", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-07T02:00:00Z"));
    expect(buildKpisFactura(factura, 50)[3].hint).toBe("3 días de atraso");
  });
  it("no clasifica como atrasada una saldada, cancelada, borrador o sin vencimiento", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-06T16:00:00Z"));
    for (const [doc, saldo] of [[factura, 0], [{ ...factura, estado: "Cancelada" }, 100], [{ ...factura, estado: "Borrador" }, 100], [{ ...factura, fecha_vencimiento: null }, 100]] as const) {
      expect(buildKpisFactura(doc, saldo)[3].tone).toBe("default");
    }
  });
});
