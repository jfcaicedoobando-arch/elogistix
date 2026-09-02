/**
 * Catálogo de usuarios disponibles (resolución de emails desde edge function
 * `user-management` action `list`). Vive en `services/usuario` para que
 * features (comisiones, admin, etc.) compartan el mismo punto de entrada y
 * no haya imports cruzados entre features.
 *
 * Extraído de `features/admin/services/members.ts` en v13.56.2 — auditoría
 * arquitectónica (paso 6: eliminar acoplamiento `comisiones → admin`).
 */
import { supabase } from "@/integrations/supabase/client";

export interface UserOption {
  id: string;
  email: string;
}

export async function fetchAvailableUsers(): Promise<UserOption[]> {
  const { data, error } = await supabase.functions.invoke("user-management", {
    body: { action: "list" },
  });
  if (error) throw error;
  return Array.isArray(data) ? (data as UserOption[]) : [];
}

/**
 * Ola 4 · N27: variante sin los usuarios que YA tienen membresía, para el
 * selector de "Nueva organización" (un usuario sólo puede pertenecer a una
 * org — organization_members_user_id_unique). La RLS permite la lectura
 * completa porque este diálogo sólo lo abre super_admin ("Super admins
 * manage members"); la RPC provision_organization valida de todas formas.
 */
export async function fetchAvailableUsersSinMembresia(): Promise<UserOption[]> {
  const [users, { data: miembros, error }] = await Promise.all([
    fetchAvailableUsers(),
    supabase.from("organization_members").select("user_id"),
  ]);
  if (error) throw error;
  const asignados = new Set((miembros ?? []).map((m) => m.user_id as string));
  return users.filter((u) => !asignados.has(u.id));
}

export interface NombreUsuario {
  id: string;
  full_name: string | null;
}

/**
 * Catálogo mínimo `{ id, full_name }` vía `user-management` action
 * `list-nombres` — sin email ni señales de sesión. Usado por roles
 * operativos (comisiones, auditoría) que sólo necesitan resolver nombres.
 */
export async function fetchNombresUsuarios(): Promise<NombreUsuario[]> {
  const { data, error } = await supabase.functions.invoke("user-management", {
    body: { action: "list-nombres" },
  });
  if (error) throw error;
  return Array.isArray(data) ? (data as NombreUsuario[]) : [];
}

