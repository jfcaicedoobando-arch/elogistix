/**
 * KpiBucket para la página de aging CxP — extraído (v13.317.9).
 */
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  moneda: string;
  tone?: "default" | "warn" | "danger";
}

export function KpiBucket({ label, value, moneda, tone = "default" }: Props) {
  const toneCls =
    tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-semibold tabular-nums mt-1", toneCls)}>
          {formatCurrency(value, moneda)}
        </p>
      </CardContent>
    </Card>
  );
}
