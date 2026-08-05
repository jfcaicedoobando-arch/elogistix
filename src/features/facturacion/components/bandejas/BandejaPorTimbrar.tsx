/**
 * Bandeja "Por timbrar": borradores creados en el sistema pendientes de FacturApi.
 * Estados unificados vía `<BandejaShell />` (loading + empty + error).
 */
import { Card, CardContent } from "@/components/ui/card";
import { Stamp } from "lucide-react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useFacturasPorTimbrar, type FilaPorTimbrar } from "@/features/facturacion/hooks/useBandejas";
import { BandejaShell } from "./BandejaShell";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

const columns = defineColumns<FilaPorTimbrar>([
  {
    id: "numero",
    header: "Folio interno",
    accessorFn: (r) => r.numero,
    enableSorting: true,
    meta: { width: COL_W.nombre, className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) =>
      row.original.numero.startsWith("BORRADOR-")
        ? <span className="text-muted-foreground italic">Sin folio</span>
        : row.original.numero,
  },
  clientColumn<FilaPorTimbrar>({ accessor: (r) => r.cliente_nombre }),
  { ...dateColumn<FilaPorTimbrar>({ id: "emision", header: "Emisión", accessor: (r) => r.fecha_emision }),
    meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap" } },
  { ...moneyColumn<FilaPorTimbrar>({ id: "total", header: "Total",
      accessor: (r) => r.total, currencyAccessor: (r) => r.moneda }),
    meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-medium" } },
]);

export function BandejaPorTimbrar() {
  const { data, isLoading, isError, refetch } = useFacturasPorTimbrar();
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
    <BandejaShell
      isError={isError}
      onRetry={() => refetch()}
      search={paged.search}
      onSearchChange={paged.setSearch}
      searchPlaceholder="Buscar folio o cliente…"
      chips={paged.activeChips}
      activeCount={paged.activeCount}
      onClearAll={paged.resetAll}
      counter={<>Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} borradores</>}
    >
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyIcon={Stamp}
            emptyMessage="No hay CFDI en borrador esperando timbrado."
            emptyHint="Aquí aparecerán las facturas pendientes de timbrar ante el SAT."
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
    </BandejaShell>
  );
}
