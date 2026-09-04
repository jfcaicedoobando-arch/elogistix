/**
 * /crm/prospectos — Etapa 2 del embudo (rediseño CRM v13.766.0).
 *
 * Aquí viven los leads que ya pasaron el gate de calificación (perfil comercial
 * completo). Un prospecto puede recibir cotizaciones y oportunidades, pero NO
 * es cliente: el alta fiscal ocurre en el módulo de Clientes.
 */
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useServerPagedList } from "@/hooks/shared/useServerPagedList";
import { useDocumentTitle } from "@/hooks/shared";
import { toTitleCase } from "@/lib/formatters";
import { prospectosColumns } from "./prospectosColumns";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { listLeads } from "@/features/crm/services/leads";
import {
  LEAD_SORTABLE_KEYS,
  type CrmLeadRow, type CrmLeadEstado, type LeadSortKey,
} from "@/features/crm/domain/leads/constants";
import { LEAD_ESTADOS_ETAPA_PROSPECTO } from "@/features/crm/domain/leads/etapas";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { queryKeys } from "@/lib/query";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { copiaContadorProspectos } from "./prospectosContadorCopy";


interface ProspectosFilters extends Record<string, string> {
  estado: string;
}
const DEFAULTS: ProspectosFilters = { estado: "todos" };



export default function Prospectos() {
  useDocumentTitle("Prospectos");

  const list = useServerPagedList<CrmLeadRow, ProspectosFilters>({
    queryKey: queryKeys.crm.prospectos.paged,
    defaultFilters: DEFAULTS,
    filterLabels: { estado: "Etapa" },
    defaultPageSize: 50,
    defaultSort: { key: "created_at", dir: "desc" },
    sortableKeys: LEAD_SORTABLE_KEYS,
    fetcher: async ({ search, filters, sortKey, sortDir, page, pageSize }) => {
      const { data, count } = await listLeads({
        search,
        estado: (filters.estado as CrmLeadEstado | "todos") ?? "todos",
        estadoIn: LEAD_ESTADOS_ETAPA_PROSPECTO,
        page,
        pageSize,
        sortKey: (sortKey ?? "created_at") as LeadSortKey,
        sortDir: sortDir ?? "desc",
      });
      return { rows: data, count };
    },
  });

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Prospectos"
        description="Leads calificados que cumplen el perfil comercial y pueden recibir cotizaciones"
      />

      <CrmSubheader
        context={copiaContadorProspectos(
          list.count,
          Boolean(list.search) || list.activeCount > 0,
        )}
      />


      <UnifiedFiltersBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Buscar por empresa, contacto o email…"
        chips={list.activeChips}
        activeCount={list.activeCount}
        onClearAll={list.resetAll}
        primary={
          <Select
            value={list.filters.estado}
            onValueChange={(v) => list.setFilter("estado", v)}
          >
            <SelectTrigger className="h-9 w-auto min-w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las etapas</SelectItem>
              {LEAD_ESTADOS_ETAPA_PROSPECTO.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Card>
        <CardContent className="p-0">
          {list.error ? (
            <ErrorState className="m-4" onRetry={() => void list.refetch()} />
          ) : (
            <ResponsiveDataTable
              columns={prospectosColumns}
              data={list.rows}
              isLoading={list.isLoading}
              emptyMessage={
                list.search
                  ? "No se encontraron prospectos"
                  : "Aún no hay prospectos. Califica un lead desde su ficha."
              }
              getRowHref={(l) => `/crm/leads/${l.id}`}
              rowKey={(l) => l.id}
              density={TABLE_DENSITY.listado}
              sortMode="server"
              controlledSort={list.controlledSort}
              onSortChange={(key, dir) => list.setSort(key, dir)}
              mobileCard={(l) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-body truncate">{toTitleCase(l.empresa)}</div>
                    <div className="text-body-sm text-muted-foreground truncate mt-0.5">
                      {toTitleCase(l.contacto ?? "") || l.email || "—"}
                    </div>
                    <div className="text-label text-muted-foreground mt-0.5">
                      {l.sector ?? "Sin sector"}{l.frecuencia ? ` · ${l.frecuencia}` : ""}
                    </div>
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
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
