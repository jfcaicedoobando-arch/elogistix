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
} from "@/services/crm";

export function useLeadLineage(leadId: string) {
  return useQuery<LeadOportunidadRow[]>({
    queryKey: ["crm", "lineage", "lead", leadId],
    queryFn: () => fetchLeadLineage(leadId),
    enabled: !!leadId,
  });
}

interface OpLineageResult {
  cots: LineageCotRow[];
  embs: LineageEmbRow[];
  lead: LineageLead | null;
  isLoadingCots: boolean;
}

export function useOportunidadLineage(
  oportunidadId: string,
  leadId: string | null,
): OpLineageResult {
  const cotsQ = useQuery<LineageCotRow[]>({
    queryKey: ["crm", "lineage", "op", oportunidadId, "cots"],
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
    queryKey: ["crm", "lineage", "op", oportunidadId, "embs", embarqueIds.join(",")],
    queryFn: () => fetchEmbarquesByIds(embarqueIds),
    enabled: embarqueIds.length > 0,
  });

  const leadQ = useQuery<LineageLead | null>({
    queryKey: ["crm", "lineage", "op", oportunidadId, "lead", leadId],
    queryFn: () => fetchLeadResumen(leadId!),
    enabled: !!leadId,
  });

  return {
    cots: cotsQ.data ?? [],
    embs: embsQ.data ?? [],
    lead: leadQ.data ?? null,
    isLoadingCots: cotsQ.isLoading,
  };
}
