/**
 * CxP Por Pagar — facturas de proveedor vigentes con saldo.
 * v13.172.16: migrado a DataTable + columnBuilders para unificar con el resto de la app.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/formatters";
import { useCxpPorPagar } from "@/features/bandejas/hooks/useBandejas";
import { resumirCxpPorPagar, variantDiasParaVencer } from "@/features/bandejas/domain/aggregates";
import { ComprasTabStrip } from "@/features/cxp/components/ComprasTabStrip";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { moneyColumn } from "@/components/shared/dataTable/columnBuilders";
import { sortByNumber, sortByString } from "@/components/shared/dataTable/sortingFns";
import EmptyState from "@/components/empty/EmptyState";

type CxpRow = NonNullable<ReturnType<typeof useCxpPorPagar>["data"]>[number];

export default function CxpPorPagar() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useCxpPorPagar();
  const { saldoMXN, porMoneda, faltaTipoCambio, vencidas } = resumirCxpPorPagar(data);

  const columns: ColumnDef<CxpRow, unknown>[] = useMemo(
    () =>
      defineColumns<CxpRow>([
        {
          id: "proveedor",
          header: "Proveedor",
          accessorFn: (r) => r.proveedor_nombre ?? "",
          enableSorting: true,
          sortingFn: sortByString<CxpRow>((r) => r.proveedor_nombre ?? ""),
          meta: { width: "min-w-[180px]", className: "font-medium max-w-[240px] truncate", sticky: true },
          cell: ({ row }) => row.original.proveedor_nombre ?? "—",
        },
        {
          id: "folio",
          header: "Folio",
          accessorFn: (r) => r.folio_proveedor ?? "",
          enableSorting: true,
          sortingFn: sortByString<CxpRow>((r) => r.folio_proveedor ?? ""),
          meta: { width: "w-[130px]", className: "font-mono text-xs whitespace-nowrap" },
          cell: ({ row }) => row.original.folio_proveedor ?? "—",
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
          id: "vencimiento",
          header: "Vencimiento",
          accessorFn: (r) => r.fecha_vencimiento ?? "",
          enableSorting: true,
          meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" },
          cell: ({ row }) =>
            row.original.fecha_vencimiento ? formatDate(row.original.fecha_vencimiento) : "—",
        },
        {
          id: "dias",
          header: "Días",
          accessorFn: (r) => r.dias_para_vencer ?? 0,
          enableSorting: true,
          sortingFn: sortByNumber<CxpRow>((r) => r.dias_para_vencer ?? 0),
          meta: { width: "w-[90px]", align: "center" },
          cell: ({ row }) => {
            const dias = row.original.dias_para_vencer ?? 0;
            const variant = variantDiasParaVencer(dias);
            return (
              <Badge variant={variant}>
                {dias < 0 ? `${Math.abs(dias)} venc.` : `${dias}d`}
              </Badge>
            );
          },
        },
        {
          ...moneyColumn<CxpRow>({
            id: "total",
            header: "Total",
            accessor: (r) => Number(r.total),
            currencyAccessor: (r) => r.moneda,
          }),
          meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
        },
        {
          ...moneyColumn<CxpRow>({
            id: "pagado",
            header: "Pagado",
            accessor: (r) => Number(r.pagado),
            currencyAccessor: (r) => r.moneda,
          }),
          meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap text-success hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
        },
        {
          ...moneyColumn<CxpRow>({
            id: "saldo",
            header: "Saldo",
            accessor: (r) => Number(r.saldo),
            currencyAccessor: (r) => r.moneda,
          }),
          meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
        },
      ]),
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="CxP — Por pagar"
        description="Facturas de proveedor vigentes con saldo. Programa y registra los pagos."
      />

      <ComprasTabStrip />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas vigentes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo total</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(saldoMXN, "MXN")}</div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
              {porMoneda.MXN > 0 && <span>MXN {formatCurrencyCompact(porMoneda.MXN, "MXN")}</span>}
              {porMoneda.USD > 0 && <span>· USD {formatCurrencyCompact(porMoneda.USD, "USD")}</span>}
              {porMoneda.EUR > 0 && <span>· EUR {formatCurrencyCompact(porMoneda.EUR, "EUR")}</span>}
            </div>
            {faltaTipoCambio > 0 && (
              <p className="text-2xs text-warning mt-0.5">
                {faltaTipoCambio} factura{faltaTipoCambio > 1 ? "s" : ""} sin TC capturado — no incluida{faltaTipoCambio > 1 ? "s" : ""} en homologado.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vencidas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{vencidas}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable<CxpRow>
            columns={columns}
            data={data}
            rowKey={(r) => r.factura_id}
            loading={isLoading}
            onRowClick={(r) => navigate(`/cxp?factura=${r.factura_id}`)}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Inbox}
                  title="Sin facturas pendientes de pago"
                  description="Cuando ingreses una factura de proveedor, aparecerá aquí."
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
