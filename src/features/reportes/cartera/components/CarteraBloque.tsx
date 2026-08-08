/**
 * Bloque del reporte de cartera: KPIs por cubeta + tabla de facturas.
 */
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { carteraColumns } from "@/features/reportes/cartera/components/carteraColumns";
import {
  BUCKET_AGING_LABELS,
  type FilaCartera,
  type TotalBucket,
  type TotalesCartera,
} from "@/features/reportes/cartera/domain/agingCartera";

interface Props {
  titulo: string;
  etiquetaContraparte: string;
  filas: FilaCartera[];
  buckets: TotalBucket[];
  total: TotalesCartera;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function CarteraBloque({
  titulo, etiquetaContraparte, filas, buckets, total, isLoading, isError, onRetry,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{titulo}</h2>
        <p className="text-xs text-muted-foreground">
          {total.conteo} factura(s) · {formatCurrency(total.mxnCorte, "MXN")} al corte ·
          {" "}dif. cambiaria {formatCurrency(total.diferencia, "MXN")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {buckets.map((b) => (
          <Card key={b.bucket}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{BUCKET_AGING_LABELS[b.bucket]}</p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums",
                  b.bucket === "mas_90" || b.bucket === "d61_90"
                    ? "text-destructive"
                    : "text-foreground",
                )}
              >
                {formatCurrency(b.mxnCorte, "MXN")}
              </p>
              <p className="text-2xs text-muted-foreground">{b.conteo} factura(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable
        columns={carteraColumns(etiquetaContraparte)}
        data={filas}
        rowKey={(f) => f.id}
        density={TABLE_DENSITY.listado}
        striped
        stickyHeader
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyMessage="Sin saldos pendientes con estos filtros."
      />
    </section>
  );
}
