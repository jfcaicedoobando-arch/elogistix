/**
 * Card de resultado individual del Top 3 de tarifas vigentes.
 * v13.68.1: dividida en sub-componentes para cumplir Power of 10 (≤200 líneas).
 */
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarClock, Info, Ship, Trophy } from "lucide-react";
import { fetchRecargosDeTarifa } from "@/features/costeo/services/topTarifas";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { RankingMeta } from "@/features/costeo/utils/rankingLabels";
import { cn } from "@/lib/utils";
import { TarifaCardDesglose } from "./TarifaCardDesglose";
import { TarifaCardBadges } from "./TarifaCardBadges";
import { formatFechaMx, usdTarifa as usd } from "@/features/costeo/utils/tarifaFormatters";

interface Props {
  row: TopTarifaRow;
  rank: number;
  onElegir?: (row: TopTarifaRow) => void;
  selectLabel?: string;
  meta?: RankingMeta;
}

// eslint-disable-next-line complexity -- Card de presentación con muchos branches de UI; refactor pendiente.
export function TarifaResultCard({ row, rank, onElegir, selectLabel = "Elegir", meta }: Props) {
  const { data: recargos = [] } = useQuery({
    queryKey: ["costeo", "tarifa-recargos", row.id],
    queryFn: () => fetchRecargosDeTarifa(row.id),
    staleTime: 60 * 1000,
  });

  const esGanador = meta?.esGanador ?? rank === 1;
  const etiquetas = meta?.etiquetasMejorEn ?? (rank === 1 ? ["Mejor precio"] : []);
  const delta = meta?.deltaTotalVsGanador ?? 0;
  const vencePronto = meta?.vencePronto ?? false;

  return (
    <TooltipProvider delayDuration={200}>
      <Card
        className={cn(
          "p-4 space-y-3 flex flex-col relative transition-shadow",
          esGanador
            ? "border-2 border-success bg-success/5 shadow-md ring-1 ring-success/20"
            : "border-border hover:shadow-sm",
        )}
      >
        {esGanador && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-success text-success-foreground border-success gap-1 shadow-sm">
              <Trophy className="size-3" /> Mejor opción
            </Badge>
          </div>
        )}

        <div className="flex items-start justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "size-8 rounded-full flex items-center justify-center font-semibold shrink-0 text-sm",
                esGanador ? "bg-success text-success-foreground" : "bg-primary/10 text-primary",
              )}
            >
              {rank === 1 ? <Trophy className="size-4" /> : `#${rank}`}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{row.agente_nombre}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <Ship className="size-3 shrink-0" />
                <span className="truncate">{row.naviera_nombre} · {row.tipo_contenedor_nombre}</span>
              </p>
            </div>
          </div>
        </div>

        {etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {etiquetas.map((e) => (
              <Badge key={e} variant="secondary" className="text-[10px] uppercase tracking-wide font-semibold">
                {e}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground shrink-0">Flete base</span>
            <span className="tabular-nums whitespace-nowrap">{usd(row.flete_base)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground shrink-0">Recargos</span>
            <span className="tabular-nums whitespace-nowrap">{usd(row.recargos_total)}</span>
          </div>
        </div>

        <div className={cn("rounded-md p-3 -mx-1", esGanador ? "bg-success/10" : "bg-muted/50")}>
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              Costo total estimado
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Qué incluye el costo total" className="text-muted-foreground hover:text-foreground">
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Flete base + todos los recargos vigentes a la fecha seleccionada. No incluye demoras ni cargos no previstos.
                </TooltipContent>
              </Tooltip>
            </div>
            <span className={cn("text-xl font-bold tabular-nums whitespace-nowrap", esGanador && "text-success")}>
              {usd(row.total_comparable)}
            </span>
          </div>
          {!esGanador && delta > 0 && (
            <div className="text-xs text-destructive font-medium mt-1 text-right">
              +{usd(delta)} vs #1
            </div>
          )}
        </div>

        <TarifaCardDesglose recargos={recargos} />
        <TarifaCardBadges row={row} />

        <div className="flex items-center gap-1.5 text-xs">
          <CalendarClock className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground">Vigente hasta:</span>
          <span className="font-medium">{formatFechaMx(row.vigente_hasta)}</span>
          {vencePronto && (
            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] ml-auto">
              Vence pronto
            </Badge>
          )}
        </div>

        {onElegir && (
          <div className="mt-auto pt-1">
            <Button
              className="w-full"
              size={esGanador ? "lg" : "default"}
              variant={esGanador ? "default" : "outline"}
              onClick={() => onElegir(row)}
            >
              {selectLabel} {esGanador && "esta"}
            </Button>
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
}
