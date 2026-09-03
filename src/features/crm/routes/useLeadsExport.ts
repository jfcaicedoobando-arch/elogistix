/**
 * Exportación CSV de leads: todas las coincidencias de los filtros actuales
 * (no sólo la página visible). Extraído de `Leads.tsx`.
 */
import { useMemo, useState } from "react";
import { listLeadsTodos } from "@/features/crm/services/leads";
import { exportarLeadsCsv } from "@/features/crm/services/crmCsvExport";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { LEAD_ESTADOS_ETAPA_LEAD } from "@/features/crm/domain/leads/etapas";
import type { CrmLeadEstado, CrmLeadFuente, LeadSortKey } from "@/features/crm/domain/leads/constants";

interface LeadsExportParams {
  search: string;
  estado: string;
  fuente: string;
  sortKey?: string | null;
  sortDir?: "asc" | "desc" | null;
}

export function useLeadsExport(params: LeadsExportParams) {
  const [exportando, setExportando] = useState(false);
  const filtrosExport = useMemo(
    () => ({
      search: params.search,
      estado: (params.estado as CrmLeadEstado | "todos") ?? "todos",
      estadoIn: LEAD_ESTADOS_ETAPA_LEAD,
      fuente: (params.fuente as CrmLeadFuente | "todos") ?? "todos",
      sortKey: (params.sortKey ?? "created_at") as LeadSortKey,
      sortDir: params.sortDir ?? "desc",
    }),
    [params.search, params.estado, params.fuente, params.sortKey, params.sortDir],
  );
  const exportarTodo = async () => {
    setExportando(true);
    try {
      const todos = await listLeadsTodos(filtrosExport);
      exportarLeadsCsv(todos);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo exportar",
        description: getErrorMessage(e),
        error: e,
        method: "EXPORT_LEADS",
      });
    } finally {
      setExportando(false);
    }
  };
  return { exportando, exportarTodo };
}
