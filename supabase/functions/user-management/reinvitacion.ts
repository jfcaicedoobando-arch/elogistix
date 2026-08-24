/**
 * R2 seguridad · P1 (B-1) — Candado de toma de cuenta en las invitaciones de
 * portal (`invite_client` / `invite_agente`).
 *
 * Bug real: ambos flujos aceptaban un correo arbitrario. Si ya existía una
 * cuenta con ese correo, el flujo la "re-vinculaba": en modo `password`
 * llamaba `updateUserById({ password })` y en ambos modos forzaba
 * `user_roles.role = 'cliente' | 'agente_carga'`. Un admin de organización
 * podía así reasignar la contraseña y degradar el rol de CUALQUIER cuenta de
 * la plataforma (incluido un `super_admin` o el staff de otro tenant) con sólo
 * conocer su correo.
 *
 * Regla: una cuenta existente sólo puede re-invitarse si es una cuenta de
 * portal (rol `cliente` o `agente_carga`) y todos sus vínculos de portal
 * pertenecen a la organización objetivo. En cualquier otro caso se rechaza con
 * `LC_CUENTA_NO_REINVITABLE`.
 */
// @ts-expect-error Deno remote import
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/** Roles que sí corresponden a cuentas de portal re-invitables. */
const ROLES_PORTAL = ["cliente", "agente_carga"];

export const LC_CUENTA_NO_REINVITABLE =
  "LC_CUENTA_NO_REINVITABLE: Ese correo ya tiene una cuenta que no es de portal " +
  "de esta organización. Pide a la persona que inicie sesión con su cuenta " +
  "actual o usa otro correo.";

/**
 * Valida si el correo puede invitarse/re-invitarse a la organización dada.
 * Devuelve `null` si es seguro continuar, o el mensaje de rechazo.
 */
export async function validarReinvitacionPortal(
  adminClient: SupabaseClient,
  email: string,
  organizationId: string,
): Promise<string | null> {
  const { data: existing } = await adminClient
    .schema("auth")
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  const userId = (existing as { id?: string } | null)?.id;
  // Cuenta nueva: no hay nada que tomar.
  if (!userId) return null;

  const { data: roles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const listaRoles = ((roles ?? []) as { role: string }[]).map((r) => r.role);
  // Cualquier rol de staff/plataforma bloquea la re-invitación.
  if (listaRoles.some((r) => !ROLES_PORTAL.includes(r))) return LC_CUENTA_NO_REINVITABLE;

  for (const tabla of ["client_users", "agente_users"] as const) {
    const { data: vinculos } = await adminClient
      .from(tabla)
      .select("organization_id")
      .eq("user_id", userId);
    const ajeno = ((vinculos ?? []) as { organization_id: string }[]).some(
      (v) => v.organization_id !== organizationId,
    );
    if (ajeno) return LC_CUENTA_NO_REINVITABLE;
  }

  // Membresía de staff en cualquier organización: tampoco es cuenta de portal.
  const { data: membresias } = await adminClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1);
  if ((membresias ?? []).length > 0) return LC_CUENTA_NO_REINVITABLE;

  return null;
}
