/**
 * Mini barra de vigencia: muestra el avance del periodo [desde, hasta]
 * con color por urgencia (success > 7d, warning ≤ 7d, destructive vencida).
 * v13.135.53
 */
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatVigencia, vigenciaHint } from "../routes/CosteoTarifas.helpers";
import { parseDateOnlyLocal } from "@/lib/date/dateOnly";

interface Props {
  desde: string;
  hasta: string;
}

function pct(desde: string, hasta: string): number {
  // B-089: vigencias date-only ancladas a medianoche local.
  const d = parseDateOnlyLocal(desde).getTime();
  const h = parseDateOnlyLocal(hasta).getTime();
  const today = Date.now();
  if (!Number.isFinite(d) || !Number.isFinite(h) || h <= d) return 1;
  const r = (today - d) / (h - d);
  if (r <= 0) return 0;
  if (r >= 1) return 1;
  return r;
}

export function VigenciaBar({ desde, hasta }: Props) {
  const hint = vigenciaHint(hasta);
  const progress = Math.round(pct(desde, hasta) * 100);
  const barColor = hint.tone === "danger"
    ? "bg-destructive"
    : hint.tone === "warn" ? "bg-warning" : "bg-success";
  const textColor = hint.tone === "danger"
    ? "text-destructive"
    : hint.tone === "warn" ? "text-warning" : "text-muted-foreground";
  const noIniciada = progress === 0;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-1 cursor-default">
            <div className="text-xs tabular-nums">{formatVigencia(desde, hasta)}</div>
            <div className={`h-1.5 w-full rounded-full overflow-hidden ${noIniciada ? "bg-muted/40 border border-dashed border-muted-foreground/30" : "bg-muted"}`}>
              {!noIniciada && (
                <div className={`h-full ${barColor}`} style={{ width: `${progress}%` }} />
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className={`text-xs ${textColor}`}>{hint.text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
