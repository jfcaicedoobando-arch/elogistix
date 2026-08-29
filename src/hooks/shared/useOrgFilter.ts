import { useOrganization } from "@/lib/contexts/OrganizationContext";

/**
 * Returns the active organization ID for query filtering.
 * All list queries should include this in their query key and use it to filter.
 */
export function useOrgFilter() {
  const { organizationId, loading } = useOrganization();
  /**
   * N-3: `orgListo` indica que el contexto de organización ya resolvió. Sin
   * esta bandera, una lista se disparaba con `organizationId = null` (todavía
   * cargando) y traía datos sin filtrar por un instante. Un super admin en
   * consola de plataforma sí tiene `organizationId = null` a propósito, por eso
   * la puerta es "ya cargó", no "tiene organización".
   */
  return { organizationId, orgListo: !loading };
}
