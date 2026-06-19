/**
 * Sub-componentes presentacionales de TarifaResultCard.
 * Extraídos para mantener el archivo principal ≤200 líneas (Power of 10).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarClock, Info, Ship, Trophy } from "lucide-react";
import type { TopTarifaRow } from "@/features/costeo/types";
import { cn } from "@/lib/utils";
import { formatFechaMx, usdTarifa as usd } from "@/features/costeo/utils/tarifaFormatters";

export function CardHeader({ row, rank, esGanador }: { row: TopTarifaRow; rank: number; esGanador: boolean }) {
  return (
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
  );
}

export function CostoTotalBlock({
  row,
  esGanador,
  delta,
}: { row: TopTarifaRow; esGanador: boolean; delta: number }) {
  return (
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
  );
}

export function FechaVigencia({ vigenteHasta, vencePronto }: { vigenteHasta: string; vencePronto: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <CalendarClock className="size-3 text-muted-foreground" />
      <span className="text-muted-foreground">Vigente hasta:</span>
      <span className="font-medium">{formatFechaMx(vigenteHasta)}</span>
      {vencePronto && (
        <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] ml-auto">
          Vence pronto
        </Badge>
      )}
    </div>
  );
}

export function WinnerBadge() {
  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
      <Badge className="bg-success text-success-foreground border-success gap-1 shadow-sm">
        <Trophy className="size-3" /> Mejor opción
      </Badge>
    </div>
  );
}

export function EtiquetasList({ etiquetas }: { etiquetas: string[] }) {
  if (etiquetas.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {etiquetas.map((e) => (
        <Badge key={e} variant="secondary" className="text-[10px] uppercase tracking-wide font-semibold">
          {e}
        </Badge>
      ))}
    </div>
  );
}

export function PreciosBase({ row }: { row: TopTarifaRow }) {
  return (
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
  );
}

export function ElegirButton({
  row,
  esGanador,
  selectLabel,
  onElegir,
}: {
  row: TopTarifaRow;
  esGanador: boolean;
  selectLabel: string;
  onElegir: (row: TopTarifaRow) => void;
}) {
  return (
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
  );
}
