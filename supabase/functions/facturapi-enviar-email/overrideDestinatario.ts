/**
 * R2 seguridad · P1 (B-4) — Candado del destinatario manual (`override`).
 *
 * El endpoint autoriza con `ROLES_CONSULTA_FISCAL` (lectura del expediente
 * fiscal), pero acepta un `email` libre en el body: cualquiera de esos roles
 * podía reenviar el CFDI de un cliente a un correo arbitrario, fuera de la
 * organización. Ahora un destinatario que NO pertenece al cliente ni al
 * dominio corporativo del emisor exige un rol con responsabilidad de envío.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authorizeOrgRole } from "../_shared/auth.ts";
import { destinatariosNoPermitidos, dominioDeEmail } from "../_shared/destinatarioCliente.ts";

/** Roles que pueden dirigir un CFDI a un destinatario fuera del cliente. */
export const ROLES_ENVIO_A_TERCEROS: readonly string[] = [
  "super_admin", "admin", "admin_org", "contador", "tesorero", "ejecutivo_cobranza",
];

export interface GateOverrideArgs {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string | null | undefined;
  organizationId: string;
  clienteId: string | null;
  email: string;
}

/**
 * Devuelve `null` si el envío puede proceder, o el motivo del bloqueo.
 * Sólo evalúa destinatarios manuales; los resueltos desde los contactos del
 * cliente son siempre válidos.
 */
export async function bloqueoDestinatarioOverride(
  args: GateOverrideArgs,
): Promise<string | null> {
  const dominioCaller = dominioDeEmail(args.userEmail ?? "");
  const ajenos = await destinatariosNoPermitidos(
    args.supabase,
    args.clienteId,
    [args.email],
    dominioCaller ? [dominioCaller] : [],
  );
  if (ajenos.length === 0) return null;
  const autorizado = await authorizeOrgRole(
    args.supabase, args.userId, args.organizationId, ROLES_ENVIO_A_TERCEROS,
  );
  if (autorizado) return null;
  return "Tu rol no puede enviar este documento a un correo ajeno al cliente. " +
    "Usa un contacto registrado del cliente.";
}
