import { describe, it, expect, vi } from "vitest";
import { calcularKPIsCxP } from "../cxpKpis";
import { resumirTarjetasCxP } from "../cxpKpiConteos";
import { diasVencido, clasificar } from "../proveedorFacturas.helpers";
import type { FacturaCxP } from "../proveedorFacturas";

const factura = (fecha_vencimiento: string, saldo: number): FacturaCxP => ({
  id: fecha_vencimiento, moneda: "USD", saldo, fecha_vencimiento,
  dias_vencido: 0, estatus: "Por vencer", fecha_programada_pago: null,
} as FacturaCxP);

describe("CxP usa el día de negocio CDMX", () => {
  it.each([
    { ahora: "2026-10-04T05:59:59Z", dias: 0, vencido: 700, porVencer: 95, vencidasN: 1, porVencerN: 1, estatus: "Por vencer" },
    { ahora: "2026-10-04T06:00:00Z", dias: 1, vencido: 795, porVencer: 0, vencidasN: 2, porVencerN: 0, estatus: "Vencida" },
  ] as const)("conteos, importes y etiqueta coinciden a $ahora", ({ ahora, dias, vencido, porVencer, vencidasN, porVencerN, estatus }) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(ahora));
    const rows = [factura("2026-09-27", 700), factura("2026-10-03", 95)];
    const k = calcularKPIsCxP(rows);
    const c = resumirTarjetasCxP(rows);
    expect(diasVencido("2026-10-03")).toBe(dias);
    expect(clasificar(95, 0, diasVencido("2026-10-03"), "Vigente", "aprobada")).toBe(estatus);
    expect(k.vencido_usd).toBe(vencido);
    expect(k.por_vencer_7d_usd).toBe(porVencer);
    expect(k.facturas_vencidas).toBe(vencidasN);
    expect(c.vencidasN).toBe(vencidasN);
    expect(c.porVencerN).toBe(porVencerN);
  });
  it("usa el mismo corte explícito aun con días cacheados contradictorios", () => {
    const rows = [factura("2026-10-03", 95), { ...factura("2026-10-10", 20), dias_vencido: 5 }];
    expect(calcularKPIsCxP(rows, "2026-10-04")).toMatchObject({ vencido_usd: 95, por_vencer_7d_usd: 20, facturas_vencidas: 1 });
    expect(resumirTarjetasCxP(rows, "2026-10-04")).toMatchObject({ vencidasN: 1, porVencerN: 1 });
  });
});
