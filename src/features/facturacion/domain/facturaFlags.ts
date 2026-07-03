/**
 * Deriva los flags booleanos que gobiernan la UI del detalle de factura.
 * Se extrae como helper puro para reducir la complejidad ciclomática del
 * route `FacturaDetalle` (Power of 10 #4) y hacerlos testeables.
 */

export interface FacturaFlagsInput {
  estado?: string | null;
  facturapi_id?: string | null;
  uuid_fiscal?: string | null;
}

export interface FacturaFlags {
  sinTimbrar: boolean;
  esBorrador: boolean;
  puedeEditarBorrador: boolean;
  puedeEliminarBorrador: boolean;
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
    };
  }
  const sinTimbrar = !factura.uuid_fiscal;
  const esBorrador = factura.estado === "Borrador" && !factura.facturapi_id;
  const puedeEditarBorrador = esBorrador && canEdit;
  const puedeEliminarBorrador = esBorrador && canEdit;
  return { sinTimbrar, esBorrador, puedeEditarBorrador, puedeEliminarBorrador };
}
