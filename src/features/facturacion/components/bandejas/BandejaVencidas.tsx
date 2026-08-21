/**
 * Bandeja "Vencidas": facturas con vencimiento pasado y saldo > 0.
 * Estados unificados vía `<BandejaShell />`.
 */
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlarmClock } from "lucide-react";
import { defineColumns } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";
import { agingVencidoBucket } from "@/features/facturacion/utils/aging";
import { BandejaShell } from "./BandejaShell";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

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

const columns = defineColumns<FilaVencida>([
  {
    id: "numero",
    header: "Folio",
    accessorFn: (r) => r.numero,
    enableSorting: true,
    meta: { width: COL_W.monto, className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.numero,
  },
  clientColumn<FilaVencida>({ accessor: (r) => r.cliente_nombre }),
  { ...dateColumn<FilaVencida>({ id: "vencimiento", header: "Venció", accessor: (r) => r.fecha_vencimiento }),
    meta: { width: COL_W.fecha, className: "text-body-sm whitespace-nowrap" } },
  {
    id: "dias",
    header: "Antigüedad",
    accessorFn: (r) => r.dias_vencido,
    enableSorting: true,
    meta: { width: COL_W.fecha, align: "center" },
    cell: ({ row }) => {
      const b = agingVencidoBucket(row.original.dias_vencido);
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-body-sm font-semibold tabular-nums whitespace-nowrap ${b.className}`}
          aria-label={b.ariaLabel}
        >
          {b.label}
        </span>
      );
    },
  },
  { ...moneyColumn<FilaVencida>({ id: "saldo", header: "Saldo",
      accessor: (r) => r.saldo, currencyAccessor: (r) => r.moneda }),
    meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-semibold" } },
]);

export function BandejaVencidas() {
  const { data, isLoading, isError, refetch } = useCobranza({ estatus: "todos", moneda: "todas" });
  const filas = useMemo<FilaVencida[]>(
    () => (data ?? []).filter((f) => f.saldo > 0 && f.estatus_cobranza === "Vencida"),
    [data],
  );
  const monedas = useMemo(
    () => Array.from(new Set(filas.map((r) => r.moneda).filter(Boolean))).sort(),
    [filas],
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
      primary={
        <Select value={paged.filters.moneda} onValueChange={(v) => paged.setFilter("moneda", v)}>
          <SelectTrigger className="w-[140px]" aria-label="Moneda">
            <SelectValue placeholder="Moneda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas monedas</SelectItem>
            {monedas.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
          </SelectContent>
        </Select>
      }
      counter={<>Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {filas.length} facturas vencidas</>}
    >
      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-body text-muted-foreground px-4">
                <AlarmClock className="h-8 w-8 opacity-40" strokeWidth={1.5} />
                <span>Sin cartera vencida — todas las facturas están al día.</span>
              </div>
            }
            rowKey={(r) => r.id}
            getRowHref={(r) => `/facturacion/${r.id}`}
            getRowAriaLabel={(r) => `Abrir factura ${r.numero}`}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            mobileCard={(r) => {
              const b = agingVencidoBucket(r.dias_vencido);
              return (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-body truncate font-mono">{r.numero}</div>
                    <div className="text-body-sm text-muted-foreground truncate mt-0.5">{toTitleCase(r.cliente_nombre)}</div>
                    <div className="text-label text-muted-foreground mt-0.5">
                      Venció {formatDate(r.fecha_vencimiento)} · {formatCurrency(r.saldo, r.moneda)}
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-body-sm font-semibold tabular-nums whitespace-nowrap ${b.className}`} aria-label={b.ariaLabel}>
                    {b.label}
                  </span>
                </div>
              );
            }}
          />
        </CardContent>
      </Card>
    </BandejaShell>
  );
}
