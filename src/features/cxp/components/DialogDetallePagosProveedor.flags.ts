/** Banderas derivadas para acciones del diálogo de detalle de factura CxP. */
import type { FacturaCxP } from "@/features/cxp/services";

export interface FacturaFlags {
  aprobada: boolean;
  pagable: boolean;
  puedeEliminar: boolean;
}

export function computeFacturaFlags(f: FacturaCxP | null, canEdit: boolean): FacturaFlags {
  if (!f) return { aprobada: false, pagable: false, puedeEliminar: false };
  return {
    aprobada: f.estado_aprobacion === "aprobada",
    pagable: canEdit && f.saldo > 0 && f.estado !== "Borrador",
    puedeEliminar: canEdit && f.pagado <= 0,
  };
}
