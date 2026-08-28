/**
 * Ola E3 · Sub-ola C · N1 — Notas de crédito en el saldo anterior del REP.
 *
 * El saldo anterior (ImpSaldoAnt) del complemento de pago debe ser
 * `total − pagos previos − notas de crédito aplicadas`, todo en la moneda del
 * documento relacionado. Antes sólo se restaban los pagos previos: si la
 * factura llevaba una NC intermedia, el REP declaraba un saldo inflado
 * (como cobrar una cuenta ignorando la devolución que ya se hizo).
 *
 * La cascada de conversión es la misma que `public.nc_aplicadas_en_moneda_factura`:
 * si la NC no se puede convertir por falta de tipo de cambio, NO se resta
 * (preferimos un saldo mayor a declarar uno menor al real).
 */

export interface NotaCreditoRow {
  monto?: number | string | null;
  moneda?: string | null;
  tipo_cambio?: number | string | null;
  estado?: string | null;
  fecha_emision?: string | null;
  deleted_at?: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function convertir(
  monto: number,
  monedaNc: string,
  tcNc: number,
  monedaFactura: string,
  tcFactura: number,
): number {
  if (monedaNc === monedaFactura) return monto;
  if (monedaFactura === "MXN" && tcNc > 1) return monto * tcNc;
  if (monedaNc === "MXN" && tcFactura > 1) return monto / tcFactura;
  if (tcNc > 1 && tcFactura > 1) return (monto * tcNc) / tcFactura;
  return 0;
}

/**
 * Suma de notas de crédito aplicadas (opcionalmente hasta una fecha) expresada
 * en la moneda de la factura.
 */
export function ncAplicadasEnMonedaFactura(
  ncs: NotaCreditoRow[] | null | undefined,
  monedaFactura: string,
  tipoCambioFactura: number,
  hastaFecha?: string | null,
): number {
  const corte = hastaFecha ? String(hastaFecha).slice(0, 10) : null;
  let total = 0;
  for (const nc of ncs ?? []) {
    if (nc.deleted_at) continue;
    if (String(nc.estado ?? "") !== "Aplicada") continue;
    if (corte && nc.fecha_emision && String(nc.fecha_emision).slice(0, 10) > corte) continue;
    const monto = Number(nc.monto ?? 0);
    if (!Number.isFinite(monto) || monto <= 0) continue;
    total += convertir(
      monto,
      String(nc.moneda ?? monedaFactura),
      Number(nc.tipo_cambio ?? 0),
      monedaFactura,
      Number(tipoCambioFactura ?? 1),
    );
  }
  return round2(total);
}
