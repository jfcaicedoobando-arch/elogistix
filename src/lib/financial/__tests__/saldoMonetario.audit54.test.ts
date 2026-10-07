import { describe, expect, it } from "vitest";
import { tieneSaldoMonetario } from "../toleranciaPago";
import { calcularSaldoFactura } from "../saldoFactura";
import { deriveFacturaFlags } from "@/features/facturacion/domain/facturaFlags";
import { puedeEnviarRecordatorio } from "@/features/facturacion/domain/facturaAging";
import { calcularAging } from "@/features/facturacion/estadoCuenta/services/estadoCuentaAging";
import { calcularKpisEstadoCuenta } from "@/features/facturacion/estadoCuenta/services/estadoCuentaAggregates";
import { calcularEstatus } from "@/features/facturacion/estadoCuenta/services/estadoCuentaTypes";
import { calcularKPIs } from "@/features/facturacion/services/cobranzaAggregates";
import type { FacturaEstadoCuenta } from "@/features/facturacion/estadoCuenta/services/estadoCuenta";

const fila = (saldo: number): FacturaEstadoCuenta => ({
  id: String(saldo), numero: "AUD54", cliente_id: "cliente", cliente_nombre: "Ficticio", expediente: "EXP",
  moneda: "MXN", total: 1.16, pagado: 1.16 - saldo, notas_credito_aplicadas: 0, saldo,
  fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-02", dias_vencido: 1,
  estatus_cobranza: calcularEstatus(saldo, 1, "Pagada"), estado_factura: "Pagada", pagos: [], notas_credito: [],
});

describe("AUD54: deuda monetaria real", () => {
  it.each([
    { saldo: 0, cobrable: false }, { saldo: -0.01, cobrable: false },
    { saldo: 0.0000000000000001, cobrable: false }, { saldo: 0.0049, cobrable: false },
    { saldo: 0.005, cobrable: true }, { saldo: 0.0099, cobrable: true }, { saldo: 0.01, cobrable: true },
  ])("redondeo monetario: $saldo cobrable=$cobrable", ({ saldo, cobrable }) => {
    expect(tieneSaldoMonetario(saldo)).toBe(cobrable);
    const resultado = calcularSaldoFactura(1.16, [], [], "Pagada", saldo);
    expect(resultado.liquidada).toBe(!cobrable);
    expect(resultado.saldo).toBe(Math.max(0, saldo));
    expect(puedeEnviarRecordatorio({ saldo, estaCancelada: false })).toBe(cobrable);
    expect(puedeEnviarRecordatorio({ saldo, estaCancelada: true })).toBe(false);
  });
  it("resta con Decimal antes del empate y absorbe ruido flotante de cierre", () => {
    expect(tieneSaldoMonetario(1.16, 1.155)).toBe(true);
    expect(tieneSaldoMonetario(1.16, 1.1551)).toBe(false);
    expect(tieneSaldoMonetario(0.1 + 0.2, 0.3)).toBe(false);
  });
  it("saldo exacto, estado derivado, conteos y sumas conservan el centavo A8", () => {
    const rows = [fila(0.01), fila(0.0049), fila(0.005), fila(0)];
    const kpis = calcularKpisEstadoCuenta(rows);
    const aging = calcularAging(rows);
    const cobranza = calcularKPIs(rows.map((f) => ({ ...f, tipo_cambio: 1 })));
    expect(rows[0].estatus_cobranza).toBe("Vencida");
    expect(kpis.facturasAdeudadas).toBe(2);
    expect(kpis.facturasVencidas).toBe(2);
    expect(kpis.adeudado.mxn).toBe(0.02);
    expect(kpis.vencido.mxn).toBe(0.02);
    expect(aging.reduce((s, b) => s + b.conteo, 0)).toBe(2);
    expect(aging.find((b) => b.id === "d_1_30")?.mxn).toBe(0.02);
    expect(cobranza.total_mxn).toBe(0.02);
    expect(cobranza.facturas_vencidas).toBe(2);
  });
  it("PPD documentado permite cobrar un centavo aunque conserve etiqueta histórica Pagada", () => {
    expect(deriveFacturaFlags({ estado: "Pagada", metodo_pago: "PPD" }, true,
      { saldo: .01, pagosActivos: 1 }).puedeRegistrarPago).toBe(true);
    expect(deriveFacturaFlags({ estado: "Parcialmente pagada", metodo_pago: "PPD" }, true,
      { saldo: .01, pagosActivos: 1 }).puedeRegistrarPago).toBe(true);
  });
  it.each(["Pagada", "Parcialmente pagada"])("PUE %s con pago previo se revisa, no cobra segunda exhibición", (estado) => {
    expect(deriveFacturaFlags({ estado, metodo_pago: "PUE" }, true,
      { saldo: .01, pagosActivos: 1 }).puedeRegistrarPago).toBe(false);
  });
  it("no reabre Pagada sin evidencia, ni permite cobro cancelado o lectura fallida", () => {
    expect(deriveFacturaFlags({ estado: "Pagada", metodo_pago: "PPD" }, true,
      { saldo: 1.16, pagosActivos: 0 }).puedeRegistrarPago).toBe(false);
    for (const estado of ["Cancelada", "Sustituida", "Borrador"]) {
      expect(deriveFacturaFlags({ estado, metodo_pago: "PPD" }, true,
        { saldo: .01, pagosActivos: 1 }).puedeRegistrarPago).toBe(false);
    }
    expect(deriveFacturaFlags({ estado: "Pagada", metodo_pago: "PPD" }, true,
      { saldo: .01, pagosActivos: 1, saldoError: true }).puedeRegistrarPago).toBe(false);
  });
});
