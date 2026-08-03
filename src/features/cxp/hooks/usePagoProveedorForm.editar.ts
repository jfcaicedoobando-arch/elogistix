/**
 * Soporte de edición de un pago a proveedor ya registrado (lógica pura).
 *
 * Al editar, el importe del pago original deja de estar aplicado: para validar
 * y para la vista previa hay que "devolverlo" al saldo de la factura.
 */
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

export interface PagoEditable {
  id: string;
  fecha_pago: string;
  monto: number;
  moneda: Moneda;
  tipo_cambio_usd: number | null;
  metodo_pago: string;
  referencia: string | null;
  notas: string | null;
  cuenta_bancaria_id: string | null;
  diferencia_cambiaria_mxn: number | null;
}

/** Monto del pago original expresado en la moneda de la factura. */
export function montoOriginalEnMonedaFactura(
  pago: PagoEditable | null,
  monedaFactura: string | null | undefined,
): number {
  if (!pago || !monedaFactura) return 0;
  if (pago.moneda === monedaFactura) return pago.monto;
  // Pago en MXN de una factura extranjera: se revierte con su propio TC.
  if (pago.moneda === "MXN" && pago.tipo_cambio_usd && pago.tipo_cambio_usd > 0) {
    return pago.monto / pago.tipo_cambio_usd;
  }
  return pago.monto;
}

/**
 * Saldo y pagado "efectivos" (sin el pago que se está editando), que es la
 * base correcta para validar el nuevo monto y mostrar el antes → después.
 */
export function facturaSinPagoEditado(
  factura: { saldo: number; pagado: number; total: number } | null,
  montoOriginal: number,
): { saldo: number; pagado: number } | null {
  if (!factura) return null;
  return {
    saldo: Math.min(factura.total, factura.saldo + montoOriginal),
    pagado: Math.max(0, factura.pagado - montoOriginal),
  };
}

/** Valores iniciales del formulario cuando se edita un pago existente. */
export function valoresInicialesEdicion(pago: PagoEditable) {
  return {
    fecha: pago.fecha_pago,
    monto: pago.monto.toFixed(2),
    moneda: pago.moneda,
    tc: pago.tipo_cambio_usd ? String(pago.tipo_cambio_usd) : "",
    metodo: pago.metodo_pago,
    referencia: pago.referencia ?? "",
    notas: pago.notas ?? "",
    cuentaId: pago.cuenta_bancaria_id ?? "",
    diffMxn:
      pago.diferencia_cambiaria_mxn != null ? String(pago.diferencia_cambiaria_mxn) : "",
  };
}
