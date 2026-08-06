import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { TopItem } from "@/features/tesoreria/services";

interface Props {
  title: string;
  items: TopItem[];
  emptyText?: string;
}

function severidad(dias: number | undefined): "default" | "destructive" | "secondary" {
  if (!dias || dias <= 0) return "secondary";
  if (dias > 30) return "destructive";
  return "default";
}

export function TopListaCard({ title, items, emptyText = "Sin registros." }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={`${it.nombre}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{it.nombre}</p>
                  {typeof it.dias === "number" && it.dias !== 0 && (
                    <Badge variant={severidad(it.dias)} className="mt-0.5 text-2xs">
                      {it.dias > 0 ? `${it.dias} d vencido` : `${Math.abs(it.dias)} d por vencer`}
                    </Badge>
                  )}
                </div>
                <span className="tabular-nums font-semibold shrink-0">
                  {formatCurrency(it.saldo, it.moneda)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
