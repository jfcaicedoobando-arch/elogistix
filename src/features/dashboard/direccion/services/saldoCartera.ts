/**
 * Saldo de cartera por factura — espejo EXACTO del canon de Cobranza.
 *
 * Canon (SQL): `saldo = total − Σ pagos_factura.monto_aplicado_factura − nc_aplicadas_en_moneda_factura(factura)`
 * y todo se calcula EN LA MONEDA DE LA FACTURA:
 *  - `monto_aplicado_factura` ya viene convertido a moneda de factura por
 *    `tg_pagos_factura_monto_convertido`; NO se vuelve a convertir con la
 *    moneda/TC del pago (eso causaba doble conversión).
 *  - las NC se convierten a moneda de factura con las mismas reglas que
 *    `public.nc_aplicadas_en_moneda_factura`: si falta un TC requerido para
 *    una conversión cruzada, la NC aporta 0 (no se inventa fallback).
 * Sólo el saldo NETO resultante se convierte a MXN con el TC de la factura.
 */
import Decimal from "decimal.js";
import { calcularSaldoFactura, esEstadoSinSaldo } from "@/lib/financial/saldoFactura";
import { tcConfiable } from "@/lib/financial/convertir";
import { roundMoney } from "@/lib/financial/financialUtils";
import { mxnFactura, type TcFallbacks } from "./mxn";
import type { FacturaRow, NotaCreditoRow, PagoRow } from "./loaders";

type MonedaLike = string | null | undefined;

const norm = (m: MonedaLike): string => (m ?? "MXN").toUpperCase();

/**
 * Monto de una NC expresado en la moneda de la factura (espejo de
 * `nc_aplicadas_en_moneda_factura`). Devuelve 0 cuando el canon devuelve 0.
 */
export function ncEnMonedaFactura(
  nc: Pick<NotaCreditoRow, "monto" | "moneda" | "tipo_cambio">,
  monedaFactura: MonedaLike,
  tcFactura: number | null | undefined,
): number {
  const monto = new Decimal(nc.monto ?? 0);
  const mf = norm(monedaFactura);
  const mn = norm(nc.moneda);
  if (mn === mf) return monto.toNumber();
  const origen = tcConfiable(nc.tipo_cambio);
  const destino = tcConfiable(tcFactura);
  if (mf === "MXN" && mn !== "MXN") return origen == null ? 0 : monto.times(origen).toNumber();
  if (mf !== "MXN" && mn === "MXN") return destino == null ? 0 : monto.dividedBy(destino).toNumber();
  // Cruzada divisa↔divisa: exige AMBOS tipos de cambio.
  if (origen != null && destino != null) {
    return monto.times(origen).dividedBy(destino).toNumber();
  }
  return 0;
}

/**
 * Saldo de la factura EN SU PROPIA MONEDA: total − pagos VIGENTES − NC aplicadas.
 * Ola v17: los pagos con REP cancelado están ANULADOS (canon `esPagoAnulado` /
 * `public.pago_rep_anulado`); antes se sumaban y la cartera de Dirección
 * mostraba menos adeudo que Portal, Cobranza y Estado de Cuenta.
 */
export function saldoEnMonedaFactura(
  factura: Pick<FacturaRow, "total" | "moneda" | "tipo_cambio">,
  pagos: readonly Pick<PagoRow, "monto_aplicado_factura" | "estado_rep">[],
  ncs: readonly Pick<NotaCreditoRow, "monto" | "moneda" | "tipo_cambio">[],
): number {
  return calcularSaldoFactura(
    factura.total ?? 0, pagos,
    ncs.map((nc) => ({ monto: ncEnMonedaFactura(nc, factura.moneda, factura.tipo_cambio) })),
  ).saldo;
}

export interface SaldoCartera {
  /** Saldo exacto en moneda documental; se clasifica antes de convertir. */
  saldo: number;
  tieneSaldo: boolean;
  monto_mxn: number;
}

/**
 * Clasificación nativa y saldo MXN equivalente por factura. Las NC en borrador,
 * canceladas o eliminadas no llegan aquí: el loader ya las filtra.
 * AUD54: Pagada sin aplicaciones activas positivas conserva su ámbito legado.
 * El estado persistido, los pagos y los saldos exactos no se reescriben.
 */
export function calcularSaldosCartera(
  facturas: readonly FacturaRow[],
  pagos: readonly PagoRow[],
  ncs: readonly NotaCreditoRow[],
  fallbacks: TcFallbacks,
): Map<string, SaldoCartera> {
  const pagosPorFactura = agrupar(pagos);
  const ncsPorFactura = agrupar(ncs);
  const saldos = new Map<string, SaldoCartera>();
  for (const f of facturas) {
    if (esEstadoSinSaldo(f.estado)) continue;
    const resultado = calcularSaldoFactura(
      f.total ?? 0, pagosPorFactura.get(f.id) ?? [],
      (ncsPorFactura.get(f.id) ?? []).map((nc) => ({ monto: ncEnMonedaFactura(nc, f.moneda, f.tipo_cambio) })),
      f.estado,
    );
    if (f.estado === "Pagada" && resultado.pagado <= 0) continue;
    saldos.set(f.id, {
      saldo: resultado.saldo, tieneSaldo: !resultado.liquidada,
      monto_mxn: roundMoney(mxnFactura(resultado.saldo, f.moneda, f.tipo_cambio, fallbacks)),
    });
  }
  return saldos;
}

/** Compatibilidad para lectores que sólo necesitan la valuación existente. */
export function calcularSaldosCarteraMxn(
  facturas: readonly FacturaRow[], pagos: readonly PagoRow[],
  ncs: readonly NotaCreditoRow[], fallbacks: TcFallbacks,
): Map<string, number> {
  return new Map(Array.from(calcularSaldosCartera(facturas, pagos, ncs, fallbacks),
    ([id, resultado]) => [id, resultado.monto_mxn]));
}

function agrupar<T extends { factura_id: string }>(filas: readonly T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const fila of filas) {
    const actual = mapa.get(fila.factura_id);
    if (actual) actual.push(fila);
    else mapa.set(fila.factura_id, [fila]);
  }
  return mapa;
}
