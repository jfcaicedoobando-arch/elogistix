/**
 * Bandeja "REP pendientes": pagos aplicados a facturas PPD cuyo REP no se
 * ha timbrado. Estados unificados vía `<BandejaShell />`.
 */
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptText } from "lucide-react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { usePagosRepPendientes, type FilaRepPendiente } from "@/features/facturacion/hooks/useBandejas";
import { BandejaShell } from "./BandejaShell";

function badgeTone(estado: string): "outline" | "destructive" {
  return estado === "Error" ? "destructive" : "outline";
}

const columns = defineColumns<FilaRepPendiente>([
  {
    id: "factura",
    header: "Factura",
    accessorFn: (r) => r.factura_numero,
    enableSorting: true,
    meta: { width: "w-[140px]", className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.factura_numero,
  },
  clientColumn<FilaRepPendiente>({ accessor: (r) => r.cliente_nombre }),
  { ...dateColumn<FilaRepPendiente>({ id: "fecha_pago", header: "Fecha pago", accessor: (r) => r.fecha_pago }),
    meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" } },
  { ...moneyColumn<FilaRepPendiente>({ id: "monto", header: "Monto",
      accessor: (r) => r.monto, currencyAccessor: (r) => r.moneda }),
    meta: { width: "w-[140px]", align: "right", className: "tabular-nums whitespace-nowrap font-medium" } },
  {
    id: "estado",
    header: "Estado REP",
    accessorFn: (r) => r.estado_rep,
    enableSorting: true,
    meta: { width: "w-[120px]" },
    cell: ({ row }) => <Badge variant={badgeTone(row.original.estado_rep)}>{row.original.estado_rep}</Badge>,
  },
]);

interface Filters extends Record<string, string> { estado: string }
const DEFAULTS: Filters = { estado: "todos" };

export function BandejaRepPendientes() {
  const { data, isLoading, isError, refetch } = usePagosRepPendientes();
  const paged = useClientPagedList<FilaRepPendiente, Filters>({
    data,
    isLoading,
    defaultFilters: DEFAULTS,
    filterLabels: { estado: "Estado REP" },
    defaultSort: { key: "fecha_pago", dir: "desc" },
    searchAccessor: (r) => `${r.factura_numero} ${r.cliente_nombre}`,
    filterPredicate: (r, ff) => ff.estado === "todos" || r.estado_rep === ff.estado,
    sorters: {
      factura: (a, b) => a.factura_numero.localeCompare(b.factura_numero),
      cliente: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
      fecha_pago: (a, b) => a.fecha_pago.localeCompare(b.fecha_pago),
      monto: (a, b) => a.monto - b.monto,
      estado: (a, b) => a.estado_rep.localeCompare(b.estado_rep),
    },
  });
  const totalCount = data?.length ?? 0;

  return (
    <BandejaShell
      isError={isError}
      onRetry={() => refetch()}
      search={paged.search}
      onSearchChange={paged.setSearch}
      searchPlaceholder="Buscar factura o cliente…"
      chips={paged.activeChips}
      activeCount={paged.activeCount}
      onClearAll={paged.resetAll}
      primary={
        <Select value={paged.filters.estado} onValueChange={(v) => paged.setFilter("estado", v)}>
          <SelectTrigger className="w-[160px]" aria-label="Estado REP">
            <SelectValue placeholder="Estado REP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="Pendiente">Pendiente</SelectItem>
            <SelectItem value="Error">Error</SelectItem>
          </SelectContent>
        </Select>
      }
      counter={<>Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} complementos pendientes</>}
    >
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyIcon={ReceiptText}
            emptyMessage="Sin complementos de pago (REP) pendientes ante el SAT."
            emptyHint="Aquí aparecerán los pagos con complemento de pago (REP) pendiente de timbrar o con error ante el SAT."
            rowKey={(r) => r.id}
            getRowHref={(r) => `/facturacion/${r.factura_id}`}
            getRowAriaLabel={(r) => `Abrir factura ${r.factura_numero}`}
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
