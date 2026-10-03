import { describe, it, expect } from "vitest";
import { buildKpisFactura } from "../facturaKpis";

const factura = { total: 116, moneda: "MXN", estado: "Emitida", fecha_vencimiento: "2026-10-03", dias_credito: null } satisfies Parameters<typeof buildKpisFactura>[0];
describe("Cobrado distingue dinero recibido de notas de crédito", () => {
  it("NC borrador: cero cobrado y pendiente116", () => {
    const kpis = buildKpisFactura(factura, 116, 0);
    expect(kpis.find((k) => k.label === "Cobrado")?.value).toContain("0.00");
    expect(kpis.find((k) => k.label === "Importe pendiente")?.value).toContain("116.00");
  });
  it("NC aplicada58 reduce pendiente sin reportarse como dinero cobrado", () => {
    const kpis = buildKpisFactura(factura, 58, 0);
    expect(kpis.find((k) => k.label === "Cobrado")?.value).toContain("0.00");
    expect(kpis.find((k) => k.label === "Importe pendiente")?.value).toContain("58.00");
  });
  it("pago20 + NC58: sólo20 cobrado,38 pendientes", () => {
    const kpis = buildKpisFactura(factura, 38, 20);
    expect(kpis.find((k) => k.label === "Cobrado")?.value).toContain("20.00");
    expect(kpis.find((k) => k.label === "Importe pendiente")?.value).toContain("38.00");
  });
});
