/**
 * ¿Un concepto del embarque sigue siendo editable?
 *
 * La RPC `actualizar_embarque_completo` filtra los renglones ya facturados o
 * ya pagados en su `UPDATE`/soft-delete, así que el guardado los ignora en
 * silencio y la UI mostraba "guardado correctamente". Estos predicados
 * replican EXACTAMENTE esas condiciones para poder deshabilitar la fila y
 * evitar la edición fantasma.
 *
 *  - Venta:  `estado_facturacion IN ('pendiente','en_proforma')`
 *  - Costo:  `estado_liquidacion <> 'Pagado'`
 */

const VENTA_EDITABLE = new Set(["pendiente", "en_proforma"]);

export function ventaBloqueada(estadoFacturacion?: string | null): boolean {
  const estado = (estadoFacturacion ?? "pendiente").trim().toLowerCase();
  return !VENTA_EDITABLE.has(estado);
}

export function costoBloqueado(estadoLiquidacion?: string | null): boolean {
  return (estadoLiquidacion ?? "").trim().toLowerCase() === "pagado";
}

export const MOTIVO_VENTA_BLOQUEADA =
  "Este concepto ya está facturado: no se puede editar ni eliminar desde el embarque.";

export const MOTIVO_COSTO_BLOQUEADO =
  "Este costo ya está pagado: no se puede editar ni eliminar desde el embarque.";
