import { describe, it, expect } from "vitest";
import { FACTURA_ESTADOS_VIVOS, resolverEstadoFacturaCliente } from "../estadosFactura";

/**
 * B-083: una sola clasificación de estado para el cliente en todo el portal
 * (estado de cuenta, listado y detalle).
 */
describe("resolverEstadoFacturaCliente (B-083)", () => {
  const hoy = "2026-07-28";

  it("deriva 'Vencida' para Emitida con vencimiento pasado", () => {
    expect(resolverEstadoFacturaCliente("Emitida", "2026-07-27", hoy)).toBe("Vencida");
  });

  it("deriva 'Vencida' para Parcialmente pagada con vencimiento pasado", () => {
    expect(resolverEstadoFacturaCliente("Parcialmente pagada", "2026-01-01", hoy)).toBe("Vencida");
  });

  it("no vence el mismo día del vencimiento (date-only, sin hora)", () => {
    expect(resolverEstadoFacturaCliente("Emitida", hoy, hoy)).toBe("Emitida");
  });

  it("respeta estados terminales aunque la fecha haya pasado", () => {
    expect(resolverEstadoFacturaCliente("Pagada", "2020-01-01", hoy)).toBe("Pagada");
    expect(resolverEstadoFacturaCliente("Cancelada", "2020-01-01", hoy)).toBe("Cancelada");
    expect(resolverEstadoFacturaCliente("Sustituida", "2020-01-01", hoy)).toBe("Sustituida");
    expect(resolverEstadoFacturaCliente("Borrador", "2020-01-01", hoy)).toBe("Borrador");
  });

  it("sin fecha de vencimiento devuelve el estado crudo", () => {
    expect(resolverEstadoFacturaCliente("Emitida", null, hoy)).toBe("Emitida");
    expect(resolverEstadoFacturaCliente("Emitida", undefined, hoy)).toBe("Emitida");
  });

  it("los estados vivos excluyen Borrador, Cancelada y Sustituida", () => {
    expect(FACTURA_ESTADOS_VIVOS).toEqual(["Emitida", "Pagada", "Parcialmente pagada", "Vencida"]);
  });
});
