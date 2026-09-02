import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { listLeads, getLead } from "@/features/crm/services/leads";
import type { LeadFiltros, LeadsResultado, CrmLeadRow } from "./constants";

export function useLeads(filtros: LeadFiltros = {}) {
  const {
    search = "",
    estado = "todos",
    fuente = "todos",
    page = 0,
    pageSize = 25,
    estadoIn,
  } = filtros;
  return useQuery<LeadsResultado>({
    queryKey: queryKeys.crm.leads.list({ search, estado, fuente, page, pageSize, estadoIn }),
    placeholderData: keepPreviousData,
    queryFn: () => listLeads({ search, estado, fuente, page, pageSize, estadoIn }),
  });
}

export function useLead(id: string | undefined) {
  return useQuery<CrmLeadRow | null>({
    queryKey: queryKeys.crm.leads.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => getLead(id!),
  });
}
