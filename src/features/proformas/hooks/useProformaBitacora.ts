/**
 * useProformaBitacora — feed de auditoría de una proforma (bitácora de
 * actividad) para trazabilidad de envíos, aceptaciones y ediciones.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchBitacoraProforma } from "@/features/proformas/services/bitacoraProforma";
import { queryKeys } from "@/lib/query";

export function useProformaBitacora(proformaId: string) {
  return useQuery({
    queryKey: queryKeys.proformas.bitacora(proformaId),
    queryFn: () => fetchBitacoraProforma(proformaId),
    enabled: Boolean(proformaId),
    staleTime: 30_000,
  });
}
