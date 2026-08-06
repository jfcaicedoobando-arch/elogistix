import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, FileWarning } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { EmbarquesPendientesAdminCard } from "@/features/dashboard/components/EmbarquesPendientesAdminCard";

interface Props {
  huecoTotal: number;
  huecoUsd: number;
  huecoMxn: number;
  loading: boolean;
}

export function CierreAdminBlock({ huecoTotal, huecoUsd, huecoMxn, loading }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <EmbarquesPendientesAdminCard enabled={true} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-warning" />
            Hueco de facturación
          </CardTitle>
          <Link
            to="/facturacion"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Ver hueco <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : huecoTotal === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sin huecos de facturación 🎉
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Tile label="Embarques" value={String(huecoTotal)} />
                <Tile
                  label="MXN"
                  value={formatCurrencyCompact(huecoMxn, "MXN")}
                  fullValue={formatCurrency(huecoMxn, "MXN")}
                />
                <Tile
                  label="USD"
                  value={formatCurrencyCompact(huecoUsd, "USD")}
                  fullValue={formatCurrency(huecoUsd, "USD")}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Embarques con conceptos de venta pendientes de facturar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, fullValue }: { label: string; value: string; fullValue?: string }) {
  return (
    <div className="rounded-md border p-3 min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className="text-base font-semibold tabular-nums truncate" title={fullValue ?? value}>
        {value}
      </p>
    </div>
  );
}
