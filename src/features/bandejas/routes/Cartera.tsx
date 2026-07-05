/**
 * Cartera — facturas emitidas con saldo pendiente.
 * v13.172.16: migrado a DataTable + columnBuilders para unificar con el resto de la app.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCarteraPendiente } from "@/features/bandejas/hooks/useBandejas";
import { resumirCartera } from "@/features/bandejas/domain/aggregates";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { dateColumn, moneyColumn } from "@/components/shared/dataTable/columnBuilders";
import { sortByNumber, sortByString } from "@/components/shared/dataTable/sortingFns";
import EmptyState from "@/components/empty/EmptyState";

type CarteraRow = NonNullable<ReturnType<typeof useCarteraPendiente>["data"]>[number];

export default function Cartera() {
  const { data = [], isLoading } = useCarteraPendiente();
  const { totalSaldo, vencidas, vencidoSaldo } = resumirCartera(data);

  const columns: ColumnDef<CarteraRow, unknown>[] = useMemo(
    () =>
      defineColumns<CarteraRow>([
        {
          id: "numero",
          header: "Folio",
          accessorFn: (r) => r.numero ?? "",
          enableSorting: true,
          sortingFn: sortByString<CarteraRow>((r) => r.numero ?? ""),
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
          sortingFn: sortByString<CarteraRow>((r) => r.cliente_nombre ?? ""),
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
          sortingFn: sortByNumber<CarteraRow>((r) => r.dias_vencido),
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

      {/* Mobile: lista de tarjetas (sm:hidden). Las cifras nunca quedan cortadas. */}
      <Card className="sm:hidden">
        <CardContent className="p-0">
          {isLoading && (
            <div className="py-8 text-center text-muted-foreground">Cargando...</div>
          )}
          {!isLoading && data.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Sin cartera pendiente. ¡Todo cobrado!
            </div>
          )}
          <ul className="divide-y">
            {data.map((row) => (
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

      {/* Desktop / tablet: DataTable unificada. */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <DataTable<CarteraRow>
            columns={columns}
            data={data}
            rowKey={(r) => r.factura_id}
            loading={isLoading}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Inbox}
                  title="Sin cartera pendiente"
                  description="¡Todo cobrado!"
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
