/**
 * Lectura y agrupación de configuración por categoría para una organización.
 */
import { useConfiguracionByOrg } from "@/hooks/configuracion/useConfiguracionOrg";
import { agruparConfigPorCategoria } from "@/lib/domain/configuracion";

export function useAdminOrgConfig(id: string | undefined) {
  const { data: configItems = [], isLoading: loadingConfig } = useConfiguracionByOrg(id ?? null);
  const grouped = agruparConfigPorCategoria(configItems);
  return { configItems, loadingConfig, grouped };
}
