/**
 * Helpers puros para propagar Expediente + BL Master + BL House al CFDI.
 *
 * Se usan en `facturapi-emitir`, `facturapi-emitir-nota-credito` y
 * `facturapi-emitir-rep` para que:
 *  - Cada concepto lleve un prefijo compacto con las referencias en su
 *    `description` (queda impreso en el XML SAT — fuente de verdad legal).
 *  - El PDF de FacturAPI incluya un bloque "Referencias" al pie usando
 *    `pdf_custom_section`.
 *
 * Aplica el guardrail SAT: la descripción del CFDI admite hasta 1000
 * caracteres. Truncamos la parte original con "…" si al agregar el
 * prefijo excedemos el límite (dejamos margen de 10 char).
 */

export interface ReferenciasEmbarque {
  expediente?: string | null;
  bl_master?: string | null;
  bl_house?: string | null;
}

/** Devuelve `true` si al menos un dato de referencia tiene valor útil. */
export function hasReferencias(ref: ReferenciasEmbarque | null | undefined): boolean {
  if (!ref) return false;
  return Boolean(
    (ref.expediente && String(ref.expediente).trim()) ||
    (ref.bl_master && String(ref.bl_master).trim()) ||
    (ref.bl_house && String(ref.bl_house).trim()),
  );
}

/** Prefijo compacto que se antepone a la descripción del concepto. */
export function buildDescripcionPrefix(ref: ReferenciasEmbarque | null | undefined): string {
  if (!hasReferencias(ref)) return "";
  const parts: string[] = [];
  const exp = ref?.expediente?.trim();
  const master = ref?.bl_master?.trim();
  const house = ref?.bl_house?.trim();
  if (exp) parts.push(`Exp. ${exp}`);
  if (master) parts.push(`BL/M: ${master}`);
  if (house) parts.push(`BL/H: ${house}`);
  return `[${parts.join(" · ")}] `;
}

const CFDI_DESCRIPTION_MAX = 1000;

/**
 * Prepende el prefijo de referencias a la descripción, truncando la parte
 * original con "…" si es necesario para respetar el máximo de 1000 char
 * del CFDI 4.0.
 */
export function formatDescripcionConReferencias(
  descripcion: string,
  ref: ReferenciasEmbarque | null | undefined,
): string {
  const prefix = buildDescripcionPrefix(ref);
  if (!prefix) return descripcion;
  const combined = `${prefix}${descripcion}`;
  if (combined.length <= CFDI_DESCRIPTION_MAX) return combined;
  const room = CFDI_DESCRIPTION_MAX - prefix.length - 1; // 1 para "…"
  if (room <= 0) return combined.slice(0, CFDI_DESCRIPTION_MAX);
  return `${prefix}${descripcion.slice(0, room)}…`;
}

/** Escapa caracteres HTML para inyección segura en `pdf_custom_section`. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * HTML mínimo para el bloque "Referencias del embarque" en el PDF de
 * FacturAPI. Devuelve cadena vacía si no hay ningún dato.
 */
export function buildPdfCustomSection(ref: ReferenciasEmbarque | null | undefined): string {
  if (!hasReferencias(ref)) return "";
  const rows: string[] = [];
  const exp = ref?.expediente?.trim();
  const master = ref?.bl_master?.trim();
  const house = ref?.bl_house?.trim();
  if (exp) rows.push(`<li><strong>Expediente:</strong> ${escapeHtml(exp)}</li>`);
  if (master) rows.push(`<li><strong>BL Master:</strong> ${escapeHtml(master)}</li>`);
  if (house) rows.push(`<li><strong>BL House:</strong> ${escapeHtml(house)}</li>`);
  return `<h4>Referencias del embarque</h4><ul>${rows.join("")}</ul>`;
}
