import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchLeadLineage,
  fetchOportunidadCotsLineage,
  fetchEmbarquesByIds,
  fetchLeadResumen,
  type LeadOportunidadRow,
  type LineageCotRow,
  type LineageEmbRow,
  type LineageLead,
} from "@/features/crm/services";
import { queryKeys } from "@/lib/query";

export function useLeadLineage(leadId: string) {
  return useQuery<LeadOportunidadRow[]>({
    queryKey: queryKeys.crm.lineage.lead(leadId),
    queryFn: () => fetchLeadLineage(leadId),
    enabled: !!leadId,
  });
}

interface OpLineageResult {
  cots: LineageCotRow[];
  embs: LineageEmbRow[];
  lead: LineageLead | null;
  isLoadingCots: boolean;
  /**
   * Tercera tanda YAGNI · hallazgo 1: un error de lectura ya NO se muestra
   * como "sin datos". La UI distingue vacío real de fallo y ofrece reintento.
   */
  isError: boolean;
  refetch: () => void;
}

export function useOportunidadLineage(
  oportunidadId: string,
  leadId: string | null,
): OpLineageResult {
  const cotsQ = useQuery<LineageCotRow[]>({
    queryKey: queryKeys.crm.lineage.opCots(oportunidadId),
    queryFn: () => fetchOportunidadCotsLineage(oportunidadId),
    enabled: !!oportunidadId,
  });

  const embarqueIds = useMemo(
    () =>
      (cotsQ.data ?? [])
        .map((c) => c.embarque_id)
        .filter((x): x is string => !!x)
        .sort(),
    [cotsQ.data],
  );

  const embsQ = useQuery<LineageEmbRow[]>({
    queryKey: queryKeys.crm.lineage.opEmbs(oportunidadId, embarqueIds.join(",")),
    queryFn: () => fetchEmbarquesByIds(embarqueIds),
    enabled: embarqueIds.length > 0,
  });

  const leadQ = useQuery<LineageLead | null>({
    queryKey: queryKeys.crm.lineage.opLead(oportunidadId, leadId ?? ""),
    queryFn: () => fetchLeadResumen(leadId!),
    enabled: !!leadId,
  });

  return {
    cots: cotsQ.data ?? [],
    embs: embsQ.data ?? [],
    lead: leadQ.data ?? null,
    isLoadingCots: cotsQ.isLoading,
    isError: cotsQ.isError || embsQ.isError || leadQ.isError,
    refetch: () => {
      void cotsQ.refetch();
      void embsQ.refetch();
      void leadQ.refetch();
    },
  };
}
