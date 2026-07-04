/**
 * Deriva los flags booleanos que gobiernan la UI del detalle de factura.
 * Se extrae como helper puro para reducir la complejidad ciclomática del
 * route `FacturaDetalle` (Power of 10 #4) y hacerlos testeables.
 */

/**
 * Fecha a partir de la cual el sistema tuvo capacidad de timbrar CFDI.
 * Facturas creadas antes de este corte fueron timbradas directamente en
 * el portal del SAT, por lo que no se puede/debe re-timbrar desde la app.
 */
export const FECHA_INICIO_TIMBRADO_SISTEMA = "2026-07-01T00:00:00Z";

export interface FacturaFlagsInput {
  estado?: string | null;
  facturapi_id?: string | null;
  uuid_fiscal?: string | null;
  created_at?: string | null;
}

export interface FacturaFlags {
  sinTimbrar: boolean;
  esBorrador: boolean;
  puedeEditarBorrador: boolean;
  puedeEliminarBorrador: boolean;
  /**
   * True sólo si la factura aún no está timbrada Y fue creada después de
   * que el sistema tuvo capacidad de timbrar. Las facturas legacy
   * (creadas antes del corte) se timbraron fuera del sistema.
   */
  puedeTimbrarDesdeSistema: boolean;
}

export function deriveFacturaFlags(
  factura: FacturaFlagsInput | null | undefined,
  canEdit: boolean,
): FacturaFlags {
  if (!factura) {
    return {
      sinTimbrar: false,
      esBorrador: false,
      puedeEditarBorrador: false,
      puedeEliminarBorrador: false,
      puedeTimbrarDesdeSistema: false,
    };
  }
  const sinTimbrar = !factura.uuid_fiscal;
  const esBorrador = factura.estado === "Borrador" && !factura.facturapi_id;
  const puedeEditarBorrador = esBorrador && canEdit;
  const puedeEliminarBorrador = esBorrador && canEdit;
  const puedeTimbrarDesdeSistema =
    sinTimbrar && esCreadaConCapacidadTimbrado(factura.created_at);
  return {
    sinTimbrar,
    esBorrador,
    puedeEditarBorrador,
    puedeEliminarBorrador,
    puedeTimbrarDesdeSistema,
  };
}

/**
 * Helper reutilizable por listas/tablas donde no se necesita el resto de
 * flags: indica si una factura fue creada dentro de la ventana en que el
 * sistema puede timbrar (post 01/07/2026).
 */
export function esCreadaConCapacidadTimbrado(
  createdAt: string | null | undefined,
): boolean {
  if (!createdAt) return false;
  return createdAt >= FECHA_INICIO_TIMBRADO_SISTEMA;
}
