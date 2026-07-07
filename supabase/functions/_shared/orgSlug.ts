/**
 * Helper compartido para prefijar los nombres de archivo descargables/enviables
 * con el nombre de la organización (multi-tenant). Regla: `{Org}_{nombre}.{ext}`.
 *
 * Se usa en `facturapi-descargar`, `facturapi-cancelar`, `enviar-factura-email`
 * y `enviar-cotizacion-email`.
 */

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

type OrgRow = { nombre?: string | null };

type QueryBuilder = {
  select: (columns: string) => FilterBuilder;
};

type FilterBuilder = {
  eq: (column: string, value: string) => FilterBuilder;
  maybeSingle: () => Promise<{ data: OrgRow | null }>;
};

type AnySupabaseClient = { from: (t: string) => QueryBuilder };

/** Devuelve el slug del nombre de la organización, o "org" si no se encuentra. */
export async function fetchOrgSlug(
  admin: AnySupabaseClient,
  organizationId: string,
): Promise<string> {
  try {
    const { data } = await admin
      .from("organizations")
      .select("nombre")
      .eq("id", organizationId)
      .maybeSingle();
    return slugifyOrg(data?.nombre ?? null);
  } catch {
    return "org";
  }
}
