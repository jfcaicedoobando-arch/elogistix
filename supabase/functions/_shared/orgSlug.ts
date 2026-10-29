/**
 * Helper compartido para prefijar los nombres de archivo descargables/enviables
 * con el nombre de la organización (multi-tenant). Regla: `{Org}_{nombre}.{ext}`.
 *
 * Se usa en `facturapi-descargar`, `facturapi-cancelar`, `enviar-factura-email`
 * y `enviar-cotizacion-email`.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

/**
 * Normaliza el nombre de la organización para usarlo como prefijo del nombre de
 * archivo descargado: sin acentos, sin caracteres inseguros y con guiones bajos
 * en lugar de espacios. Máx 40 chars para evitar Content-Disposition largos.
 */
export function slugifyOrg(nombre: string | null | undefined): string {
  const s = (nombre ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return s || "org";
}

// Reuse the public SDK method instead of recursively comparing its generic
// query/filter overloads against a separately defined thenable interface.
type OrgNameClient = Pick<SupabaseClient, "from">;

/** Devuelve el slug del nombre de la organización, o "org" si no se encuentra. */
export async function fetchOrgSlug(
  admin: OrgNameClient,
  organizationId: string,
): Promise<string> {
  try {
    const { data } = await admin
      .from("organizations")
      .select("nombre")
      .eq("id", organizationId)
      .maybeSingle<unknown>();
    const nombre = data !== null && typeof data === "object" && "nombre" in data
      && typeof data.nombre === "string" ? data.nombre : null;
    return slugifyOrg(nombre);
  } catch {
    return "org";
  }
}
