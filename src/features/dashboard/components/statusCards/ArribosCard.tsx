import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, TrendingUp, Ship, CheckCircle2, Info } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/formatters";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { useIsMobile } from "@/hooks/shared/useIsMobile";
import { ProfitTooltipContent, CoberturaTooltipContent } from "./ArribosCardTooltips";

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

function getBarStyles(perdida: boolean, pctReal: number) {
  if (perdida || pctReal < 50) {
    return { bar: "[&>div]:bg-destructive", text: "text-destructive" };
  }
  if (pctReal < 100) {
    return { bar: "[&>div]:bg-warning", text: "text-warning" };
  }
  return { bar: "[&>div]:bg-success", text: "text-success" };
}

/**
 * En desktop usa Tooltip (hover); en mobile usa Popover (tap), porque los
 * tooltips de Radix no se abren con touch. El contenido es el mismo.
 */
function InfoHint({
  trigger,
  content,
  widthClass,
}: {
  trigger: ReactNode;
  content: ReactNode;
  widthClass: string;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={8}
          className={`${widthClass} p-3`}
        >
          {content}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={8}
          collisionPadding={8}
          className={`${widthClass} p-3`}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ArribosCard({ arribosEsteMes, isLoading, hideFinancials = false }: Props) {
  const gastos = arribosEsteMes.gastosOperativosMXN;
  const profitPositivo = Math.max(arribosEsteMes.profitMXN, 0);
  const pctReal = gastos > 0 ? Math.round((profitPositivo / gastos) * 100) : 0;
  const pctBarra = Math.min(100, pctReal);
  const faltante = Math.max(gastos - profitPositivo, 0);
  const sinGastos = gastos <= 0;
  const perdida = arribosEsteMes.profitMXN < 0;
  const { bar: barColor, text: pctTextColor } = getBarStyles(perdida, pctReal);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/80">
              <CalendarDays className="h-4 w-4 text-primary-foreground" />
            </div>
            <SectionHeading as="h3" className="inline-flex">Arribos este mes</SectionHeading>
          </div>

          <div className={`grid ${hideFinancials ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"} gap-3 sm:gap-6 flex-1`}>
            <div className="text-center">
              {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : (
                <span className="text-xl font-bold text-foreground tabular-nums">{arribosEsteMes.total}</span>
              )}
              <p className="text-2xs text-muted-foreground font-medium">Total</p>
            </div>

            <div className="text-center">
              {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : (
                <div className="flex items-center gap-1 justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="text-xl font-bold text-success tabular-nums">{arribosEsteMes.yaLlegaron}</span>
                </div>
              )}
              <p className="text-2xs text-muted-foreground font-medium">Ya llegaron</p>
            </div>

            <div className="text-center">
              {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : (
                <div className="flex items-center gap-1 justify-center">
                  <Ship className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xl font-bold text-warning tabular-nums">{arribosEsteMes.enCamino}</span>
                </div>
              )}
              <p className="text-2xs text-muted-foreground font-medium">En camino</p>
            </div>

            {!hideFinancials && (
              <div className="text-center">
                {isLoading ? <Skeleton className="h-6 w-20 mx-auto" /> : (
                  <InfoHint
                    widthClass="w-[min(320px,calc(100vw-2rem))]"
                    trigger={
                      <button type="button" className="flex items-center gap-1 justify-center w-full cursor-help">
                        <TrendingUp className={`h-3.5 w-3.5 ${arribosEsteMes.profitMXN >= 0 ? "text-success" : "text-destructive"}`} />
                        <span className={`text-base sm:text-xl font-bold tabular-nums whitespace-nowrap ${arribosEsteMes.profitMXN >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrencyCompact(arribosEsteMes.profitMXN, "MXN")}
                        </span>
                        <Info className="h-3 w-3 text-muted-foreground/70" />
                      </button>
                    }
                    content={<ProfitTooltipContent data={arribosEsteMes} />}
                  />
                )}
                <p className="text-2xs text-muted-foreground font-medium">Profit MXN proyectado</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-0.5 xl:w-48 shrink-0">
            <InfoHint
              widthClass="w-[min(280px,calc(100vw-2rem))]"
              trigger={
                <button type="button" className="flex items-center gap-2 cursor-help w-full">
                  <Progress value={pctBarra} className={`h-2 flex-1 ${barColor}`} />
                  <span className={`text-xs font-semibold tabular-nums w-12 text-right ${pctTextColor}`}>
                    {sinGastos ? "—" : `${pctReal}%`}
                  </span>
                </button>
              }
              content={
                <CoberturaTooltipContent
                  profitMXN={arribosEsteMes.profitMXN}
                  gastos={gastos}
                  faltante={faltante}
                  sinGastos={sinGastos}
                  perdida={perdida}
                  pctReal={pctReal}
                />
              }
            />
            <p className="text-2xs text-muted-foreground text-center">Gastos fijos cubiertos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
