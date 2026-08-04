/**
 * Tiles del dashboard `/compras` — v13.307.22: KPI clickeable + eliminación de QuickLink.
 * Los KPIs ahora navegan a la página que corresponde a la acción, eliminando la
 * fila redundante de QuickLinks (que duplicaba el sidebar).
 */
import { Link } from "react-router-dom";
import { ArrowUpRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type KpiTone = "default" | "info" | "warn" | "danger" | "success";

const TONE_DOT: Record<KpiTone, string> = {
  default: "bg-muted-foreground/40",
  info: "bg-info",
  warn: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
};

const TONE_VALUE: Record<KpiTone, string> = {
  default: "text-foreground",
  info: "text-foreground",
  warn: "text-foreground",
  danger: "text-destructive",
  success: "text-foreground",
};

export function KpiCard({
  label, value, sub, tone = "default", hint, to, icon, valueTooltip,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: KpiTone;
  hint?: string;
  to?: string;
  icon?: React.ReactNode;
  /** Tooltip nativo con la cifra exacta cuando `value` viene en notación compacta. */
  valueTooltip?: string;
}) {
  const body = (
    <Card className={cn(
      "h-full transition-colors",
      to && "group-hover:border-primary/40 group-hover:bg-muted/30",
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", TONE_DOT[tone])} aria-hidden />
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            {hint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Info: ${label}`}
                    className="inline-flex text-muted-foreground/70 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                  >
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs">{hint}</TooltipContent>
              </Tooltip>
            )}
          </div>
          {to ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
          ) : icon ? (
            <span className="text-muted-foreground/60 shrink-0">{icon}</span>
          ) : null}
        </div>
        <p className={cn("text-2xl font-semibold tabular-nums mt-2", TONE_VALUE[tone])} title={valueTooltip}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 tabular-nums truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to} className="block group">{body}</Link> : body;
}
