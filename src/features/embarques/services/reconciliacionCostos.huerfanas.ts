/** Una línea fiscal sin costo puede coexistir con el vínculo operativo de su factura. */
export interface PartidaParaHuerfanas {
  proveedor_factura_id: string;
  concepto_costo_id: string | null;
  conceptos_costo: { embarque_id: string | null; deleted_at: string | null } | null;
}

export function contarPartidasHuerfanas(rows: PartidaParaHuerfanas[], embarqueId: string): number {
  const valido = (row: PartidaParaHuerfanas) => Boolean(
    row.concepto_costo_id && row.conceptos_costo?.embarque_id === embarqueId && !row.conceptos_costo.deleted_at,
  );
  const facturasVinculadas = new Set(rows.filter(valido).map((row) => row.proveedor_factura_id));
  return rows.filter((row) => row.concepto_costo_id
    ? !valido(row)
    : !facturasVinculadas.has(row.proveedor_factura_id)).length;
}
