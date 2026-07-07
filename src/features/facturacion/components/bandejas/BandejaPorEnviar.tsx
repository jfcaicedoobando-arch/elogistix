/**
 * Bandeja "Por enviar": CFDI ya timbrados sin envío al cliente.
 * Estados unificados vía `<BandejaShell />`.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Send } from "lucide-react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useFacturasPorEnviar, type FilaPorEnviar } from "@/features/facturacion/hooks/useBandejas";
import { BandejaShell } from "./BandejaShell";

const columns = defineColumns<FilaPorEnviar>([
  {
    id: "numero",
    header: "Folio",
    accessorFn: (r) => r.numero,
    enableSorting: true,
    meta: { width: "w-[140px]", className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.numero,
  },
  clientColumn<FilaPorEnviar>({ accessor: (r) => r.cliente_nombre }),
  { ...dateColumn<FilaPorEnviar>({ id: "emision", header: "Emisión", accessor: (r) => r.fecha_emision }),
    meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" } },
  { ...moneyColumn<FilaPorEnviar>({ id: "total", header: "Total",
      accessor: (r) => r.total, currencyAccessor: (r) => r.moneda }),
    meta: { width: "w-[140px]", align: "right", className: "tabular-nums whitespace-nowrap font-medium" } },
]);

export function BandejaPorEnviar() {
  const { data, isLoading, isError, refetch } = useFacturasPorEnviar();
  const paged = useClientPagedList<FilaPorEnviar, Record<string, string>>({
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
      counter={<>Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} CFDI por enviar</>}
    >
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyIcon={Send}
            emptyMessage="Todos los CFDI timbrados ya se enviaron."
            emptyHint="Cuando un CFDI se timbre y aún no se envíe por correo, aparecerá aquí."
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
