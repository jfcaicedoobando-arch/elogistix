/**
 * Tiles del dashboard `/compras`: `KpiCard` reutilizable + `QuickLink`.
 * Extraídos en v13.182.0 (Wave 2 splits).
 * v13.213.35 — soporte de `hint` (tooltip) para explicar cada KPI.
 */
import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function KpiCard({
  label, value, sub, tone = "default", hint,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "warn" | "danger";
  hint?: string;
}) {
  const toneCls = tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 min-w-0">
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
        <p className={cn("text-2xl font-semibold tabular-nums mt-1", toneCls)}>{value}</p>
        {sub && <p className="text-label text-muted-foreground mt-0.5 tabular-nums">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function QuickLink({
  to, icon, title, description, kpi,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  kpi: string;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="rounded-md bg-primary/10 text-primary p-2">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">{title}</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            <p className="text-sm font-medium tabular-nums mt-2">{kpi}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
