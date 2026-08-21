/**
 * Bandeja "Proformas listas": proformas aprobadas sin factura asociada.
 * Estados unificados vía `<BandejaShell />`.
 */
import { Card, CardContent } from "@/components/ui/card";
import { FileCheck2 } from "lucide-react";
import { defineColumns } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { clientColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatDate, toTitleCase } from "@/lib/formatters";
import { formatCurrency } from "@/lib/formatters";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useProformasListas, type FilaProformaLista } from "@/features/facturacion/hooks/useProformasListas";
import { BandejaShell } from "./BandejaShell";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

const columns = defineColumns<FilaProformaLista>([
  {
    id: "numero",
    header: "Nº proforma",
    accessorFn: (r) => r.numero ?? "",
    enableSorting: true,
    meta: { width: COL_W.monto, className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.numero || "—",
  },
  clientColumn<FilaProformaLista>({ accessor: (r) => r.cliente_nombre }),
  {
    id: "expediente",
    header: "Expediente",
    accessorFn: (r) => r.expediente ?? "",
    enableSorting: true,
    meta: { width: COL_W.folio, className: "font-mono text-body-sm whitespace-nowrap hidden md:table-cell", headerClassName: "hidden md:table-cell" },
    cell: ({ row }) => row.original.expediente ?? "—",
  },
  {
    id: "total",
    header: "Total",
    accessorFn: (r) => (r.total_usd && r.total_usd > 0 ? r.total_usd : r.total_mxn ?? 0),
    enableSorting: true,
    meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-medium" },
    cell: ({ row }) => {
      const r = row.original;
      if (r.total_usd && r.total_usd > 0) return formatCurrency(r.total_usd, "USD");
      if (r.total_mxn && r.total_mxn > 0) return formatCurrency(r.total_mxn, "MXN");
      return "—";
    },
  },
  { ...dateColumn<FilaProformaLista>({ id: "aprobada", header: "Aprobada", accessor: (r) => r.created_at }),
    meta: { width: COL_W.fecha, className: "text-body-sm whitespace-nowrap" } },
]);

export function BandejaProformasListas() {
  const { data, isLoading, isError, refetch } = useProformasListas();
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
    <BandejaShell
      isError={isError}
      onRetry={() => refetch()}
      search={paged.search}
      onSearchChange={paged.setSearch}
      searchPlaceholder="Buscar proforma, cliente o expediente…"
      chips={paged.activeChips}
      activeCount={paged.activeCount}
      onClearAll={paged.resetAll}
      counter={<>Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} proformas listas</>}
    >
      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-body text-muted-foreground px-4">
                <FileCheck2 className="h-8 w-8 opacity-40" strokeWidth={1.5} />
                <span>Sin proformas aceptadas pendientes de convertir a CFDI.</span>
              </div>
            }
            rowKey={(r) => r.id}
            getRowHref={(r) => `/proformas/${r.id}`}
            getRowAriaLabel={(r) => `Abrir proforma ${r.numero || r.id}`}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-body truncate font-mono">{r.numero || "—"}</div>
                  <div className="text-body-sm text-muted-foreground truncate mt-0.5">{toTitleCase(r.cliente_nombre)}</div>
                  <div className="text-label text-muted-foreground mt-0.5">{r.expediente ?? "—"} · {formatDate(r.created_at)}</div>
                </div>
                <span className="text-body font-semibold tabular-nums whitespace-nowrap">
                  {r.total_usd && r.total_usd > 0 ? formatCurrency(r.total_usd, "USD") : r.total_mxn && r.total_mxn > 0 ? formatCurrency(r.total_mxn, "MXN") : "—"}
                </span>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </BandejaShell>
  );
}
