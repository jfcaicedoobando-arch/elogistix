/**
 * /crm/leads — Listado de leads con búsqueda, filtros y selección múltiple.
 * Sin botón "Nuevo lead" propio (vive en QuickAddMenu del header global).
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { toTitleCase } from "@/lib/formatters";
import { useDebounce, useListPageState, usePermissions } from "@/hooks/shared";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import LeadsBulkBar from "@/features/crm/components/LeadsBulkBar";
import { LeadsFiltersBar } from "@/features/crm/components/LeadsFiltersBar";
import {
  useLeads,
  type CrmLeadEstado, type CrmLeadFuente, type CrmLeadRow,
} from "@/features/crm/hooks";
import { makeLeadsColumns } from "./leadsColumns";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function Leads() {
  const navigate = useNavigate();
  const { canEditCrm } = usePermissions();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { search, setSearch, page, setPage, pageSize, setPageSize } = useListPageState({});
  const debounced = useDebounce(search, 300);
  const [estado, setEstado] = useState<CrmLeadEstado | "todos">("todos");
  const [fuente, setFuente] = useState<CrmLeadFuente | "todos">("todos");

  const { data, isLoading } = useLeads({ search: debounced, estado, fuente, page, pageSize });
  const leads = useMemo(() => data?.data ?? [], [data]);
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const toggleAll = (rows: CrmLeadRow[]) => setSelected((s) => {
    const allHere = rows.every((r) => s.has(r.id));
    const n = new Set(s);
    if (allHere) rows.forEach((r) => n.delete(r.id));
    else rows.forEach((r) => n.add(r.id));
    return n;
  });
  const clearSel = () => setSelected(new Set());
  const columns = useMemo(() => makeLeadsColumns(selected, toggle, toggleAll, leads), [selected, leads]);

  return (
    <PageContainer>
      <PageHeader
        title="Leads"
        description="Prospectos y empresas en seguimiento comercial"
      />
      <CrmSubheader context={`${totalCount} leads en cartera`} />

      {canEditCrm && selected.size > 0 && (
        <LeadsBulkBar ids={Array.from(selected)} onClear={clearSel} onDone={clearSel} />
      )}

      <LeadsFiltersBar
        search={search}
        onSearchChange={setSearch}
        estado={estado}
        onEstadoChange={(v) => { setEstado(v); setPage(0); }}
        fuente={fuente}
        onFuenteChange={(v) => { setFuente(v); setPage(0); }}
      />

      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={leads}
            isLoading={isLoading}
            emptyMessage={debounced ? "No se encontraron leads" : "No hay leads registrados"}
            onRowClick={(l) => navigate(`/crm/leads/${l.id}`)}
            rowKey={(l) => l.id}
            density="comfortable"
            mobileCard={(l) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{toTitleCase(l.empresa)}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{toTitleCase(l.contacto ?? "") || l.email || "—"}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{l.fuente}{typeof l.score === "number" ? ` · score ${l.score}` : ""}</div>
                </div>
                <StatusBadge domain="lead" status={l.estado} />
              </div>
            )}
            pagination={{
              page,
              totalPages,
              onPageChange: setPage,
              pageSize,
              onPageSizeChange: (s: number) => { setPageSize(s); setPage(0); },
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" },
            }}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
