/**
 * /crm/leads — Listado de leads con URL sync (Ola 2 · filtros globales).
 *
 * Migrado a `useServerPagedList`:
 *  - Búsqueda, estado, fuente, orden y paginación viven en la URL vía nuqs
 *    (`?q=&estado=&fuente=&sort=&dir=&page=&ps=`).
 *  - Fetcher server-side vía `listLeads` con `count: 'exact'` y `.range()`.
 *
 * Sin botón "Nuevo lead" propio (vive en QuickAddMenu del header global).
 */
import { useState, useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { toTitleCase } from "@/lib/formatters";
import { useServerPagedList } from "@/hooks/shared/useServerPagedList";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import LeadsBulkBar from "@/features/crm/components/LeadsBulkBar";
import { listLeads } from "@/features/crm/services/leads";
import {
  LEAD_ESTADOS, LEAD_FUENTES, LEAD_SORTABLE_KEYS,
  type CrmLeadRow, type CrmLeadEstado, type CrmLeadFuente, type LeadSortKey,
} from "@/features/crm/domain/leads/constants";
import { makeLeadsColumns } from "./leadsColumns";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { queryKeys } from "@/lib/query";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

interface LeadsFilters extends Record<string, string> {
  estado: string;
  fuente: string;
}
const DEFAULTS: LeadsFilters = { estado: "todos", fuente: "todos" };

export default function Leads() {
  useDocumentTitle('Leads');
  const { canEditCrm } = usePermissions();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const list = useServerPagedList<CrmLeadRow, LeadsFilters>({
    queryKey: queryKeys.crm.leads.paged,
    defaultFilters: DEFAULTS,
    filterLabels: { estado: "Estado", fuente: "Fuente" },
    defaultPageSize: 50,
    defaultSort: { key: "created_at", dir: "desc" },
    sortableKeys: LEAD_SORTABLE_KEYS,
    fetcher: async ({ search, filters, sortKey, sortDir, page, pageSize }) => {
      const { data, count } = await listLeads({
        search,
        estado: (filters.estado as CrmLeadEstado | "todos") ?? "todos",
        fuente: (filters.fuente as CrmLeadFuente | "todos") ?? "todos",
        page,
        pageSize,
        sortKey: (sortKey ?? "created_at") as LeadSortKey,
        sortDir: sortDir ?? "desc",
      });
      return { rows: data, count };
    },
  });

  const leads = list.rows;

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
  const columns = useMemo(
    () => makeLeadsColumns(selected, toggle, toggleAll, leads),
    [selected, leads],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Leads"
        description="Prospectos y empresas en seguimiento comercial"
      />
      <CrmSubheader context={`${list.count} leads en cartera`} />

      {canEditCrm && selected.size > 0 && (
        <LeadsBulkBar ids={Array.from(selected)} onClear={clearSel} onDone={clearSel} />
      )}

      <UnifiedFiltersBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Buscar por empresa, contacto o email…"
        chips={list.activeChips}
        activeCount={list.activeCount}
        onClearAll={list.resetAll}
        primary={
          <>
            <Select
              value={list.filters.estado}
              onValueChange={(v) => list.setFilter("estado", v)}
            >
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {LEAD_ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={list.filters.fuente}
              onValueChange={(v) => list.setFilter("fuente", v)}
            >
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las fuentes</SelectItem>
                {LEAD_FUENTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={leads}
            isLoading={list.isLoading}
            emptyMessage={list.search ? "No se encontraron leads" : "No hay leads registrados"}
            getRowHref={(l) => `/crm/leads/${l.id}`}
            rowKey={(l) => l.id}
            density={TABLE_DENSITY.listado}
            sortMode="server"
            controlledSort={list.controlledSort}
            onSortChange={(key, dir) => list.setSort(key, dir)}
            mobileCard={(l) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{toTitleCase(l.empresa)}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{toTitleCase(l.contacto ?? "") || l.email || "—"}</div>
                  <div className="text-label text-muted-foreground mt-0.5">{l.fuente}{typeof l.score === "number" ? ` · score ${l.score}` : ""}</div>
                </div>
                <StatusBadge domain="lead" status={l.estado} />
              </div>
            )}
            pagination={{
              ...list.pagination,
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" },
            }}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
