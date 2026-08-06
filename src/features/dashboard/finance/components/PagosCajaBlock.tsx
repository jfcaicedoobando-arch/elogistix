import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { ArrowRight, Wallet, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { formatCurrency, formatFechaEs } from "@/lib/formatters";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import type { ResumenTesoreria } from "@/features/tesoreria/domain";

interface CxpItem {
  id: string;
  folio_proveedor: string;
  proveedor_nombre: string;
  saldo: number;
  moneda: string;
  fecha_vencimiento: string | null;
  embarque_id?: string | null;
}

interface Props {
  tesoreria: ResumenTesoreria | undefined;
  cxpPorPagar: CxpItem[];
  loading: boolean;
}

export function PagosCajaBlock({ tesoreria, cxpPorPagar, loading }: Props) {
  const saldoMxn = (tesoreria?.cuentas ?? [])
    .filter((c) => c.moneda === "MXN")
    .reduce((s, c) => s + c.saldo, 0);
  const saldoUsd = (tesoreria?.cuentas ?? [])
    .filter((c) => c.moneda === "USD")
    .reduce((s, c) => s + c.saldo, 0);
  const flujo = tesoreria?.flujo;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Pagos & Caja</CardTitle>
        <Link
          to="/tesoreria"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          Ver tesorería <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SaldoTile
            label="Saldo en bancos"
            mxn={saldoMxn}
            usd={saldoUsd}
            loading={loading}
            icon={<Wallet className="h-4 w-4 text-success" />}
          />
          <FlujoTile
            label="Por cobrar 30 d"
            mxn={flujo?.por_cobrar_mxn ?? 0}
            usd={flujo?.por_cobrar_usd ?? 0}
            loading={loading}
            positive
          />
          <FlujoTile
            label="Por pagar 30 d"
            mxn={flujo?.por_pagar_mxn ?? 0}
            usd={flujo?.por_pagar_usd ?? 0}
            loading={loading}
          />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Top 10 facturas proveedor próximas a pagar
          </p>
          {loading ? (
            <ListSkeleton rows={4} />
          ) : cxpPorPagar.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nada por pagar 🎉
            </p>
          ) : (
              <ul className="divide-y rounded-md border">
                {cxpPorPagar.map((f) => {
                  const to = f.embarque_id ? `/embarques/${f.embarque_id}` : "/compras/facturas";
                  return (
                    <DrilldownRow
                      key={f.id}
                      as="li"
                      href={to}
                      ariaLabel={`Abrir ${f.embarque_id ? "embarque" : "CxP"} ${f.folio_proveedor}`}
                      className="px-3 py-2 text-sm flex items-center gap-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{f.folio_proveedor || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {f.proveedor_nombre}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums font-semibold">
                        {formatCurrency(f.saldo, f.moneda)}
                      </span>
                      <span className="text-2xs text-muted-foreground w-20 text-right">
                        {f.fecha_vencimiento
                          ? formatFechaEs(f.fecha_vencimiento, { day: "2-digit", month: "short" })
                          : "—"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    </DrilldownRow>
                  );
                })}
              </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SaldoTile({
  label,
  mxn,
  usd,
  loading,
  icon,
}: {
  label: string;
  mxn: number;
  usd: number;
  loading: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-24 mt-1" />
      ) : (
        <>
          <p className="text-lg font-semibold tabular-nums mt-1">
            {formatCurrency(mxn, "MXN")}
          </p>
          {usd > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              + {formatCurrency(usd, "USD")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function FlujoTile({
  label,
  mxn,
  usd,
  loading,
  positive,
}: {
  label: string;
  mxn: number;
  usd: number;
  loading: boolean;
  positive?: boolean;
}) {
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? "text-success" : "text-destructive";
  return (
    <div className="rounded-md border p-3">
      <div className={`flex items-center gap-2 text-xs text-muted-foreground`}>
        <Icon className={`h-4 w-4 ${color}`} />
        <span>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-24 mt-1" />
      ) : (
        <>
          <p className="text-lg font-semibold tabular-nums mt-1">
            {formatCurrency(mxn, "MXN")}
          </p>
          {usd > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              + {formatCurrency(usd, "USD")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
