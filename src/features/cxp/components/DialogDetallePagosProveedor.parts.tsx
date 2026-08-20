import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Hint } from "@/components/shared/Hint";

export type KpiTone = "default" | "success" | "warn";

export function Kpi({ label, value, tone = "default", emphasis = false, hint }: {
  label: string; value: string; tone?: KpiTone; emphasis?: boolean;
  /** Línea secundaria opcional (p. ej. "TC 17.55") para no romper el valor. */
  hint?: string;
}) {
  const valueCls =
    tone === "success" ? "text-success"
    : tone === "warn" ? "text-warning"
    : "text-foreground";
  return (
    <div className={cn(
      "min-w-0 rounded-lg border bg-card p-3 short:p-2.5 transition-[box-shadow,border-color]",
      emphasis && "ring-2 ring-accent/30 border-accent/30",
    )}>
      <p className="text-label font-bold uppercase tracking-tight text-muted-foreground mb-1 truncate">
        {label}
      </p>
      <Hint label={value}>
        <p className={cn("text-base font-semibold tabular-nums truncate", valueCls)}>
          {value}
        </p>
      </Hint>
      {hint && (
        <Hint label={hint}>
          <p className="text-label text-muted-foreground tabular-nums truncate">
            {hint}
          </p>
        </Hint>
      )}
    </div>
  );
}


export function HeaderWithTooltip({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center justify-end gap-1 cursor-help">
          {label}
          <Info className="h-3 w-3 text-muted-foreground/70" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-body-sm">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
