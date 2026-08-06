import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { ArrowRight, ChevronRight } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import type { AgingBuckets } from "@/features/dashboard/finance/hooks/useFinanceDashboard";

interface FacturaVencida {
  id: string;
  numero: string;
  cliente_nombre: string;
  saldo: number;
  moneda: string;
  dias_vencido: number;
}

interface Props {
  aging: AgingBuckets;
  facturasVencidas: FacturaVencida[];
  loading: boolean;
}

const AGING_LABELS: Array<{ key: keyof AgingBuckets; label: string; tone: string }> = [
  { key: "b0_15", label: "0-15 d", tone: "bg-aging-1/20 text-foreground" },
  { key: "b16_30", label: "16-30 d", tone: "bg-aging-2/25 text-foreground" },
  { key: "b31_60", label: "31-60 d", tone: "bg-aging-3/30 text-foreground" },
  { key: "b61_90", label: "61-90 d", tone: "bg-aging-4/35 text-foreground" },
  { key: "b90plus", label: "90+ d", tone: "bg-aging-5/40 text-foreground" },
];

export function CobranzaBlock({ aging, facturasVencidas, loading }: Props) {
  const totalAging =
    aging.b0_15 + aging.b16_30 + aging.b31_60 + aging.b61_90 + aging.b90plus;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Cobranza — Aging</CardTitle>
        <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs">
            <Link to="/cartera" className="flex items-center gap-1">
              Ver cartera <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : totalAging === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin saldo vencido 🎉
          </p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {AGING_LABELS.map(({ key, label, tone }) => {
              const value = aging[key];
              const pct = totalAging > 0 ? (value / totalAging) * 100 : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="h-20 flex flex-col justify-end rounded-md border bg-muted/30 relative overflow-hidden">
                    <div
                      className={tone}
                      style={{ height: `${Math.max(pct, value > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <p className="text-2xs text-muted-foreground text-center">{label}</p>
                  <p
                    className="text-xs font-semibold text-center tabular-nums truncate"
                    title={formatCurrency(value, "MXN")}
                  >
                    {formatCurrencyCompact(value, "MXN")}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Top 10 facturas vencidas
          </p>
          {loading ? (
            <ListSkeleton rows={4} />
          ) : facturasVencidas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sin facturas vencidas
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {facturasVencidas.map((f) => (
                <DrilldownRow
                  key={f.id}
                  as="li"
                  href={`/facturacion/${f.id}`}
                  ariaLabel={`Abrir factura ${f.numero}`}
                  className="px-3 py-2 text-sm flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{f.numero}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {f.cliente_nombre}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums font-semibold">
                    {formatCurrency(f.saldo, f.moneda)}
                  </span>
                  <Badge variant="outline" className="text-2xs border-destructive/40 text-destructive">
                    {f.dias_vencido} d
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                </DrilldownRow>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
