/**
 * URLs externas centralizadas. Evita hardcodear dominios de terceros en
 * componentes y permite cambiarlos en un solo lugar (p.ej. para proxy).
 */
export const WHATSAPP_SEND_BASE = "https://wa.me/";

/** Portal público del SAT para verificar un CFDI manualmente. */
export const SAT_VERIFICA_CFDI_URL =
  "https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx";

/**
 * Construye el URL de WhatsApp Click-to-Chat.
 * @param tel Número en formato internacional, sólo dígitos (sin `+`, espacios o guiones).
 * @param text Texto plano del mensaje (se URI-encodea).
 */
export function buildWhatsappUrl(tel: string, text: string): string {
  return `${WHATSAPP_SEND_BASE}${tel}?text=${encodeURIComponent(text)}`;
}
