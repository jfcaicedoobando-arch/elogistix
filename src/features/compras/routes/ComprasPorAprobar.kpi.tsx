/**
 * KPICard para /compras/por-aprobar.
 * Helpers puros (`sumaMxn`, `sumaUsd`) viven en `./ComprasPorAprobar.helpers.ts`
 * para respetar react-refresh/only-export-components.
 */
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KPICard({
  icon: Icon, label, count, monto, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  monto?: string;
  tone?: "default" | "warn" | "success" | "danger";
}) {
  const toneCls =
    tone === "danger" ? "text-destructive"
    : tone === "success" ? "text-success"
    : tone === "warn" ? "text-warning"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", toneCls)} />
          <span>{label}</span>
        </p>
        <p className={cn("text-lg font-semibold tabular-nums", toneCls)}>
          {count} <span className="text-xs font-normal text-muted-foreground">
            {count === 1 ? "factura" : "facturas"}
          </span>
        </p>
        {monto && <p className="text-xs text-muted-foreground tabular-nums">{monto}</p>}
      </CardContent>
    </Card>
  );
}
