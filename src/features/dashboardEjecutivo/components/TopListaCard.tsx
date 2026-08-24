import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/shared/Hint";

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
          <p className="text-body text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={`${it.nombre}-${i}`} className="flex items-center justify-between gap-2 text-body">
                <div className="min-w-0">
                  {/* E-14 (auditoría visual 2026-08-24): nombre truncado con
                      tooltip para poder leerlo completo. */}
                  <Hint label={it.nombre}>
                    <p className="truncate font-medium">{it.nombre}</p>
                  </Hint>
                  {typeof it.dias === "number" && it.dias !== 0 && (

                    <Badge variant={severidad(it.dias)} className="mt-0.5 text-label">
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
