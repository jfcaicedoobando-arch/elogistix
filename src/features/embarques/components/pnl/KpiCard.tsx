/**
 * Tarjeta KPI individual del bloque P&L.
 * Extraída de `TabPnl.tsx` en v13.56.2 (auditoría — paso 5).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "default" | "success" | "destructive" | "warning";
}

export function KpiCard({ label, value, delta, tone = "default" }: KpiCardProps) {
  const toneClass =
    tone === "success" ? "text-success" :
    tone === "destructive" ? "text-destructive" :
    tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
        {delta && <div className="text-xs text-muted-foreground">{delta}</div>}
      </CardContent>
    </Card>
  );
}
