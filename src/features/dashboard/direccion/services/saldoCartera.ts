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
import { mxnFactura } from "./mxn";
import type { FacturaRow, NotaCreditoRow, PagoRow } from "./loaders";

type MonedaLike = string | null | undefined;

const norm = (m: MonedaLike): string => (m ?? "MXN").toUpperCase();
const tcValido = (tc: number | null | undefined): boolean => Number(tc ?? 0) > 1;

/**
 * Monto de una NC expresado en la moneda de la factura (espejo de
 * `nc_aplicadas_en_moneda_factura`). Devuelve 0 cuando el canon devuelve 0.
 */
export function ncEnMonedaFactura(
  nc: Pick<NotaCreditoRow, "monto" | "moneda" | "tipo_cambio">,
  monedaFactura: MonedaLike,
  tcFactura: number | null | undefined,
): number {
  const monto = Number(nc.monto ?? 0);
  const mf = norm(monedaFactura);
  const mn = norm(nc.moneda);
  if (mn === mf) return monto;
  if (mf === "MXN" && mn !== "MXN") return tcValido(nc.tipo_cambio) ? monto * Number(nc.tipo_cambio) : 0;
  if (mf !== "MXN" && mn === "MXN") return tcValido(tcFactura) ? monto / Number(tcFactura) : 0;
  // Cruzada divisa↔divisa: exige AMBOS tipos de cambio.
  if (tcValido(nc.tipo_cambio) && tcValido(tcFactura)) {
    return (monto * Number(nc.tipo_cambio)) / Number(tcFactura);
  }
  return 0;
}

/** Saldo de la factura EN SU PROPIA MONEDA: total − pagos aplicados − NC aplicadas. */
export function saldoEnMonedaFactura(
  factura: Pick<FacturaRow, "total" | "moneda" | "tipo_cambio">,
  pagos: readonly Pick<PagoRow, "monto_aplicado_factura">[],
  ncs: readonly Pick<NotaCreditoRow, "monto" | "moneda" | "tipo_cambio">[],
): number {
  let saldo = Number(factura.total ?? 0);
  for (const p of pagos) saldo -= Number(p.monto_aplicado_factura ?? 0);
  for (const nc of ncs) saldo -= ncEnMonedaFactura(nc, factura.moneda, factura.tipo_cambio);
  return saldo;
}

/**
 * Saldo MXN equivalente por factura (id → MXN). Las NC en borrador,
 * canceladas o eliminadas no llegan aquí: el loader ya las filtra.
 */
export function calcularSaldosCarteraMxn(
  facturas: readonly FacturaRow[],
  pagos: readonly PagoRow[],
  ncs: readonly NotaCreditoRow[],
  fallbackUsd: number,
): Map<string, number> {
  const pagosPorFactura = agrupar(pagos);
  const ncsPorFactura = agrupar(ncs);
  const saldos = new Map<string, number>();
  for (const f of facturas) {
    if (f.estado === "Cancelada") continue;
    const neto = saldoEnMonedaFactura(f, pagosPorFactura.get(f.id) ?? [], ncsPorFactura.get(f.id) ?? []);
    saldos.set(f.id, mxnFactura(neto, f.moneda, f.tipo_cambio, fallbackUsd));
  }
  return saldos;
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
