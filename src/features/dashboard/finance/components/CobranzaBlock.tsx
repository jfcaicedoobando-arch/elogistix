import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { ArrowRight, ChevronRight, PartyPopper, Receipt } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import { CUBETAS_VENCIDAS, type ResumenAgingMxn } from "@/lib/domain/carteraAging";
import { AGING_SOFT_CLASS, CUBETA_LABELS, CUBETA_NIVEL } from "@/lib/aging/buckets";
import { Hint } from "@/components/shared/Hint";

interface FacturaVencida {
  id: string;
  numero: string;
  cliente_nombre: string;
  saldo: number;
  moneda: string;
  dias_vencido: number;
}

interface Props {
  /** Resumen calculado por el canon `resumirAgingMxn`. */
  aging: ResumenAgingMxn;
  facturasVencidas: FacturaVencida[];
  loading: boolean;
}

export function CobranzaBlock({ aging, facturasVencidas, loading }: Props) {
  const totalAging = aging.totalVencido;
  const agingSinTc = aging.sinTipoCambio;


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Cobranza — Aging</CardTitle>
        <Button variant="link" size="sm" asChild className="h-auto p-0 text-body-sm">
            <Link to="/cobranza" className="flex items-center gap-1">
              Ver cartera <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : totalAging === 0 ? (
          <EmptyStateInline icon={PartyPopper} message="Sin saldo vencido" className="py-4" />
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
                  <p className="text-label text-muted-foreground text-center">{label}</p>
                  <Hint label={formatCurrency(value, "MXN")}>
                    <p className="text-body-sm font-semibold text-center tabular-nums truncate">
                      {formatCurrencyCompact(value, "MXN")}
                    </p>
                  </Hint>
                </div>
              );
            })}
          </div>
        )}
        {agingSinTc > 0 && !loading && (
          <p className="text-label text-muted-foreground">
            {agingSinTc} factura(s) en moneda extranjera sin tipo de cambio no se incluyen en el total en MXN.
          </p>
        )}

        <div>
          <p className="text-body-sm font-medium text-muted-foreground mb-2">
            Top 10 facturas vencidas
          </p>
          {loading ? (
            <ListSkeleton rows={4} />
          ) : facturasVencidas.length === 0 ? (
            <EmptyStateInline icon={Receipt} message="Sin facturas vencidas" className="py-4" />
          ) : (
            <ul className="divide-y rounded-md border">
              {facturasVencidas.map((f) => (
                <DrilldownRow
                  key={f.id}
                  as="li"
                  href={`/facturacion/${f.id}`}
                  ariaLabel={`Abrir factura ${f.numero}`}
                  className="px-3 py-2 text-body flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{f.numero}</p>
                    <p className="text-body-sm text-muted-foreground truncate">
                      {f.cliente_nombre}
                    </p>
                  </div>
                  <span className="text-body tabular-nums font-semibold">
                    {formatCurrency(f.saldo, f.moneda)}
                  </span>
                  <Badge variant="outline" className="text-label border-destructive/40 text-destructive">
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
