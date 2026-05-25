import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarDays, TrendingUp, Ship, CheckCircle2, Info } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";

export interface ArribosEsteMes {
  total: number;
  yaLlegaron: number;
  enCamino: number;
  profitUSD: number;
  ventaMXN: number;
  costoMXN: number;
  profitMXN: number;
  ventaMxnFromUsd: number;
  costoMxnFromUsd: number;
  ventaMxnFromEur: number;
  costoMxnFromEur: number;
  ventaMxnNative: number;
  costoMxnNative: number;
}

interface Props {
  arribosEsteMes: ArribosEsteMes;
  isLoading: boolean;
}

export function ArribosCard({ arribosEsteMes, isLoading }: Props) {
  const pct = arribosEsteMes.total > 0
    ? Math.round((arribosEsteMes.yaLlegaron / arribosEsteMes.total) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">Arribos este mes</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 flex-1">
            <div className="text-center">
              {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : (
                <span className="text-xl font-bold text-foreground tabular-nums">{arribosEsteMes.total}</span>
              )}
              <p className="text-[11px] text-muted-foreground font-medium">Total</p>
            </div>

            <div className="text-center">
              {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : (
                <div className="flex items-center gap-1 justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="text-xl font-bold text-success tabular-nums">{arribosEsteMes.yaLlegaron}</span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground font-medium">Ya llegaron</p>
            </div>

            <div className="text-center">
              {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : (
                <div className="flex items-center gap-1 justify-center">
                  <Ship className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xl font-bold text-warning tabular-nums">{arribosEsteMes.enCamino}</span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground font-medium">En camino</p>
            </div>

            <div className="text-center">
              {isLoading ? <Skeleton className="h-6 w-20 mx-auto" /> : (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="flex items-center gap-1 justify-center w-full cursor-help">
                        <TrendingUp className={`h-3.5 w-3.5 ${arribosEsteMes.profitMXN >= 0 ? "text-success" : "text-destructive"}`} />
                        <span className={`text-base sm:text-xl font-bold tabular-nums whitespace-nowrap ${arribosEsteMes.profitMXN >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrencyCompact(arribosEsteMes.profitMXN, "MXN")}
                        </span>
                        <Info className="h-3 w-3 text-muted-foreground/70" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-1.5 text-xs">
                        <div className="font-semibold border-b pb-1 mb-1">Profit homologado a MXN</div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Venta total:</span>
                          <span className="tabular-nums font-medium">{formatCurrency(arribosEsteMes.ventaMXN, "MXN")}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Costo total:</span>
                          <span className="tabular-nums font-medium">{formatCurrency(arribosEsteMes.costoMXN, "MXN")}</span>
                        </div>
                        <div className="flex justify-between gap-3 border-t pt-1 mt-1">
                          <span className="font-medium">Profit:</span>
                          <span className={`tabular-nums font-bold ${arribosEsteMes.profitMXN >= 0 ? "text-success" : "text-destructive"}`}>
                            {formatCurrency(arribosEsteMes.profitMXN, "MXN")}
                          </span>
                        </div>
                        <div className="border-t pt-1.5 mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                          <div className="font-medium text-foreground/80 mb-0.5">Desglose por moneda origen:</div>
                          <div className="flex justify-between gap-3">
                            <span>Desde USD:</span>
                            <span className="tabular-nums">V {formatCurrency(arribosEsteMes.ventaMxnFromUsd, "MXN")} · C {formatCurrency(arribosEsteMes.costoMxnFromUsd, "MXN")}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Desde EUR:</span>
                            <span className="tabular-nums">V {formatCurrency(arribosEsteMes.ventaMxnFromEur, "MXN")} · C {formatCurrency(arribosEsteMes.costoMxnFromEur, "MXN")}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Nativo MXN:</span>
                            <span className="tabular-nums">V {formatCurrency(arribosEsteMes.ventaMxnNative, "MXN")} · C {formatCurrency(arribosEsteMes.costoMxnNative, "MXN")}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground italic pt-1 border-t mt-1">
                          Conversión con TC guardado en cada embarque.
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <p className="text-[11px] text-muted-foreground font-medium">Profit MXN proyectado</p>
            </div>
          </div>

          <div className="flex items-center gap-2 xl:w-40 shrink-0">
            <Progress
              value={pct}
              className="h-2 flex-1 [&>div]:bg-kpi-secondary"
            />
            <span className="text-xs text-muted-foreground font-medium w-8 text-right">
              {pct}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
