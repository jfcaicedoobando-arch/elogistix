import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";
import {
  LEAD_COLUMNS,
  type LeadFiltros,
  type LeadsResultado,
  type CrmLeadRow,
} from "./constants";

export function useLeads(filtros: LeadFiltros = {}) {
  const {
    search = "",
    estado = "todos",
    fuente = "todos",
    page = 0,
    pageSize = 25,
  } = filtros;

  return useQuery<LeadsResultado>({
    queryKey: queryKeys.crm.leads.list({ search, estado, fuente, page, pageSize }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("crm_leads")
        .select(LEAD_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false });

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(
          `empresa.ilike.${term},contacto.ilike.${term},email.ilike.${term}`,
        );
      }
      if (estado !== "todos") q = q.eq("estado", estado);
      if (fuente !== "todos") q = q.eq("fuente", fuente);

      const from = page * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, count, error } = await q;
      if (error) throw error;
      return { data: (data ?? []) as CrmLeadRow[], count: count ?? 0 };
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery<CrmLeadRow | null>({
    queryKey: queryKeys.crm.leads.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads")
        .select(LEAD_COLUMNS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CrmLeadRow | null;
    },
  });
}
