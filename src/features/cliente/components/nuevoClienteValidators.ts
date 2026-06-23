/**
 * Validaciones estructurales (no de dígito verificador) para campos del alta de cliente.
 * Funciones puras separadas para que `NuevoClienteFormPieces.tsx` exporte sólo componentes
 * (cumple con la regla react-refresh/only-export-components).
 */
const RFC_RX = /^([A-ZÑ&]{3,4})\d{6}([A-Z0-9]{2,3})$/i;

/** True si el RFC tiene la forma estructural correcta. */
export function rfcLooksValid(rfc: string): boolean {
  return RFC_RX.test(rfc.trim());
}

/** True cuando el CP son exactamente 5 dígitos. */
export function cpLooksValid(cp: string): boolean {
  return /^\d{5}$/.test(cp.trim());
}
