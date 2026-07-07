/**
 * Bandeja "Vencidas": facturas con vencimiento pasado y saldo > 0.
 * Patrón unificado: Card + UnifiedFiltersBar + useClientPagedList.
 */
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";

interface FilaVencida {
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

function toneDias(d: number): "outline" | "secondary" | "destructive" {
  if (d > 60) return "destructive";
  if (d > 30) return "secondary";
  return "outline";
}

const columns = defineColumns<FilaVencida>([
  {
    id: "numero",
    header: "Folio",
    accessorFn: (r) => r.numero,
    enableSorting: true,
    meta: { width: "w-[140px]", className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.numero,
  },
  clientColumn<FilaVencida>({ accessor: (r) => r.cliente_nombre }),
  { ...dateColumn<FilaVencida>({ id: "vencimiento", header: "Venció", accessor: (r) => r.fecha_vencimiento }),
    meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" } },
  {
    id: "dias",
    header: "Días",
    accessorFn: (r) => r.dias_vencido,
    enableSorting: true,
    meta: { width: "w-[100px]", align: "center" },
    cell: ({ row }) => (
      <Badge variant={toneDias(row.original.dias_vencido)}>{row.original.dias_vencido} d</Badge>
    ),
  },
  { ...moneyColumn<FilaVencida>({ id: "saldo", header: "Saldo",
      accessor: (r) => r.saldo, currencyAccessor: (r) => r.moneda }),
    meta: { width: "w-[140px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" } },
]);

export function BandejaVencidas() {
  const { data, isLoading } = useCobranza({ estatus: "todos", moneda: "todas" });
  const filas = useMemo<FilaVencida[]>(
    () => (data ?? []).filter((f) => f.saldo > 0 && f.estatus_cobranza === "Vencida"),
    [data],
  );
  const paged = useClientPagedList<FilaVencida, Filters>({
    data: filas,
    isLoading,
    defaultFilters: DEFAULTS,
    filterLabels: { moneda: "Moneda" },
    defaultSort: { key: "dias", dir: "desc" },
    searchAccessor: (r) => `${r.numero} ${r.cliente_nombre}`,
    filterPredicate: (r, ff) => ff.moneda === "todas" || r.moneda === ff.moneda,
    sorters: {
      numero: (a, b) => a.numero.localeCompare(b.numero),
      cliente: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
      vencimiento: (a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento),
      dias: (a, b) => a.dias_vencido - b.dias_vencido,
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
        Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} facturas vencidas
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyIcon={AlertCircle}
            emptyMessage="Sin cartera vencida. ✅"
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
