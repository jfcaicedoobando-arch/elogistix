/**
 * Resolución del `organization_id` usado como primer segmento de los paths del
 * bucket `facturas` (requisito de la RLS del bucket). Extraído de
 * `cfdiStorage.ts` para poder reusarlo desde `cfdiStorageNc.ts` sin ciclos.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * v13.322.14 — El primer segmento de la ruta DEBE ser el organization_id real
 * para satisfacer la RLS del bucket `facturas`. Antes se usaba el literal
 * `"org"` cuando venía indefinido, lo que siempre provocaba
 * "new row violates row-level security policy". Ahora se resuelve vía RPC.
 */
export async function resolverOrganizationId(
  organizationId: string | null | undefined,
): Promise<string> {
  if (organizationId) return organizationId;
  const { data, error } = await supabase.rpc("current_user_org_id");
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo determinar la organización del usuario para subir el archivo.",
    );
  }
  return data;
}
