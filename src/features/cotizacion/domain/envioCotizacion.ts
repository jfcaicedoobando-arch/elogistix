/**
 * Reglas de ciclo de vida del envío de cotizaciones por correo.
 *
 * v13.823.355 (YAGNI r2 · P1) — espejo EXACTO de los candados de la edge
 * function `enviar-cotizacion-email`: prospecto sin oportunidad ligada y
 * estados terminales no vigentes no se envían ni se reenvían. Enviada y
 * Aceptada sí (reenvío legítimo del contrato vigente).
 */
export const ESTADOS_NO_ENVIABLES = ["Rechazada", "Vencida", "Archivada"] as const;

export interface CotizacionEnviable {
  estado?: string | null;
  es_prospecto?: boolean | null;
  oportunidad_id?: string | null;
}

export function cotizacionEnviablePorCorreo(cot: CotizacionEnviable): boolean {
  if (cot.es_prospecto && !cot.oportunidad_id) return false;
  return !(ESTADOS_NO_ENVIABLES as readonly string[]).includes(String(cot.estado ?? ""));
}
