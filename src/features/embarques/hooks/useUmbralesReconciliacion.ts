/**
 * Hook: lee los umbrales de varianza de reconciliación desde la
 * configuración por organización. Cae a UMBRALES_DEFAULT si no hay valores.
 */
import { useConfigValue } from "@/features/configuracion/hooks/useConfiguracion";
import { UMBRALES_DEFAULT, type UmbralesVarianza } from "@/lib/domain/versionadoCotizacion";

export function useUmbralesReconciliacion(): UmbralesVarianza {
  const alerta = useConfigValue<number>(
    "operaciones",
    "reconciliacion_varianza_alerta_pct",
    UMBRALES_DEFAULT.alerta_pct,
  );
  const critica = useConfigValue<number>(
    "operaciones",
    "reconciliacion_varianza_critica_pct",
    UMBRALES_DEFAULT.critica_pct,
  );
  return {
    alerta_pct: Number(alerta) || UMBRALES_DEFAULT.alerta_pct,
    critica_pct: Number(critica) || UMBRALES_DEFAULT.critica_pct,
  };
}
