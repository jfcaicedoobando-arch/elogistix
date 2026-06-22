import { Fragment } from "react";
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
  gastosOperativosMXN: number;
}

interface Props {
  arribosEsteMes: ArribosEsteMes;
  isLoading: boolean;
  hideFinancials?: boolean;
}

export function ArribosCard({ arribosEsteMes, isLoading, hideFinancials = false }: Props) {
  const gastos = arribosEsteMes.gastosOperativosMXN;
  const profitPositivo = Math.max(arribosEsteMes.profitMXN, 0);
  const pctReal = gastos > 0 ? Math.round((profitPositivo / gastos) * 100) : 0;
  const pctBarra = Math.min(100, pctReal);
  const faltante = Math.max(gastos - profitPositivo, 0);
  const sinGastos = gastos <= 0;
  const perdida = arribosEsteMes.profitMXN < 0;
  const barColor = perdida || pctReal < 50
    ? "[&>div]:bg-destructive"
    : pctReal < 100
      ? "[&>div]:bg-warning"
      : "[&>div]:bg-success";
  const pctTextColor = perdida || pctReal < 50
    ? "text-destructive"
    : pctReal < 100
      ? "text-warning"
      : "text-success";

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

          <div className={`grid ${hideFinancials ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"} gap-3 sm:gap-6 flex-1`}>
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

            {!hideFinancials && (
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
                    <TooltipContent side="bottom" className="w-[320px] p-3">
                      {(() => {
                        const venta = arribosEsteMes.ventaMXN;
                        const costo = arribosEsteMes.costoMXN;
                        const profit = arribosEsteMes.profitMXN;
                        const margenPct = venta > 0 ? (profit / venta) * 100 : 0;
                        const profitPositivo = profit >= 0;
                        const profitColor = profitPositivo ? "text-success" : "text-destructive";
                        const profitBg = profitPositivo ? "bg-success/10" : "bg-destructive/10";
                        // Proporciones para la barra costo vs profit (sobre venta)
                        const total = Math.max(venta, costo + Math.max(profit, 0));
                        const costoPct = total > 0 ? Math.min(100, (costo / total) * 100) : 0;
                        const profitBarPct = total > 0 ? Math.min(100 - costoPct, (Math.max(profit, 0) / total) * 100) : 0;
                        const desglose = [
                          { label: "USD", v: arribosEsteMes.ventaMxnFromUsd, c: arribosEsteMes.costoMxnFromUsd },
                          { label: "EUR", v: arribosEsteMes.ventaMxnFromEur, c: arribosEsteMes.costoMxnFromEur },
                          { label: "MXN", v: arribosEsteMes.ventaMxnNative, c: arribosEsteMes.costoMxnNative },
                        ].filter((r) => r.v !== 0 || r.c !== 0);

                        return (
                          <div className="space-y-3">
                            {/* Header */}
                            <div>
                              <div className="text-sm font-semibold leading-tight">Profit proyectado del mes</div>
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                                Homologado a MXN
                              </div>
                            </div>

                            {/* Totales */}
                            <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
                              <span className="text-muted-foreground">Venta total</span>
                              <span className="tabular-nums font-medium text-right">{formatCurrency(venta, "MXN")}</span>
                              <span className="text-muted-foreground">Costo total</span>
                              <span className="tabular-nums font-medium text-right">{formatCurrency(costo, "MXN")}</span>
                            </div>

                            {/* Profit destacado */}
                            <div className={`rounded-md px-2.5 py-2 ${profitBg}`}>
                              <div className="grid grid-cols-[1fr_auto] gap-x-3 items-baseline">
                                <span className="text-xs font-semibold">
                                  Profit
                                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground tabular-nums">
                                    ({margenPct.toFixed(1)}%)
                                  </span>
                                </span>
                                <span className={`text-base font-bold tabular-nums text-right ${profitColor}`}>
                                  {formatCurrency(profit, "MXN")}
                                </span>
                              </div>
                              {/* Mini barra costo vs profit */}
                              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
                                <div className="h-full bg-warning" style={{ width: `${costoPct}%` }} />
                                <div className={`h-full ${profitPositivo ? "bg-success" : "bg-destructive"}`} style={{ width: `${profitBarPct}%` }} />
                              </div>
                              <div className="mt-1 flex justify-between text-[9px] text-muted-foreground uppercase tracking-wide">
                                <span>Costo</span>
                                <span>{profitPositivo ? "Profit" : "Pérdida"}</span>
                              </div>
                            </div>

                            {/* Desglose por moneda origen */}
                            {desglose.length > 0 && (
                              <div className="border-t pt-2">
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                  Desglose por moneda origen
                                </div>
                                <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-0.5 text-[11px]">
                                  <span className="text-[10px] uppercase text-muted-foreground">Origen</span>
                                  <span className="text-[10px] uppercase text-muted-foreground text-right">Venta MXN</span>
                                  <span className="text-[10px] uppercase text-muted-foreground text-right">Costo MXN</span>
                                  {desglose.map((r) => (
                                    <Fragment key={r.label}>
                                      <span className="font-medium">{r.label}</span>
                                      <span className="tabular-nums text-right">{formatCurrency(r.v, "MXN")}</span>
                                      <span className="tabular-nums text-right text-muted-foreground">{formatCurrency(r.c, "MXN")}</span>
                                    </Fragment>
                                  ))}

                                </div>
                              </div>
                            )}

                            <div className="text-[10px] text-muted-foreground italic border-t pt-1.5">
                              Conversión con TC guardado en cada embarque.
                            </div>
                          </div>
                        );
                      })()}
                    </TooltipContent>

                  </Tooltip>
                </TooltipProvider>
              )}
              <p className="text-[11px] text-muted-foreground font-medium">Profit MXN proyectado</p>
            </div>
            )}
          </div>

          <div className="flex flex-col gap-0.5 xl:w-48 shrink-0">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="flex items-center gap-2 cursor-help w-full">
                    <Progress
                      value={pctBarra}
                      className={`h-2 flex-1 ${barColor}`}
                    />
                    <span className={`text-xs font-semibold tabular-nums w-12 text-right ${pctTextColor}`}>
                      {sinGastos ? "—" : `${pctReal}%`}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="w-[280px] p-3">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold leading-tight">
                      Cobertura de gastos fijos
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Profit proyectado</span>
                      <span className="tabular-nums font-medium text-right">
                        {formatCurrency(arribosEsteMes.profitMXN, "MXN")}
                      </span>
                      <span className="text-muted-foreground">Gastos operativos del mes</span>
                      <span className="tabular-nums font-medium text-right">
                        {formatCurrency(gastos, "MXN")}
                      </span>
                    </div>
                    {sinGastos ? (
                      <p className="text-[11px] text-muted-foreground italic border-t pt-1.5">
                        Aún no hay gastos operativos capturados este mes.
                      </p>
                    ) : perdida ? (
                      <p className="text-[11px] text-destructive border-t pt-1.5">
                        Pérdida proyectada: aún no cubres nada de los gastos fijos.
                      </p>
                    ) : pctReal >= 100 ? (
                      <p className="text-[11px] text-success border-t pt-1.5">
                        Ya cubriste tus gastos fijos del mes. El excedente es utilidad neta.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground border-t pt-1.5">
                        Faltan <span className="font-semibold text-foreground">{formatCurrency(faltante, "MXN")}</span> de profit para cubrir tus gastos fijos.
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground italic">
                      Gastos = facturas de proveedor "Gasto operativo" + comisiones del mes.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-[10px] text-muted-foreground text-center">
              Gastos fijos cubiertos
            </p>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
