/**
 * Mapeo canónico del modo de transporte del CRM al enum del cotizador.
 *
 * Vivía dentro de `useCrearCotizacionDesdeOportunidad`; se extrajo para que el
 * acceso directo "Nueva cotización" desde una oportunidad de prospecto
 * (CRM-COT-01) use exactamente el mismo mapeo y no invente valores.
 */
export type ModoCotizacion = "Marítimo" | "Aéreo" | "Terrestre" | "Multimodal";

const MODO_MAP: Record<string, ModoCotizacion> = {
  "Marítimo": "Marítimo",
  "Aéreo": "Aéreo",
  "Terrestre": "Terrestre",
  "Multimodal": "Multimodal",
};

/**
 * Devuelve el modo del cotizador equivalente, o `null` si el valor del CRM no
 * corresponde a ninguno (p. ej. "FCL", que es tipo de carga, no modo). Quien
 * necesite un valor obligatorio aplica su propio default explícito.
 */
export function mapModoCrmACotizacion(modo: string | null | undefined): ModoCotizacion | null {
  if (!modo) return null;
  return MODO_MAP[modo] ?? null;
}
