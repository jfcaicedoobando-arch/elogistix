/**
 * envioDocumentoInit — Helpers puros para precargar el estado inicial del
 * modal de envío (CC heredado, destinatarios manuales, selección default).
 *
 * Extraído de `useEnvioDocumentoForm` para respetar Power of 10 (≤200 líneas).
 */
import {
  esContactoPrioridadCliente,
  CLIENTE_PRINCIPAL_ID,
  type ContactoClienteEmail,
} from "@/features/cotizacion/services/envios";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PrecargaEnvio {
  precargaCc: string[];
  precargaDest: string[];
  seleccionadosPre: Record<string, boolean>;
}

export function computeInitialPrecarga(
  contactos: readonly ContactoClienteEmail[],
  ccInicial: readonly string[] | null | undefined,
  destInicial: readonly string[] | null | undefined,
  userEmail: string | null | undefined,
): PrecargaEnvio {
  const userEmailLc = userEmail?.toLowerCase();

  const precargaCc = (ccInicial ?? [])
    .map((e) => e.trim())
    .filter((e) => EMAIL_RE.test(e) && e.toLowerCase() !== userEmailLc);

  const contactoEmails = new Set(contactos.map((c) => c.email.toLowerCase()));
  const seenDest = new Set<string>();
  const precargaDest = (destInicial ?? [])
    .map((e) => e.trim())
    .filter((e) => EMAIL_RE.test(e) && !contactoEmails.has(e.toLowerCase()))
    .filter((e) => {
      const k = e.toLowerCase();
      if (seenDest.has(k)) return false;
      seenDest.add(k);
      return true;
    });

  const seleccionadosPre: Record<string, boolean> = {};
  const principal = contactos.find((c) => c.id === CLIENTE_PRINCIPAL_ID);
  const prioridad = contactos.find(esContactoPrioridadCliente);
  if (principal) seleccionadosPre[principal.id] = true;
  else if (prioridad) seleccionadosPre[prioridad.id] = true;

  return { precargaCc, precargaDest, seleccionadosPre };
}
