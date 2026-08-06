import type { ReactNode } from "react";
import { CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, TrendingUp, Ship, CheckCircle2 } from "lucide-react";
import { formatCurrencyCompact, formatCurrency } from "@/lib/formatters";
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
  const profitPositivoFlag = arribosEsteMes.profitMXN >= 0;

  return (
    <div className="rounded-lg border bg-card">
      <CardContent className="p-4">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/80">
              <CalendarDays className="h-4 w-4 text-primary-foreground" />
            </div>
            <SectionHeading as="h3" className="inline-flex">Arribos este mes</SectionHeading>
          </div>

          <div className="flex-1 min-w-0">
            <KpiStrip desktopCols={hideFinancials ? 3 : 4} className="gap-3">
              <KpiCard label="Total" value={arribosEsteMes.total} loading={isLoading} />
              <KpiCard
                label="Ya llegaron"
                value={arribosEsteMes.yaLlegaron}
                icon={CheckCircle2}
                variant="success"
                loading={isLoading}
              />
              <KpiCard
                label="En camino"
                value={arribosEsteMes.enCamino}
                icon={Ship}
                variant="warning"
                loading={isLoading}
              />
              {!hideFinancials && (
                isLoading ? (
                  <KpiCard label="Profit MXN proyectado" value="" loading />
                ) : (
                  <InfoHint
                    widthClass="w-[min(320px,calc(100vw-2rem))]"
                    trigger={
                      <div className="cursor-help">
                        <KpiCard
                          label="Profit MXN proyectado"
                          value={formatCurrencyCompact(arribosEsteMes.profitMXN, "MXN")}
                          valueTooltip={formatCurrency(arribosEsteMes.profitMXN, "MXN")}
                          icon={TrendingUp}
                          variant={profitPositivoFlag ? "success" : "destructive"}
                        />
                      </div>
                    }
                    content={<ProfitTooltipContent data={arribosEsteMes} />}
                  />
                )
              )}
            </KpiStrip>
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
    </div>
  );
}
