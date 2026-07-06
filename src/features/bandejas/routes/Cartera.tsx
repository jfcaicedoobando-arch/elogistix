/**
 * Cartera — facturas emitidas con saldo pendiente.
 *
 * v13.173.0 (Ola 1 · Filtros globales): migrada al primitivo unificado
 * `useClientPagedList` — search, filtros (moneda / vencidas), rango de fechas
 * de vencimiento, orden y paginación sincronizados con la URL vía `nuqs`, y
 * barra `<UnifiedFiltersBar />` compartida con Facturación/Embarques.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCarteraPendiente } from "@/features/bandejas/hooks/useBandejas";
import { resumirCartera } from "@/features/bandejas/domain/aggregates";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { dateColumn, moneyColumn } from "@/components/shared/dataTable/columnBuilders";

import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";

type CarteraRow = NonNullable<ReturnType<typeof useCarteraPendiente>["data"]>[number];

interface CarteraFilters extends Record<string, string> {
  moneda: string;
  vencidas: string; // "todas" | "si" | "no"
}

const DEFAULTS: CarteraFilters = { moneda: "todas", vencidas: "todas" };

function buildCarteraColumns(): ColumnDef<CarteraRow, unknown>[] {
  return defineColumns<CarteraRow>([
    {
      id: "numero",
      header: "Folio",
      accessorFn: (r) => r.numero ?? "",
      enableSorting: true,
      meta: { width: "w-[130px]", className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => (
        <Link
          to={`/facturacion/${row.original.factura_id}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.numero ?? "—"}
        </Link>
      ),
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (r) => r.cliente_nombre ?? "",
      enableSorting: true,
      meta: { width: "min-w-[180px]", className: "max-w-[240px] truncate" },
      cell: ({ row }) => (
        <span title={row.original.cliente_nombre ?? undefined}>
          {row.original.cliente_nombre ?? "—"}
        </span>
      ),
    },
    {
      id: "embarque",
      header: "Embarque",
      enableSorting: false,
      meta: { width: "w-[130px]", className: "font-mono text-xs hidden md:table-cell", headerClassName: "hidden md:table-cell" },
      cell: ({ row }) =>
        row.original.embarque_id ? (
          <Link
            to={`/embarques/${row.original.embarque_id}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.expediente ?? "—"}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      ...dateColumn<CarteraRow>({
        id: "vencimiento",
        header: "Vencimiento",
        accessor: (r) => r.fecha_vencimiento,
      }),
      meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" },
    },
    {
      id: "dias",
      header: "Días vencido",
      accessorFn: (r) => r.dias_vencido,
      enableSorting: true,
      meta: { width: "w-[110px]", align: "center", className: "whitespace-nowrap" },
      cell: ({ row }) => (
        <Badge variant={row.original.dias_vencido > 0 ? "destructive" : "secondary"}>
          {row.original.dias_vencido}d
        </Badge>
      ),
    },
    {
      ...moneyColumn<CarteraRow>({
        id: "total",
        header: "Total",
        accessor: (r) => Number(r.total),
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...moneyColumn<CarteraRow>({
        id: "saldo",
        header: "Saldo",
        accessor: (r) => Number(r.saldo),
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
    },
    {
      id: "ultimo",
      header: "Último contacto",
      enableSorting: false,
      meta: { width: "w-[130px]", className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) =>
        row.original.ultimo_contacto ? (
          formatDate(row.original.ultimo_contacto)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]);
}

export default function Cartera() {
  const { data = [], isLoading } = useCarteraPendiente();
  const { totalSaldo, vencidas, vencidoSaldo } = resumirCartera(data);

  const monedas = useMemo(
    () => Array.from(new Set(data.map((r) => r.moneda).filter(Boolean))).sort(),
    [data],
  );

  const paged = useClientPagedList<CarteraRow, CarteraFilters>({
    data,
    isLoading,
    defaultFilters: DEFAULTS,
    filterLabels: { moneda: "Moneda", vencidas: "Vencidas" },
    defaultSort: { key: "dias", dir: "desc" },
    searchAccessor: (r) =>
      `${r.numero ?? ""} ${r.cliente_nombre ?? ""} ${r.expediente ?? ""}`,
    filterPredicate: (r, ff) => {
      if (ff.moneda !== "todas" && r.moneda !== ff.moneda) return false;
      if (ff.vencidas === "si" && r.dias_vencido <= 0) return false;
      if (ff.vencidas === "no" && r.dias_vencido > 0) return false;
      return true;
    },
    dateAccessor: (r) => r.fecha_vencimiento,
    sorters: {
      numero: (a, b) => (a.numero ?? "").localeCompare(b.numero ?? ""),
      cliente: (a, b) => (a.cliente_nombre ?? "").localeCompare(b.cliente_nombre ?? ""),
      vencimiento: (a, b) => (a.fecha_vencimiento ?? "").localeCompare(b.fecha_vencimiento ?? ""),
      dias: (a, b) => a.dias_vencido - b.dias_vencido,
      total: (a, b) => Number(a.total) - Number(b.total),
      saldo: (a, b) => Number(a.saldo) - Number(b.saldo),
    },
  });

  const columns: ColumnDef<CarteraRow, unknown>[] = useMemo(
    () =>
      defineColumns<CarteraRow>([
        {
          id: "numero",
          header: "Folio",
          accessorFn: (r) => r.numero ?? "",
          enableSorting: true,
          meta: { width: "w-[130px]", className: "font-medium whitespace-nowrap", sticky: true },
          cell: ({ row }) => (
            <Link
              to={`/facturacion/${row.original.factura_id}`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.numero ?? "—"}
            </Link>
          ),
        },
        {
          id: "cliente",
          header: "Cliente",
          accessorFn: (r) => r.cliente_nombre ?? "",
          enableSorting: true,
          meta: { width: "min-w-[180px]", className: "max-w-[240px] truncate" },
          cell: ({ row }) => (
            <span title={row.original.cliente_nombre ?? undefined}>
              {row.original.cliente_nombre ?? "—"}
            </span>
          ),
        },
        {
          id: "embarque",
          header: "Embarque",
          enableSorting: false,
          meta: { width: "w-[130px]", className: "font-mono text-xs hidden md:table-cell", headerClassName: "hidden md:table-cell" },
          cell: ({ row }) =>
            row.original.embarque_id ? (
              <Link
                to={`/embarques/${row.original.embarque_id}`}
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.original.expediente ?? "—"}
              </Link>
            ) : (
              "—"
            ),
        },
        {
          ...dateColumn<CarteraRow>({
            id: "vencimiento",
            header: "Vencimiento",
            accessor: (r) => r.fecha_vencimiento,
          }),
          meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" },
        },
        {
          id: "dias",
          header: "Días vencido",
          accessorFn: (r) => r.dias_vencido,
          enableSorting: true,
          meta: { width: "w-[110px]", align: "center", className: "whitespace-nowrap" },
          cell: ({ row }) => (
            <Badge variant={row.original.dias_vencido > 0 ? "destructive" : "secondary"}>
              {row.original.dias_vencido}d
            </Badge>
          ),
        },
        {
          ...moneyColumn<CarteraRow>({
            id: "total",
            header: "Total",
            accessor: (r) => Number(r.total),
            currencyAccessor: (r) => r.moneda,
          }),
          meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
        },
        {
          ...moneyColumn<CarteraRow>({
            id: "saldo",
            header: "Saldo",
            accessor: (r) => Number(r.saldo),
            currencyAccessor: (r) => r.moneda,
          }),
          meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
        },
        {
          id: "ultimo",
          header: "Último contacto",
          enableSorting: false,
          meta: { width: "w-[130px]", className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
          cell: ({ row }) =>
            row.original.ultimo_contacto ? (
              formatDate(row.original.ultimo_contacto)
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ]),
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Cartera"
        description="Facturas emitidas con saldo pendiente. Da seguimiento a cobranza, registra promesas y cobros."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas con saldo</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totalSaldo, "MXN")}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vencido ({vencidas})</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{formatCurrency(vencidoSaldo, "MXN")}</CardContent>
        </Card>
      </div>

      <UnifiedFiltersBar
        search={paged.search}
        onSearchChange={paged.setSearch}
        searchPlaceholder="Buscar folio, cliente o expediente…"
        primary={
          <>
            <Select value={paged.filters.vencidas} onValueChange={(v) => paged.setFilter("vencidas", v)}>
              <SelectTrigger className="w-[160px]" aria-label="Vencidas">
                <SelectValue placeholder="Vencidas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="si">Solo vencidas</SelectItem>
                <SelectItem value="no">No vencidas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paged.filters.moneda} onValueChange={(v) => paged.setFilter("moneda", v)}>
              <SelectTrigger className="w-[140px]" aria-label="Moneda">
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas monedas</SelectItem>
                {monedas.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        secondary={
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cartera-from">Vencimiento desde</Label>
              <Input
                id="cartera-from"
                type="date"
                value={paged.dateFrom}
                onChange={(e) => paged.setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cartera-to">Vencimiento hasta</Label>
              <Input
                id="cartera-to"
                type="date"
                value={paged.dateTo}
                onChange={(e) => paged.setDateTo(e.target.value)}
              />
            </div>
          </div>
        }
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />

      {/* Mobile: lista de tarjetas (sm:hidden). Las cifras nunca quedan cortadas. */}
      <Card className="sm:hidden">
        <CardContent className="p-0">
          {isLoading && (
            <div className="py-8 text-center text-muted-foreground">Cargando...</div>
          )}
          {!isLoading && paged.rows.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Sin cartera pendiente. ¡Todo cobrado!
            </div>
          )}
          <ul className="divide-y">
            {paged.rows.map((row) => (
              <li key={row.factura_id} className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/facturacion/${row.factura_id}`}
                    className="font-semibold text-primary hover:underline truncate"
                  >
                    {row.numero ?? "—"}
                  </Link>
                  <Badge variant={row.dias_vencido > 0 ? "destructive" : "secondary"}>
                    {row.dias_vencido}d
                  </Badge>
                </div>
                <div className="text-sm font-medium truncate">{row.cliente_nombre ?? "—"}</div>
                {row.embarque_id && (
                  <Link
                    to={`/embarques/${row.embarque_id}`}
                    className="text-xs text-primary hover:underline block truncate"
                  >
                    {row.expediente ?? "—"}
                  </Link>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>
                    Vence: {row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}
                  </span>
                  <span className="tabular-nums">
                    Total: {formatCurrency(Number(row.total), row.moneda)}
                  </span>
                </div>
                <div className="text-right text-base font-semibold tabular-nums">
                  {formatCurrency(Number(row.saldo), row.moneda)}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Desktop / tablet: DataTable unificada con orden + paginación server-tagged. */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <DataTable<CarteraRow>
            columns={columns}
            data={paged.rows}
            rowKey={(r) => r.factura_id}
            isLoading={paged.isLoading}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            emptyIcon={Inbox}
            emptyMessage="Sin cartera pendiente"
            emptyHint="¡Todo cobrado!"
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
