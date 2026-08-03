/**
 * Cálculo puro de la vista previa del impacto de un pago a proveedor,
 * antes de guardarlo (v13.393.0).
 *
 * Responde dos preguntas del usuario:
 *  1) ¿Cómo queda ESTA factura? (saldo antes/después y estado resultante)
 *  2) ¿Cómo queda el SALDO TOTAL del proveedor en esa moneda?
 *
 * Módulo puro: sin Supabase, sin React. Todo lo que entra son números.
 */

import { roundMoney } from "@/lib/financial/financialUtils";

export type EstadoFacturaTrasPago = "Pagada" | "Parcialmente pagada" | "Vigente";

export interface FacturaImpacto {
  moneda: string;
  saldoAntes: number;
  saldoDespues: number;
  pagadoAntes: number;
  pagadoDespues: number;
  total: number;
  estadoDespues: EstadoFacturaTrasPago;
  liquidaFactura: boolean;
  excede: boolean;
}

export interface ProveedorImpacto {
  moneda: string;
  saldoAntes: number;
  saldoDespues: number;
  facturasAbiertasAntes: number;
  facturasAbiertasDespues: number;
}

export interface SalidaBancoImpacto {
  moneda: string;
  monto: number;
  montoMxn: number | null;
  cuentaEtiqueta: string | null;
}

export interface ImpactoPago {
  factura: FacturaImpacto;
  proveedor: ProveedorImpacto | null;
  banco: SalidaBancoImpacto;
  aplicable: boolean;
}

export interface ParamsImpactoPago {
  factura: {
    moneda: string;
    saldo: number;
    pagado: number;
    total: number;
  } | null;
  /** Monto del pago expresado en la moneda de la factura. */
  montoEnMonedaFactura: number;
  /** Monto tal como se captura (moneda del pago). */
  monto: number;
  monedaPago: string;
  tcNum: number | null;
  bloqueadoPorTc: boolean;
  cuentaEtiqueta: string | null;
  /** Saldos abiertos del proveedor en la moneda de la factura (esta factura incluida). */
  proveedor: {
    saldoTotal: number;
    facturasAbiertas: number;
  } | null;
}

const TOL = 0.01;

function redondear(n: number): number {
  return roundMoney(n);
}

function estadoTrasPago(saldoDespues: number, pagadoDespues: number): EstadoFacturaTrasPago {
  if (saldoDespues <= TOL) return "Pagada";
  if (pagadoDespues > TOL) return "Parcialmente pagada";
  return "Vigente";
}

export function calcularImpactoPago(p: ParamsImpactoPago): ImpactoPago | null {
  if (!p.factura) return null;

  const aplicable = p.montoEnMonedaFactura > 0 && !p.bloqueadoPorTc;
  const aplicado = aplicable ? p.montoEnMonedaFactura : 0;

  const saldoAntes = redondear(p.factura.saldo);
  const pagadoAntes = redondear(p.factura.pagado);
  const saldoDespues = redondear(Math.max(0, saldoAntes - aplicado));
  const pagadoDespues = redondear(pagadoAntes + Math.min(aplicado, saldoAntes));

  const factura: FacturaImpacto = {
    moneda: p.factura.moneda,
    saldoAntes,
    saldoDespues,
    pagadoAntes,
    pagadoDespues,
    total: redondear(p.factura.total),
    estadoDespues: estadoTrasPago(saldoDespues, pagadoDespues),
    liquidaFactura: aplicable && saldoDespues <= TOL,
    excede: aplicado > saldoAntes + TOL,
  };

  const proveedor: ProveedorImpacto | null = p.proveedor
    ? {
        moneda: p.factura.moneda,
        saldoAntes: redondear(p.proveedor.saldoTotal),
        saldoDespues: redondear(
          Math.max(0, p.proveedor.saldoTotal - Math.min(aplicado, saldoAntes)),
        ),
        facturasAbiertasAntes: p.proveedor.facturasAbiertas,
        facturasAbiertasDespues: Math.max(
          0,
          p.proveedor.facturasAbiertas - (factura.liquidaFactura ? 1 : 0),
        ),
      }
    : null;

  const banco: SalidaBancoImpacto = {
    moneda: p.monedaPago,
    monto: redondear(p.monto),
    montoMxn:
      p.monedaPago === "MXN"
        ? redondear(p.monto)
        : p.tcNum
          ? redondear(p.monto * p.tcNum)
          : null,
    cuentaEtiqueta: p.cuentaEtiqueta,
  };

  return { factura, proveedor, banco, aplicable };
}
