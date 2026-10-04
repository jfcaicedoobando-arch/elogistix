/** Presentación de cobros sin base de comisión; no recalcula ni modifica históricos. */
interface BaseComision {
  embarque_id: string | null;
  estado: string;
  comision_mxn: number;
}

export function comisionSinEmbarque(row: BaseComision): boolean {
  return row.embarque_id === null && row.estado === "Devengada" && row.comision_mxn === 0;
}

export interface PagoCobrado {
  monto: number | string | null;
  moneda: string;
  monto_aplicado_factura: number | string | null;
  deleted_at: string | null;
  estado_rep: string;
}

function importeConocido(value: number | string | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const importe = Number(value);
  return Number.isFinite(importe) && importe >= 0 ? importe : null;
}

/** Sólo importes documentados en MXN. Sin conversión actual ni TC supuesto. */
export function cobroSinEmbarqueMxn(pago: PagoCobrado | null, monedaFactura?: string): number | null {
  if (!pago || pago.deleted_at || pago.estado_rep === "Cancelado") return null;
  if (pago.moneda === "MXN") return importeConocido(pago.monto);
  if (monedaFactura === "MXN") return importeConocido(pago.monto_aplicado_factura);
  return null;
}
