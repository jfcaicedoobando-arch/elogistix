/**
 * Helpers puros de derivación para `useEnvioDocumentoForm`.
 * Extraídos para mantener el hook por debajo de 200 líneas (Power of 10).
 */
import { EMAIL_RE } from "@/hooks/emails/envioDocumentoInit";
import type { ContactoClienteEmail } from "@/features/cotizacion/services/envios";

export interface DestinatarioEnvio {
  email: string;
  nombre?: string;
  contacto_id?: string;
}

/** Une contactos seleccionados + correos manuales, deduplicando por email. */
export function computeDestinatarios(
  contactos: ContactoClienteEmail[],
  seleccionados: Record<string, boolean>,
  emailsManuales: string[],
): DestinatarioEnvio[] {
  const fromContactos = contactos
    .filter((c) => seleccionados[c.id])
    .map((c) => ({ email: c.email, nombre: c.contacto || c.nombre, contacto_id: c.id }));
  const fromManual = emailsManuales.map((e) => ({ email: e }));
  const seen = new Set<string>();
  return [...fromContactos, ...fromManual].filter((d) => {
    const k = d.email.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** CC = usuario logueado + CC manuales, sin duplicar destinatarios. */
export function computeCcEmails(
  userEmail: string | null | undefined,
  ccManual: string,
  destinatarios: DestinatarioEnvio[],
): string[] {
  const base = userEmail ? [userEmail] : [];
  const extra = ccManual
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => EMAIL_RE.test(e));
  const recipientSet = new Set(destinatarios.map((d) => d.email.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...base, ...extra]) {
    const k = e.toLowerCase();
    if (seen.has(k) || recipientSet.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
