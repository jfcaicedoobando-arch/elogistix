/**
 * Importe del documento del Buzón de facturas de proveedor.
 *
 * v13.746.2 — Extraído de `facturasEntrantesBuzon.ts` para respetar el límite
 * de 200 líneas por archivo (Power of 10). Sin cambios de comportamiento.
 */
import type { FilaBuzon } from "./facturasEntrantesTipos";

export interface ImporteEntranteInfo {
  monto: number;
  moneda: string;
  fuente: "cfdi" | "declarado";
  /** true = el importe mostrado incluye impuestos (no hay subtotal disponible). */
  conIva: boolean;
  /** Total con impuestos del CFDI, cuando se conoce (para el desglose). */
  totalConIva: number | null;
}

/**
 * v13.618.0 — Importe del documento con su origen. El CFDI manda; si el
 * proveedor sólo mandó PDF, vale lo que capturó operaciones al subirlo.
 *
 * v13.744.0 — Se muestra el SUBTOTAL (sin IVA), porque todos los costos del
 * ERP se manejan sin IVA. Si el documento es viejo y no tiene subtotal
 * guardado, se muestra el total y se marca `conIva` para avisarlo.
 */
export function importeEntrante(row: FilaBuzon): ImporteEntranteInfo | null {
  const total = Number(row.total_detectado ?? 0);
  const totalConIva = total > 0 ? total : null;
  const subtotal = Number(row.subtotal_detectado ?? 0);
  if (subtotal > 0) {
    return {
      monto: subtotal,
      moneda: row.moneda_detectada ?? "MXN",
      fuente: "cfdi",
      conIva: false,
      totalConIva,
    };
  }
  if (total > 0) {
    return {
      monto: total,
      moneda: row.moneda_detectada ?? "MXN",
      fuente: "cfdi",
      conIva: true,
      totalConIva,
    };
  }
  const declarado = Number(row.monto_declarado ?? 0);
  if (declarado > 0) {
    return {
      monto: declarado,
      moneda: row.moneda_declarada ?? "MXN",
      fuente: "declarado",
      conIva: false,
      totalConIva: null,
    };
  }
  return null;
}
