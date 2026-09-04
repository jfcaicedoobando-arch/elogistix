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
import { defineColumns } from "@/components/shared/DataTable";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { toTitleCase } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";
import { useServerPagedList } from "@/hooks/shared/useServerPagedList";
import { useDocumentTitle } from "@/hooks/shared";
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

// v13.823.78 — anchos y breakpoints ajustados: en desktop HD (1280x720) la
// tabla desbordaba (~1109px de contenido en ~950px útiles) y "Alta" quedaba
// fuera de vista. Sector y Rutas ahora aparecen desde 2xl; Frecuencia desde xl.
const columns = defineColumns<CrmLeadRow>([
  {
    id: "empresa", header: "Empresa", enableSorting: true,
    accessorFn: (l) => l.empresa,
    meta: { className: "font-medium truncate", sticky: true },
    cell: ({ row }) => toTitleCase(row.original.empresa),
  },
  {
    id: "contacto", header: "Contacto",
    meta: { width: COL_W.nombre, className: "text-body-sm truncate" },
    cell: ({ row }) => toTitleCase(row.original.contacto ?? "") || "—",
  },
  {
    id: "sector", header: "Sector",
    meta: { width: COL_W.nombre, className: "text-body-sm hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
    cell: ({ row }) => row.original.sector ?? "—",
  },
  {
    id: "rutas", header: "Rutas",
    meta: { width: COL_W.texto, className: "text-body-sm truncate hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
    cell: ({ row }) => row.original.rutas ?? "—",
  },
  {
    id: "frecuencia", header: "Frecuencia",
    meta: { width: COL_W.folio, className: "text-body-sm hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    cell: ({ row }) => row.original.frecuencia ?? "—",
  },
  {
    id: "estado", header: "Etapa",
    meta: { width: COL_W.estado },
    cell: ({ row }) => <StatusBadge domain="lead" status={row.original.estado} />,
  },
  {
    id: "created_at", header: "Alta", enableSorting: true,
    meta: { width: COL_W.fecha, className: "text-body-sm whitespace-nowrap" },
    cell: ({ row }) => formatFechaEs(row.original.created_at),
  },
]);


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
              columns={columns}
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
