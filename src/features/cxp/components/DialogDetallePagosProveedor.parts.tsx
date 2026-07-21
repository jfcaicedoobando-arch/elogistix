import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type KpiTone = "default" | "success" | "warn";

export function Kpi({ label, value, tone = "default", emphasis = false }: {
  label: string; value: string; tone?: KpiTone; emphasis?: boolean;
}) {
  const valueCls =
    tone === "success" ? "text-success"
    : tone === "warn" ? "text-warning"
    : "text-foreground";
  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 transition-all",
      emphasis && "ring-2 ring-accent/30 border-accent/30",
    )}>
      <p className="text-2xs font-bold uppercase tracking-tight text-muted-foreground mb-1">
        {label}
      </p>
      <p className={cn("text-lg font-semibold tabular-nums", valueCls)}>{value}</p>
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
