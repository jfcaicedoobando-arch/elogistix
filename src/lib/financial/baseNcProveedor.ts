/** Base explícita neta de impuestos. El total de deuda incluye IVA/IEPS y retenciones. */
export function baseNcProveedor(valor: unknown): number | null {
  if ((typeof valor !== "number" && typeof valor !== "string") || String(valor).trim() === "" || !Number.isFinite(Number(valor)) || Number(valor) < 0) return null;
  return Number(valor);
}

export function avisoNcProveedorSinBase(count: number): string {
  return `Reporte provisional: ${count} nota(s) de crédito de proveedor sin base sin impuestos quedaron fuera del gasto. Los costos y la utilidad están incompletos; no se infieren impuestos ni se modifican datos históricos.`;
}

/** Sólo hereda paridades cuyo denominador coincide con la moneda de la NC. */
export function valuacionNcProveedor(row: Record<string, unknown>, factura: Record<string, unknown>): number | null {
  if (row.moneda === "MXN") return 1;
  const valor = row.tipo_cambio_mxn ?? row.tipo_cambio
    ?? (row.moneda === factura.moneda ? factura.tipo_cambio_usd : null);
  const tc = Number(valor);
  return Number.isFinite(tc) && tc > 0 ? tc : null;
}
