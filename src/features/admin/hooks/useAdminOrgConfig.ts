/**
 * Lectura y agrupación de configuración por categoría para una organización.
 */
import { useConfiguracionByOrg } from "@/features/configuracion/hooks/useConfiguracionOrg";
import { agruparConfigPorCategoria } from "@/features/configuracion/domain/configuracion";

export function useAdminOrgConfig(id: string | undefined) {
  const { data: configItems = [], isLoading: loadingConfig } = useConfiguracionByOrg(id ?? null);
  const grouped = agruparConfigPorCategoria(configItems);
  return { configItems, loadingConfig, grouped };
}
