/**
 * C26 (v13.823.381) — Lógica pura del aviso de fusión de proformas.
 * Extraída de `TabProformas.tsx` (Power of 10: componente ≤200 líneas) sin
 * cambiar el texto ni el orden de precedencia de los mensajes.
 *
 * El servidor rechaza las mismas condiciones (`LC_PROFORMA_*`); esto sólo
 * evita que el usuario llegue al error.
 */
export interface FusionSeleccionInfo {
  sameCliente: boolean;
  sameTipo: boolean;
  sameDiasCredito: boolean;
}

/** Motivo por el que la selección actual no puede fusionarse, o `null` si sí puede. */
export function avisoFusionSeleccion(info: FusionSeleccionInfo): string | null {
  if (!info.sameCliente) return "Sólo puedes fusionar proformas del mismo cliente.";
  if (!info.sameTipo) {
    return "No puedes fusionar una proforma consolidada con proformas individuales. Convierte cada tipo por separado.";
  }
  if (!info.sameDiasCredito) {
    return "Las proformas tienen plazos de crédito distintos. Iguala el plazo antes de fusionarlas.";
  }
  return null;
}

/** true cuando hay selección y ningún motivo de bloqueo. */
export function puedeFusionarSeleccion(seleccionados: number, info: FusionSeleccionInfo): boolean {
  return seleccionados > 0 && avisoFusionSeleccion(info) === null;
}
