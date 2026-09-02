import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  fetchDiagnosticoTarifas,
  type DiagnosticoTarifas,
} from "@/features/costeo/services/diagnosticoTarifas";
import { todayLocalISO } from "@/lib/date/today";
import { isValidUuid } from "@/features/costeo/hooks/useTopTarifas";

export interface UseDiagnosticoTarifasParams {
  puertoOrigenId?: string;
  puertoDestinoId?: string;
  tipoContenedorIds: string[];
  /** Sólo se consulta cuando el Top 3 ya resolvió sin resultados. */
  enabled: boolean;
}

/**
 * P2: cuando el Top 3 viene vacío, distingue si NO hay tarifa, si hay una
 * pendiente de aprobación o si sólo hay vencidas.
 */
export function useDiagnosticoTarifas(p: UseDiagnosticoTarifasParams) {
  const { organizationId } = useOrganization();
  const hoy = todayLocalISO();
  const idsOk =
    isValidUuid(p.puertoOrigenId) &&
    isValidUuid(p.puertoDestinoId) &&
    p.tipoContenedorIds.length > 0;

  const query = useQuery<DiagnosticoTarifas>({
    queryKey: [
      "costeo",
      "diagnostico-tarifas",
      organizationId,
      p.puertoOrigenId,
      p.puertoDestinoId,
      [...p.tipoContenedorIds].sort(),
      hoy,
    ],
    queryFn: () =>
      fetchDiagnosticoTarifas({
        puertoOrigenId: p.puertoOrigenId!,
        puertoDestinoId: p.puertoDestinoId!,
        tipoContenedorIds: p.tipoContenedorIds,
        hoy,
        organizationId: organizationId!,
      }),
    enabled: p.enabled && !!organizationId && idsOk,
    staleTime: 30 * 1000,
  });

  return { diagnostico: query.data, isFetching: query.isFetching };
}
