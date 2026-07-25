import { useMemo } from "react";
import { Inbox } from "lucide-react";
import { useCxpPorPagar } from "@/features/bandejas/hooks/useBandejas";
import { agruparPorSemana, type FacturaProgramable } from "@/features/tesoreria/domain/pagosProgramados";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { moneyColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatDate, formatCurrency } from "@/lib/formatters";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/shared/skeletons";

export default function TesoreriaPagosProgramados() {
  const { data = [], isLoading } = useCxpPorPagar();

  const programables = useMemo(() => {
    return data.map(r => ({
      id: r.factura_id,
      proveedor_nombre: r.proveedor_nombre,
      folio_proveedor: r.folio_proveedor,
      fecha_vencimiento: r.fecha_vencimiento,
      fecha_programada_pago: r.fecha_programada_pago,
      moneda: r.moneda,
      total: Number(r.total),
      saldo: Number(r.saldo)
    })) as FacturaProgramable[];
  }, [data]);

  const semanas = useMemo(() => agruparPorSemana(programables), [programables]);

  const columns = useMemo(() => defineColumns<FacturaProgramable>([
    {
      id: "proveedor",
      header: "Proveedor",
      accessorFn: (r) => r.proveedor_nombre ?? "",
      meta: { width: "min-w-[180px]", className: "font-medium truncate" },
    },
    {
      id: "folio",
      header: "Folio",
      accessorFn: (r) => r.folio_proveedor ?? "",
      meta: { width: "w-[120px]", className: "font-mono text-xs" },
    },
    {
      id: "fecha",
      header: "Fecha (Venc/Prog)",
      meta: { width: "w-[150px]", className: "text-xs" },
      cell: ({ row }) => {
        const r = row.original;
        const fecha = r.fecha_programada_pago ?? r.fecha_vencimiento;
        return (
          <div className="flex items-center gap-1.5">
            <span>{fecha ? formatDate(fecha) : "—"}</span>
            {r.fecha_programada_pago && (
              <ToneBadge tone="info" size="sm">Prog.</ToneBadge>
            )}
          </div>
        );
      },
    },
    {
      ...moneyColumn<FacturaProgramable>({
        id: "monto",
        header: "Monto",
        accessor: (r) => r.total,
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[120px]", align: "right" },
    },
    {
      ...moneyColumn<FacturaProgramable>({
        id: "saldo",
        header: "Saldo",
        accessor: (r) => r.saldo,
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[120px]", align: "right", className: "font-semibold" },
    },
  ]), []);

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Pagos programados" description="Bandeja semanal de Tesorería." />
        <PageSkeleton />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Pagos programados"
        description="Bandeja semanal de Tesorería. Agrupación por fecha programada (o vencimiento)."
      />

      {semanas.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Sin pagos para mostrar</h3>
            <p className="text-sm text-muted-foreground">
              Las facturas de proveedor con fecha de vencimiento o programada aparecerán aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {semanas.map((s) => (
            <section key={s.semanaKey}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                Semana del {formatDate(s.semanaInicio)} al {formatDate(s.semanaFin)}
              </h2>
              <Card>
                <CardContent className="p-0">
                  <DataTable
                    columns={columns}
                    data={s.facturas}
                    rowKey={(r) => r.id}
                    density="compact"
                    hoverable={false}
                    footer={() => (
                      <div className="flex flex-wrap gap-x-6 gap-y-1 py-3 px-4 bg-muted/30">
                        <span className="text-xs font-bold uppercase text-muted-foreground">Totales:</span>
                        {Object.entries(s.totalesPorMoneda).map(([moneda, total]) => (
                          <span key={moneda} className="text-sm font-semibold tabular-nums">
                            {formatCurrency(total, moneda)}
                          </span>
                        ))}
                      </div>
                    )}
                  />
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
