/**
 * Bandeja "Por timbrar": borradores creados en el sistema (post 01/07/2026)
 * pendientes de FacturApi. Sigue el patrón unificado de listas:
 * Card + UnifiedFiltersBar + useClientPagedList + DataTable con orden.
 */

import { Card, CardContent } from "@/components/ui/card";
import { FileClock } from "lucide-react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useFacturasPorTimbrar, type FilaPorTimbrar } from "@/features/facturacion/hooks/useBandejas";

const columns = defineColumns<FilaPorTimbrar>([
  {
    id: "numero",
    header: "Folio interno",
    accessorFn: (r) => r.numero,
    enableSorting: true,
    meta: { width: "w-[160px]", className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) =>
      row.original.numero.startsWith("BORRADOR-")
        ? <span className="text-muted-foreground italic">Sin folio</span>
        : row.original.numero,
  },
  clientColumn<FilaPorTimbrar>({ accessor: (r) => r.cliente_nombre }),
  { ...dateColumn<FilaPorTimbrar>({ id: "emision", header: "Emisión", accessor: (r) => r.fecha_emision }),
    meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" } },
  { ...moneyColumn<FilaPorTimbrar>({ id: "total", header: "Total",
      accessor: (r) => r.total, currencyAccessor: (r) => r.moneda }),
    meta: { width: "w-[140px]", align: "right", className: "tabular-nums whitespace-nowrap font-medium" } },
]);

export function BandejaPorTimbrar() {
  const { data, isLoading } = useFacturasPorTimbrar();
  const paged = useClientPagedList<FilaPorTimbrar, Record<string, string>>({
    data,
    isLoading,
    defaultFilters: {},
    defaultSort: { key: "emision", dir: "desc" },
    searchAccessor: (r) => `${r.numero} ${r.cliente_nombre}`,
    sorters: {
      numero: (a, b) => a.numero.localeCompare(b.numero),
      cliente: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
      emision: (a, b) => a.fecha_emision.localeCompare(b.fecha_emision),
      total: (a, b) => a.total - b.total,
    },
  });
  const totalCount = data?.length ?? 0;

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
        Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} borradores
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyIcon={FileClock}
            emptyMessage="No hay facturas pendientes de timbrar. ✅"
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
