/**
 * Bandeja "Proformas listas": proformas aprobadas sin factura asociada.
 * Patrón unificado: Card + UnifiedFiltersBar + useClientPagedList.
 */

import { Card, CardContent } from "@/components/ui/card";
import { FileCheck2 } from "lucide-react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { clientColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatCurrency } from "@/lib/formatters";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useProformasListas, type FilaProformaLista } from "@/features/facturacion/hooks/useProformasListas";

const columns = defineColumns<FilaProformaLista>([
  {
    id: "numero",
    header: "Nº proforma",
    accessorFn: (r) => r.numero ?? "",
    enableSorting: true,
    meta: { width: "w-[140px]", className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.numero || "—",
  },
  clientColumn<FilaProformaLista>({ accessor: (r) => r.cliente_nombre }),
  {
    id: "expediente",
    header: "Expediente",
    accessorFn: (r) => r.expediente ?? "",
    enableSorting: true,
    meta: { width: "w-[120px]", className: "font-mono text-xs whitespace-nowrap hidden md:table-cell", headerClassName: "hidden md:table-cell" },
    cell: ({ row }) => row.original.expediente ?? "—",
  },
  {
    id: "total",
    header: "Total",
    accessorFn: (r) => (r.total_usd && r.total_usd > 0 ? r.total_usd : r.total_mxn ?? 0),
    enableSorting: true,
    meta: { width: "w-[140px]", align: "right", className: "tabular-nums whitespace-nowrap font-medium" },
    cell: ({ row }) => {
      const r = row.original;
      if (r.total_usd && r.total_usd > 0) return formatCurrency(r.total_usd, "USD");
      if (r.total_mxn && r.total_mxn > 0) return formatCurrency(r.total_mxn, "MXN");
      return "—";
    },
  },
  { ...dateColumn<FilaProformaLista>({ id: "aprobada", header: "Aprobada", accessor: (r) => r.created_at }),
    meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" } },
]);

export function BandejaProformasListas() {
  const { data, isLoading } = useProformasListas();
  const paged = useClientPagedList<FilaProformaLista, Record<string, string>>({
    data,
    isLoading,
    defaultFilters: {},
    defaultSort: { key: "aprobada", dir: "desc" },
    searchAccessor: (r) => `${r.numero ?? ""} ${r.cliente_nombre} ${r.expediente ?? ""}`,
    sorters: {
      numero: (a, b) => (a.numero ?? "").localeCompare(b.numero ?? ""),
      cliente: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
      expediente: (a, b) => (a.expediente ?? "").localeCompare(b.expediente ?? ""),
      total: (a, b) => (a.total_usd || a.total_mxn || 0) - (b.total_usd || b.total_mxn || 0),
      aprobada: (a, b) => a.created_at.localeCompare(b.created_at),
    },
  });
  const totalCount = data?.length ?? 0;

  return (
    <div className="space-y-3">
      <UnifiedFiltersBar
        search={paged.search}
        onSearchChange={paged.setSearch}
        searchPlaceholder="Buscar proforma, cliente o expediente…"
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />
      <div className="text-xs text-muted-foreground">
        Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} proformas listas
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyIcon={FileCheck2}
            emptyMessage="No hay proformas aceptadas por el cliente pendientes de facturar. ✅"
            rowKey={(r) => r.id}
            getRowHref={(r) => `/proformas/${r.id}`}
            getRowAriaLabel={(r) => `Abrir proforma ${r.numero || r.id}`}
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
