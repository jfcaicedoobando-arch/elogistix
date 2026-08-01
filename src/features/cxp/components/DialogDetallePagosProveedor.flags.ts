/** Banderas derivadas para acciones del diálogo de detalle de factura CxP. */
import type { FacturaCxP } from "@/features/cxp/services";

export interface FacturaFlags {
  aprobada: boolean;
  pagable: boolean;
  puedeEliminar: boolean;
  /** Puede saldarse sin pago real (compensación, quita, etc.). */
  puedeCerrarSinPago: boolean;
}

export function computeFacturaFlags(f: FacturaCxP | null, canEdit: boolean): FacturaFlags {
  if (!f) {
    return { aprobada: false, pagable: false, puedeEliminar: false, puedeCerrarSinPago: false };
  }
  const aprobada = f.estado_aprobacion === "aprobada";
  // P2-2 (R5): el botón "Registrar pago" seguía visible en facturas `Pagada`
  // (riesgo de doble pago) cuando el saldo llegaba desfasado por caché.
  const estadoAdmitePago = f.estado === "Vigente";
  return {
    aprobada,
    pagable: canEdit && estadoAdmitePago && f.saldo > 0,
    puedeEliminar: canEdit && f.pagado <= 0,
    puedeCerrarSinPago: canEdit && aprobada && f.saldo > 0 && f.estado === "Vigente",
  };
}
