/**
 * Bandeja "Por cobrar": facturas vigentes con saldo > 0, no vencidas.
 * Patrón unificado: Card + UnifiedFiltersBar + useClientPagedList.
 */
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";

interface FilaCobranza {
  id: string;
  numero: string;
  cliente_nombre: string;
  fecha_vencimiento: string;
  saldo: number;
  moneda: string;
  dias_vencido: number;
}

interface Filters extends Record<string, string> { moneda: string }
const DEFAULTS: Filters = { moneda: "todas" };

const columns = defineColumns<FilaCobranza>([
  {
    id: "numero",
    header: "Folio",
    accessorFn: (r) => r.numero,
    enableSorting: true,
    meta: { width: "w-[140px]", className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.numero,
  },
  clientColumn<FilaCobranza>({ accessor: (r) => r.cliente_nombre }),
  { ...dateColumn<FilaCobranza>({ id: "vencimiento", header: "Vence", accessor: (r) => r.fecha_vencimiento }),
    meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" } },
  { ...moneyColumn<FilaCobranza>({ id: "saldo", header: "Saldo",
      accessor: (r) => r.saldo, currencyAccessor: (r) => r.moneda }),
    meta: { width: "w-[140px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" } },
]);

export function BandejaPorCobrar() {
  const { data, isLoading } = useCobranza({ estatus: "todos", moneda: "todas" });
  const filas = useMemo<FilaCobranza[]>(
    () => (data ?? []).filter((f) => f.saldo > 0 && f.estatus_cobranza !== "Vencida"),
    [data],
  );
  const paged = useClientPagedList<FilaCobranza, Filters>({
    data: filas,
    isLoading,
    defaultFilters: DEFAULTS,
    filterLabels: { moneda: "Moneda" },
    defaultSort: { key: "vencimiento", dir: "asc" },
    searchAccessor: (r) => `${r.numero} ${r.cliente_nombre}`,
    filterPredicate: (r, ff) => ff.moneda === "todas" || r.moneda === ff.moneda,
    sorters: {
      numero: (a, b) => a.numero.localeCompare(b.numero),
      cliente: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
      vencimiento: (a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento),
      saldo: (a, b) => a.saldo - b.saldo,
    },
  });
  const totalCount = filas.length;

  return (
    <div className="space-y-3">
      <UnifiedFiltersBar
        search={paged.search}
        onSearchChange={paged.setSearch}
        searchPlaceholder="Buscar folio o cliente…"
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />
      <div className="text-xs text-muted-foreground">
        Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} facturas por cobrar
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyIcon={Inbox}
            emptyMessage="Sin saldos por cobrar. ✅"
            rowKey={(r) => r.id}
            getRowHref={(r) => `/facturacion/${r.id}`}
            getRowAriaLabel={(r) => `Abrir factura ${r.numero}`}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
          />
        </CardContent>
      </Card>
    </div>
  );
}
