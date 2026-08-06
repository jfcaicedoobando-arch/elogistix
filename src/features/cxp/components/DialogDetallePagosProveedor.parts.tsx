import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
      "min-w-0 rounded-lg border bg-card p-3 short:p-2.5 transition-all",
      emphasis && "ring-2 ring-accent/30 border-accent/30",
    )}>
      <p className="text-2xs font-bold uppercase tracking-tight text-muted-foreground mb-1 truncate">
        {label}
      </p>
      <p
        className={cn("text-base font-semibold tabular-nums truncate", valueCls)}
        title={value}
      >
        {value}
      </p>
      {hint && (
        <p className="text-2xs text-muted-foreground tabular-nums truncate" title={hint}>
          {hint}
        </p>
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
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
