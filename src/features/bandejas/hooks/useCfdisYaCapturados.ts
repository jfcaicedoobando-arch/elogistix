/**
 * Marca en el buzón CxP qué documentos traen un CFDI que ya fue capturado.
 * v13.368.0
 */
import { useQuery } from "@tanstack/react-query";
import {
  buscarFacturasPorUuidsFiscales,
  type FacturaPorUuid,
} from "@/features/cxp/services/uuidsCapturados";
import { normalizarUuidFiscal } from "@/lib/domain/uuidFiscal";
import { cxp as cxpKeys } from "@/features/cxp/queryKeys";

interface FilaConUuid {
  uuid_fiscal?: string | null;
}

export function useCfdisYaCapturados(rows: ReadonlyArray<FilaConUuid>) {
  const uuids = rows
    .map((r) => normalizarUuidFiscal(r.uuid_fiscal))
    .filter((u): u is string => u !== null)
    .sort();

  const { data } = useQuery({
    queryKey: cxpKeys.uuidsCapturados(uuids),
    queryFn: () => buscarFacturasPorUuidsFiscales(uuids),
    enabled: uuids.length > 0,
    staleTime: 30_000,
  });

  const mapa = data ?? new Map<string, FacturaPorUuid>();
  return (uuid: string | null | undefined): FacturaPorUuid | null => {
    const key = normalizarUuidFiscal(uuid);
    return key ? mapa.get(key) ?? null : null;
  };
}
